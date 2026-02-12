// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IERC5521.sol";
import "./interfaces/IERC4906.sol";
import "./interfaces/IFumi.sol";
import "./interfaces/IGeoMetadata.sol";
import "./libraries/SSTORE2.sol";
import "./libraries/SafeExternalCall.sol";
import "./interfaces/IGeoMath.sol";

/// @title GeoRelationalNFT: ERC-721 + ERC-5521 Geo-location NFT
/// @notice NFT that encodes geographic coordinates and relationships in tokenId
/// @dev Uses decimal encoding (quadrant × 10^20 + |lat| × 10^10 + |lon|) and ERC-5521 for referential relationships
contract GeoRelationalNFT is
    ERC721,
    ERC721Enumerable,
    IERC5521,
    IERC4906,
    Ownable,
    Pausable,
    EIP712
{
    using SafeExternalCall for address;

    // =========================
    // Custom Errors
    // =========================

    // Input validation errors
    error TextTooLong();
    error InvalidLatitude();
    error InvalidLongitude();
    error InvalidColorIndex();
    error TooManyTokensInTree();
    error InvalidAddress();
    error MismatchedLengths();

    // Authorization errors
    error NotOwnerNorApproved();
    error InvalidSignature();

    // ERC-5521 reference errors
    error InitialReferenceCannotBeRemoved();
    error NoReferencesProvided();
    error TooManyReferences();
    /// @dev Thrown when ANY reference is not self-contract (name kept for ABI compatibility)
    error FirstReferenceMustBeSelf();

    // External contract errors
    error NotAContract();
    error NoERC165Support();
    error NotERC5521();
    error ExternalTokenNotFound();

    // =========================
    // Events
    // =========================
    /// @notice Emitted when a new GeoRelationalNFT is minted
    /// @param tokenId The minted token ID
    /// @param to The owner of the token
    /// @param from The parent token owner (address(0) for root tokens)
    /// @param text The message stored with the token
    /// @param h3r6 H3 resolution 6 index (city-level discovery, ~3.2km hexagons)
    /// @param h3r8 H3 resolution 8 index (district-level discovery, ~0.5km hexagons)
    /// @param h3r10 H3 resolution 10 index (street-level discovery, ~0.07km hexagons)
    /// @param h3r12 H3 resolution 12 index (building-level discovery, ~0.01km hexagons)
    event FumiMinted(
        uint256 indexed tokenId,
        address indexed to,
        address indexed from,
        string text,
        string h3r6,
        string h3r8,
        string h3r10,
        string h3r12
    );

    /// @notice Emitted when a token's reference count is updated
    /// @param tokenId The token whose refCount was incremented
    /// @param newRefCount The new reference count value
    event RefCountUpdated(
        uint256 indexed tokenId,
        uint256 newRefCount
    );

    /// @notice Emitted when a token's unique referrer count is updated
    /// @param tokenId The token whose uniqueRefCount was incremented
    /// @param newUniqueRefCount The new unique referrer count value
    event UniqueRefCountUpdated(
        uint256 indexed tokenId,
        uint256 newUniqueRefCount
    );

    /// @notice Emitted when a reference relationship is created between tokens
    /// @dev Provides per-token distance data for Subgraph indexing
    /// @param fromTokenId The child token ID (newly minted token)
    /// @param toTokenId The parent token ID (referenced token)
    /// @param distance The distance in meters between the two tokens
    /// @param isInitialReference True if this is the immutable first reference
    event ReferenceCreated(
        uint256 indexed fromTokenId,
        uint256 indexed toTokenId,
        uint256 distance,
        bool isInitialReference
    );

    // =========================
    // Constants
    // =========================
    // Precision factor for converting floating-point coordinates to integers
    // 6 decimal places of precision. e.g., 35.658584 degrees becomes 35658584
    uint256 private constant PRECISION = 1e6;
    // Elevation precision: 4 decimal places. e.g., 3776.1234m becomes 37761234
    uint256 private constant ELEVATION_PRECISION = 1e4;

    // Geographic coordinate limits, scaled by PRECISION
    int256 private constant MAX_LAT = 90 * int256(PRECISION);
    int256 private constant MIN_LAT = -90 * int256(PRECISION);
    int256 private constant MAX_LON = 180 * int256(PRECISION);
    int256 private constant MIN_LON = -180 * int256(PRECISION);

    // TokenId encoding: quadrant × 10^20 + |latitude| × 10^10 + |longitude|
    uint256 private constant LAT_MULTIPLIER = 1e10;
    uint256 private constant QUADRANT_MULTIPLIER = 1e20;
    uint256 private constant EXTERNAL_CALL_GAS_LIMIT = 15000;
    uint256 private constant MAX_COPY_BYTES = 512;
    uint256 private constant MAX_REFERENCES = 100;
    uint256 private constant INTERFACE_CHECK_GAS = 5000;

    // =========================
    // EIP-712 Type Hashes
    // =========================
    /// @dev Type hash for signedMint (with elevation, colorIndex and H3 support)
    bytes32 private constant MINT_TYPEHASH = keccak256(
        "Mint(address to,int256 latitude,int256 longitude,int256 elevation,uint256 colorIndex,string message,string h3r6,string h3r8,string h3r10,string h3r12,uint256 nonce)"
    );
    /// @dev Type hash for signedMintWithChain (with elevation, colorIndex and H3 support)
    bytes32 private constant MINT_WITH_CHAIN_TYPEHASH = keccak256(
        "MintWithChain(address to,address[] refAddresses,uint256[] refTokenIds,int256 latitude,int256 longitude,int256 elevation,uint256 colorIndex,string message,string h3r6,string h3r8,string h3r10,string h3r12,uint256 nonce)"
    );

    // =========================
    // Structs
    // =========================
    /// @dev Decoded tokenId data structure
    struct DecodedTokenData {
        uint256 quadrant;
        int256 latitude;
        int256 longitude;
        int256 elevation;
        uint256 colorIndex;
        uint256 tree;
        uint256 generation;
    }

    /// @dev Inline packed text structure (≤54 bytes)
    struct Packed54 {
        uint256 w0;
        uint256 w1;
    }

    /// @dev Mint with chain parameters (to avoid stack too deep)
    struct MintWithChainParams {
        address to;
        address[] refAddresses;
        uint256[] refTokenIds;
        int256 latitude;
        int256 longitude;
        int256 elevation;
        uint256 colorIndex;
        string message;
    }

    /// @notice H3 geocode parameters at multiple resolutions for geographic discovery
    /// @dev All fields are lowercase hex strings without 0x prefix (15 characters each)
    struct H3Params {
        string h3r6;   // Resolution 6: ~3.2km hexagons (city-level, wide area search)
        string h3r8;   // Resolution 8: ~0.5km hexagons (district-level, neighborhood search)
        string h3r10;  // Resolution 10: ~0.07km hexagons (street-level, block search)
        string h3r12;  // Resolution 12: ~0.01km hexagons (building-level, precise location)
    }

    // =========================
    // State Variables
    // =========================
    /// @dev Tree counter for tree/generation tracking (packed with reserved slot)
    uint128 private _tree;
    /// @dev Reserved for future use (packed with _tree in same storage slot)
    uint128 private _reserved;

    /// @dev Tree and generation for each token (coordinates are encoded in tokenId)
    mapping(uint256 => uint256) private _tokenTrees;
    mapping(uint256 => uint256) private _tokenGenerations;
    mapping(uint256 => int256) private _tokenElevations;
    mapping(uint256 => uint256) private _tokenColorIndexes;

    /// @dev Initial base tokenId for each token (used in mintWithChain)
    mapping(uint256 => uint256) private _initialBaseTokenId;

    /// @dev Maximum distance to any direct child (for SVG display)
    /// Stores the longest distance from this token to any of its direct children
    /// Used to distinguish tokens with descendants vs without (same generation problem)
    mapping(uint256 => uint256) private _maxChildDistance;

    /// @dev ERC-5521 reference relationships
    mapping(address => mapping(uint256 => address[])) private _referringKeys;
    mapping(address => mapping(uint256 => mapping(address => uint256[]))) private _referringValues;
    mapping(address => mapping(uint256 => address[])) private _referredKeys;
    mapping(address => mapping(uint256 => mapping(address => uint256[]))) private _referredValues;
    mapping(address => mapping(uint256 => uint256)) private _createdTimestamps;

    /// @dev Text storage - inline mode (≤54 bytes)
    mapping(uint256 => Packed54) private _textInline;

    /// @dev Text storage - pointer mode (≥55 bytes)
    /// Upper bits = charLen, lower 160 bits = pointer address
    mapping(uint256 => uint256) private _textPtrMeta;

    /// @dev Reference count for each token (how many times it's been referenced)
    mapping(uint256 => uint256) private _refCount;

    /// @dev Unique referrer count for each token (how many unique users have referenced it)
    mapping(uint256 => uint256) private _uniqueRefCount;

    /// @dev Tracks whether a user has already referenced a token
    mapping(uint256 => mapping(address => bool)) private _hasReferenced;

    /// @dev Nonces for EIP-712 signed minting (replay protection)
    mapping(address => uint256) private _nonces;

    /// @dev Tree index tracking
    mapping(uint256 => uint256) private _treeCounter;
    mapping(uint256 => uint256) public tokenTreeIndex;

    /// @dev Fumi contract for SVG generation
    IFumi private immutable fumi;
    /// @dev GeoMath contract for distance calculations
    IGeoMath private immutable geoMath;
    /// @dev GeoMetadata contract for metadata formatting
    IGeoMetadata private immutable geoMetadata;

    /// @dev Pre-computed base URL for external_url (e.g., "https://norosi.xyz/item/amoy/0x776c.../")
    string private _externalUrlBase;

    // =========================
    // Constructor
    // =========================
    /// @notice Initialize the GeoRelationalNFT contract with required external contracts
    /// @param _fumi Address of the Fumi contract for SVG generation
    /// @param _geoMath Address of the GeoMath contract for distance calculations
    /// @param _geoMetadata Address of the GeoMetadata contract for metadata formatting
    /// @param chainName_ Chain name for external URL (e.g., "amoy", "polygon")
    constructor(address _fumi, address _geoMath, address _geoMetadata, string memory chainName_)
        ERC721("NOROSI", "NOROSI")
        Ownable(msg.sender)
        EIP712("NOROSI", "2")
    {
        if (_fumi == address(0)) revert InvalidAddress();
        if (_geoMath == address(0)) revert InvalidAddress();
        if (_geoMetadata == address(0)) revert InvalidAddress();
        fumi = IFumi(_fumi);
        geoMath = IGeoMath(_geoMath);
        geoMetadata = IGeoMetadata(_geoMetadata);
        _externalUrlBase = string(abi.encodePacked(
            "https://norosi.xyz/item/",
            chainName_,
            "/",
            Strings.toHexString(uint160(address(this)), 20),
            "/"
        ));
    }

    // =========================
    // TokenID Data Access
    // =========================

    /// @notice Encode geographic coordinates into a tokenId
    /// @dev TokenId uses decimal encoding: quadrant × 10^20 + |latitude| × 10^10 + |longitude|
    /// This allows coordinates to be easily extracted using division and modulo operations.
    /// Quadrant encoding: 0:(+,+), 1:(-,+), 2:(+,-), 3:(-,-)
    /// @param latitude Latitude scaled by PRECISION (±90 million max)
    /// @param longitude Longitude scaled by PRECISION (±180 million max)
    /// @return tokenId The encoded token ID
    function encodeTokenId(
        int256 latitude,
        int256 longitude
    ) public pure returns (uint256) {
        // Calculate quadrant from coordinates
        uint256 quadrant = _getQuadrant(latitude, longitude);

        // Convert signed coordinates to absolute values
        uint256 absLat = uint256(latitude < 0 ? -latitude : latitude);
        uint256 absLon = uint256(longitude < 0 ? -longitude : longitude);

        // Encode: tokenId = quadrant × 10^20 + |latitude| × 10^10 + |longitude|
        return quadrant * QUADRANT_MULTIPLIER + absLat * LAT_MULTIPLIER + absLon;
    }

    /// @notice Get geographic and attribute data for a token
    /// @dev TokenId encodes latitude, longitude, and quadrant. Tree, generation, elevation, and colorIndex are stored in mappings.
    /// @param tokenId The token ID to query
    /// @return data The token data (latitude, longitude, elevation, colorIndex, tree, generation)
    function decodeTokenId(uint256 tokenId) public view returns (DecodedTokenData memory) {
        // Validate token exists
        _requireOwned(tokenId);

        DecodedTokenData memory data;

        // Extract longitude (last 10 digits)
        uint256 absLon = tokenId % LAT_MULTIPLIER;

        // Extract latitude (middle 10 digits)
        uint256 absLat = (tokenId / LAT_MULTIPLIER) % LAT_MULTIPLIER;

        // Extract quadrant (first digits)
        data.quadrant = tokenId / QUADRANT_MULTIPLIER;

        // Convert back to signed coordinates based on quadrant using bit manipulation
        // Quadrant encoding: Bit 0 = lat<0, Bit 1 = lon<0
        // 0:(+,+), 1:(-,+), 2:(+,-), 3:(-,-)
        data.latitude = (data.quadrant & 1 != 0) ? -int256(absLat) : int256(absLat);
        data.longitude = (data.quadrant & 2 != 0) ? -int256(absLon) : int256(absLon);

        // Read tree, generation, elevation, and colorIndex from mappings
        data.tree = _tokenTrees[tokenId];
        data.generation = _tokenGenerations[tokenId];
        data.elevation = _tokenElevations[tokenId];
        data.colorIndex = _tokenColorIndexes[tokenId];

        return data;
    }

    /// @dev Get quadrant from latitude/longitude signs using bit manipulation
    /// Quadrant encoding: 0:(+,+), 1:(-,+), 2:(+,-), 3:(-,-)
    /// Bit 0 (value 1): set if latitude < 0
    /// Bit 1 (value 2): set if longitude < 0
    function _getQuadrant(int256 latitude, int256 longitude) internal pure returns (uint256) {
        unchecked {
            return (latitude < 0 ? 1 : 0) | (longitude < 0 ? 2 : 0);
        }
    }

    // Helper Getters - REMOVED for contract size optimization
    // Use decodeTokenId() to access individual fields
    // =========================

    // =========================
    // Minting Functions
    // =========================

    /// @notice Mint a new GeoRelationalNFT (owner only)
    /// @param latitude Latitude scaled by PRECISION
    /// @param longitude Longitude scaled by PRECISION
    /// @param elevation Elevation scaled by ELEVATION_PRECISION
    /// @param colorIndex Weather/color index (0-13)
    /// @param message Message text (max 54 code points)
    /// @param h3 H3 geocode parameters at resolutions 6, 8, 10, 12
    /// @return tokenId The newly minted token ID
    function mint(
        int256 latitude,
        int256 longitude,
        int256 elevation,
        uint256 colorIndex,
        string calldata message,
        H3Params calldata h3
    ) external onlyOwner whenNotPaused returns (uint256) {
        return _mintInternal(_msgSender(), latitude, longitude, elevation, colorIndex, message, h3);
    }

    /// @notice Mint a new GeoRelationalNFT with references to existing tokens (owner only)
    /// @param refAddresses Array of contract addresses for referenced tokens
    /// @param refTokenIds Array of token IDs for each contract address
    /// @param latitude Latitude scaled by PRECISION
    /// @param longitude Longitude scaled by PRECISION
    /// @param elevation Elevation scaled by ELEVATION_PRECISION
    /// @param colorIndex Weather/color index (0-13)
    /// @param message Message text (max 54 code points)
    /// @param h3 H3 geocode parameters at resolutions 6, 8, 10, 12
    /// @return tokenId The newly minted token ID
    function mintWithChain(
        address[] calldata refAddresses,
        uint256[] calldata refTokenIds,
        int256 latitude,
        int256 longitude,
        int256 elevation,
        uint256 colorIndex,
        string memory message,
        H3Params calldata h3
    ) external onlyOwner whenNotPaused returns (uint256) {
        // Validate: All references must be self-references
        // (External references can be added later via setNodeReferring)
        _requireSelfReferencesOnly(refAddresses);

        MintWithChainParams memory params;
        params.to = _msgSender();
        params.refAddresses = refAddresses;
        params.refTokenIds = refTokenIds;
        params.latitude = latitude;
        params.longitude = longitude;
        params.elevation = elevation;
        params.colorIndex = colorIndex;
        params.message = message;

        return _mintWithChainInternal(params, h3);
    }

    // =========================
    // Signed Minting (EIP-712)
    // =========================

    /// @notice Get current nonce for an address (for replay protection)
    /// @param owner Address to query
    /// @return Current nonce value
    function nonces(address owner) public view returns (uint256) {
        return _nonces[owner];
    }

    /// @notice Mint a new GeoRelationalNFT using a signature (gasless)
    /// @dev Anyone can submit the transaction, but signature must be from the contract owner
    /// @param to Address to mint the token to (must be the signer)
    /// @param latitude Latitude scaled by PRECISION
    /// @param longitude Longitude scaled by PRECISION
    /// @param elevation Elevation scaled by ELEVATION_PRECISION
    /// @param colorIndex Weather/color index (0-13)
    /// @param message Message text (max 54 code points)
    /// @param h3 H3 geocode parameters at resolutions 6, 8, 10, 12
    /// @param signature EIP-712 signature from the `to` address
    /// @return tokenId The newly minted token ID
    function signedMint(
        address to,
        int256 latitude,
        int256 longitude,
        int256 elevation,
        uint256 colorIndex,
        string memory message,
        H3Params calldata h3,
        bytes calldata signature
    ) external whenNotPaused returns (uint256) {
        uint256 nonce = _nonces[to];

        // Construct EIP-712 struct hash
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_TYPEHASH,
                to,
                latitude,
                longitude,
                elevation,
                colorIndex,
                keccak256(bytes(message)),
                keccak256(bytes(h3.h3r6)),
                keccak256(bytes(h3.h3r8)),
                keccak256(bytes(h3.h3r10)),
                keccak256(bytes(h3.h3r12)),
                nonce
            )
        );

        // Create typed data hash
        bytes32 digest = _hashTypedDataV4(structHash);

        // Recover signer from signature
        address signer = ECDSA.recover(digest, signature);

        // Verify signer matches the contract owner (server)
        if (signer != owner()) {
            revert InvalidSignature();
        }

        // Increment nonce for replay protection
        _nonces[to]++;

        // Mint the token using internal logic
        return _mintInternal(to, latitude, longitude, elevation, colorIndex, message, h3);
    }

    /// @notice Mint a new GeoRelationalNFT with chain references using a signature (gasless)
    /// @dev Anyone can submit the transaction, but signature must be from the contract owner
    /// @param to Address to mint the token to (must be the signer)
    /// @param refAddresses Array of contract addresses for referenced tokens
    /// @param refTokenIds Array of token IDs for each contract address
    /// @param latitude Latitude scaled by PRECISION
    /// @param longitude Longitude scaled by PRECISION
    /// @param elevation Elevation scaled by ELEVATION_PRECISION
    /// @param colorIndex Weather/color index (0-13)
    /// @param message Message text (max 54 code points)
    /// @param h3 H3 geocode parameters at resolutions 6, 8, 10, 12
    /// @param signature EIP-712 signature from the `to` address
    /// @return tokenId The newly minted token ID
    function signedMintWithChain(
        address to,
        address[] calldata refAddresses,
        uint256[] calldata refTokenIds,
        int256 latitude,
        int256 longitude,
        int256 elevation,
        uint256 colorIndex,
        string memory message,
        H3Params calldata h3,
        bytes calldata signature
    ) external whenNotPaused returns (uint256) {
        // Validate: All references must be self-references
        // (External references can be added later via setNodeReferring)
        _requireSelfReferencesOnly(refAddresses);

        // Construct EIP-712 struct hash
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_WITH_CHAIN_TYPEHASH,
                to,
                _hashAddressArray(refAddresses),
                keccak256(abi.encodePacked(refTokenIds)),
                latitude,
                longitude,
                elevation,
                colorIndex,
                keccak256(bytes(message)),
                keccak256(bytes(h3.h3r6)),
                keccak256(bytes(h3.h3r8)),
                keccak256(bytes(h3.h3r10)),
                keccak256(bytes(h3.h3r12)),
                _nonces[to]
            )
        );

        // Verify signature
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        if (signer != owner()) {
            revert InvalidSignature();
        }

        // Increment nonce
        _nonces[to]++;

        // Construct params and mint
        MintWithChainParams memory params;
        params.to = to;
        params.refAddresses = refAddresses;
        params.refTokenIds = refTokenIds;
        params.latitude = latitude;
        params.longitude = longitude;
        params.elevation = elevation;
        params.colorIndex = colorIndex;
        params.message = message;

        return _mintWithChainInternal(params, h3);
    }

    /// @dev Internal minting logic for regular mint
    function _mintInternal(
        address to,
        int256 latitude,
        int256 longitude,
        int256 elevation,
        uint256 colorIndex,
        string memory message,
        H3Params memory h3
    ) internal returns (uint256) {
        // Validate coordinates and colorIndex
        _validateCoordinates(latitude, longitude);
        if (colorIndex > 13) revert InvalidColorIndex();

        // Generate tokenId from coordinates
        uint256 tokenId = encodeTokenId(latitude, longitude);

        // Store tree, generation, elevation, and colorIndex in mappings
        _tokenTrees[tokenId] = _tree;
        _tokenGenerations[tokenId] = 0; // Root token starts at generation 0
        _tokenElevations[tokenId] = elevation;
        _tokenColorIndexes[tokenId] = colorIndex;

        // Set tree index
        tokenTreeIndex[tokenId] = _treeCounter[_tree];
        _treeCounter[_tree]++;

        _tree = _tree + 1;

        _safeMint(to, tokenId);

        // Record creation timestamp
        _createdTimestamps[address(this)][tokenId] = block.timestamp;

        // Store text
        _setText(tokenId, message);

        emit FumiMinted(tokenId, to, address(0), message, h3.h3r6, h3.h3r8, h3.h3r10, h3.h3r12);

        return tokenId;
    }

    /// @dev Hash an address array for EIP-712 encoding
    /// @notice EIP-712 requires each address to be encoded as 32 bytes (left-padded)
    /// @param arr Array of addresses to hash
    /// @return bytes32 keccak256 hash of the encoded array
    function _hashAddressArray(address[] calldata arr) private pure returns (bytes32) {
        bytes32[] memory encoded = new bytes32[](arr.length);
        for (uint256 i = 0; i < arr.length; i++) {
            encoded[i] = bytes32(uint256(uint160(arr[i])));
        }
        return keccak256(abi.encodePacked(encoded));
    }

    /// @dev Validate that all references are self-references (no external contracts)
    /// @param refAddresses Array of contract addresses to validate
    function _requireSelfReferencesOnly(address[] calldata refAddresses) private view {
        if (refAddresses.length == 0) revert NoReferencesProvided();
        for (uint256 i = 0; i < refAddresses.length; i++) {
            if (refAddresses[i] != address(this)) {
                revert FirstReferenceMustBeSelf();
            }
        }
    }

    /// @dev Internal minting logic for mintWithChain
    /// @notice Callers MUST invoke _requireSelfReferencesOnly first for initial mint validation
    function _mintWithChainInternal(
        MintWithChainParams memory params,
        H3Params memory h3
    ) internal returns (uint256) {
        // Validate inputs
        // Note: Empty array check is performed by _requireSelfReferencesOnly in all callers
        if (params.refAddresses.length != params.refTokenIds.length) revert MismatchedLengths();
        if (params.colorIndex > 13) revert InvalidColorIndex();

        // Generate tokenId BEFORE processing references
        // This allows us to emit ReferenceCreated events with the correct fromTokenId
        uint256 tokenId = encodeTokenId(params.latitude, params.longitude);

        // Calculate parent generation (max of all referenced tokens)
        uint256 maxGeneration = 0;
        uint256 maxDistance = 0;

        uint256 refCount = params.refAddresses.length;

        // Store distances in memory array for ReferenceCreated events
        // Events will be emitted AFTER _safeMint to ensure fromToken exists in Subgraph
        uint256[] memory distances = new uint256[](refCount);

        for (uint256 i = 0; i < refCount; ) {
            // Note: mintWithChain enforces self-reference only at the public function level
            uint256 refTokenId = params.refTokenIds[i];

            // Check that referenced token exists
            ownerOf(refTokenId);

            // Get referenced token's generation
            DecodedTokenData memory refData = decodeTokenId(refTokenId);
            if (refData.generation > maxGeneration) {
                maxGeneration = refData.generation;
            }

            // Calculate distance from new location to referenced token
            uint256 distance = geoMath.calculateDistance(
                refData.latitude,
                refData.longitude,
                params.latitude,
                params.longitude
            );

            // Store distance for ReferenceCreated event (emitted after _safeMint)
            // This ensures fromToken exists when Subgraph processes the event
            distances[i] = distance;

            // Update parent's max child distance (only for initial reference and self-contract)
            // This allows SVG to distinguish tokens with children from those without
            if (i == 0 && params.refAddresses[i] == address(this)) {
                if (distance > _maxChildDistance[refTokenId]) {
                    _maxChildDistance[refTokenId] = distance;
                }
            }

            // Keep the maximum distance among all references (Norosi.sol pattern)
            if (distance > maxDistance) {
                maxDistance = distance;
            }

            // Increment reference count for referenced token
            _refCount[refTokenId]++;
            emit RefCountUpdated(refTokenId, _refCount[refTokenId]);

            // Track unique referrers (params.to is the token recipient/referrer)
            if (!_hasReferenced[refTokenId][params.to]) {
                _hasReferenced[refTokenId][params.to] = true;
                _uniqueRefCount[refTokenId]++;
                emit UniqueRefCountUpdated(refTokenId, _uniqueRefCount[refTokenId]);
            }

            unchecked { ++i; }
        }

        // New token generation = max parent generation + 1
        uint256 newGeneration = maxGeneration + 1;

        // Get the tree from the first referenced token (all should be in same tree)
        DecodedTokenData memory firstRefData = decodeTokenId(params.refTokenIds[0]);
        uint256 tree = firstRefData.tree;

        // Check TreeIndex limit (max 1000 tokens per tree: 0-999)
        if (_treeCounter[tree] >= 1000) revert TooManyTokensInTree();

        // Mint the token (tokenId already generated above)
        _safeMint(params.to, tokenId);

        // Store tree, generation, elevation, and colorIndex in mappings (coordinates are encoded in tokenId)
        _tokenTrees[tokenId] = tree;
        _tokenGenerations[tokenId] = newGeneration;
        _tokenElevations[tokenId] = params.elevation;
        _tokenColorIndexes[tokenId] = params.colorIndex;

        // Set tree index
        tokenTreeIndex[tokenId] = _treeCounter[tree];
        _treeCounter[tree]++;

        // Record creation timestamp
        _createdTimestamps[address(this)][tokenId] = block.timestamp;

        // Store text
        _setText(tokenId, params.message);

        // Set up ERC-5521 references
        address[] memory addresses = new address[](1);
        addresses[0] = address(this);

        uint256[][] memory tokenIdsArray = new uint256[][](1);
        tokenIdsArray[0] = params.refTokenIds;

        // Use internal function to bypass ownership check (token just minted)
        _setNodeReferringInternal(addresses, tokenId, tokenIdsArray, params.to);
        setNodeReferred(addresses, tokenId, tokenIdsArray);

        // Mark the initial reference (to protect from removal)
        _initialBaseTokenId[tokenId] = params.refTokenIds[0];

        // Get the parent token owner for event emission
        address from = ownerOf(params.refTokenIds[0]);

        // Emit FumiMinted FIRST to create token in Subgraph
        // handleFumiMinted creates the Token entity with all required H3 data
        emit FumiMinted(tokenId, params.to, from, params.message, h3.h3r6, h3.h3r8, h3.h3r10, h3.h3r12);

        // Emit ReferenceCreated AFTER FumiMinted
        // This ensures fromToken exists when handleReferenceCreated runs in Subgraph
        // (The Graph processes events in logIndex order within a transaction)
        for (uint256 i = 0; i < refCount; ) {
            emit ReferenceCreated(tokenId, params.refTokenIds[i], distances[i], i == 0);
            unchecked { ++i; }
        }

        return tokenId;
    }

    // =========================
    // ERC-5521 Implementation
    // =========================

    /// @notice Set both referring and referred relationships
    /// @param tokenId Token ID to set relationships for
    /// @param addresses Array of contract addresses
    /// @param tokenIds Array of token ID arrays for each address
    function setNode(
        uint256 tokenId,
        address[] memory addresses,
        uint256[][] memory tokenIds
    ) public override {
        if (addresses.length != tokenIds.length) revert MismatchedLengths();

        setNodeReferring(addresses, tokenId, tokenIds);
        setNodeReferred(addresses, tokenId, tokenIds);
    }

    /// @notice Set tokens that this token refers to
    /// @param addresses Array of contract addresses
    /// @param tokenId Token ID setting the references
    /// @param tokenIds Array of token ID arrays for each address
    function setNodeReferring(
        address[] memory addresses,
        uint256 tokenId,
        uint256[][] memory tokenIds
    ) public override whenNotPaused {
        address owner = ownerOf(tokenId);
        // Check if caller is owner or approved
        if (
            msg.sender != owner &&
            getApproved(tokenId) != msg.sender &&
            !isApprovedForAll(owner, msg.sender)
        ) revert NotOwnerNorApproved();

        _setNodeReferringInternal(addresses, tokenId, tokenIds, msg.sender);
    }

    /// @dev Internal function to set referring relationships without ownership check
    function _setNodeReferringInternal(
        address[] memory addresses,
        uint256 tokenId,
        uint256[][] memory tokenIds,
        address emitter
    ) internal {
        uint256 initialBaseToken = _initialBaseTokenId[tokenId];

        uint256 addrCount = addresses.length;
        for (uint256 i = 0; i < addrCount; ) {
            // If there's an initial reference, ensure it's not being removed
            if (initialBaseToken != 0 && addresses[i] == address(this)) {
                bool initialReferenceExists = false;
                uint256 tokenIdCount = tokenIds[i].length;
                for (uint256 j = 0; j < tokenIdCount; j++) {
                    if (tokenIds[i][j] == initialBaseToken) {
                        initialReferenceExists = true;
                        break;
                    }
                }
                if (!initialReferenceExists) revert InitialReferenceCannotBeRemoved();
            }

            // Validate external contracts (skip self-references)
            if (addresses[i] != address(this)) {
                _validateExternalContract(addresses[i]);
                _validateExternalTokens(addresses[i], tokenIds[i]);
            }

            if (_referringKeys[address(this)][tokenId].length == 0 ||
                !_arrayContains(_referringKeys[address(this)][tokenId], addresses[i])) {
                _referringKeys[address(this)][tokenId].push(addresses[i]);
            }
            _referringValues[address(this)][tokenId][addresses[i]] = tokenIds[i];

            unchecked { ++i; }
        }

        _createdTimestamps[address(this)][tokenId] = block.timestamp;
        _emitUpdate(tokenId, emitter);
    }

    /// @notice Set tokens that refer to this token
    /// @param addresses Array of contract addresses
    /// @param tokenId Token ID being referred to
    /// @param tokenIds Array of token ID arrays for each address
    function setNodeReferred(
        address[] memory addresses,
        uint256 tokenId,
        uint256[][] memory tokenIds
    ) public override whenNotPaused {
        uint256 addrCount = addresses.length;
        for (uint256 i = 0; i < addrCount; ) {
            uint256 tokenIdCount = tokenIds[i].length;
            for (uint256 j = 0; j < tokenIdCount; ) {
                uint256 other = tokenIds[i][j];

                // Only check ownership for tokens in this contract
                if (addresses[i] == address(this)) {
                    ownerOf(other); // Existence check
                }

                if (_referredKeys[address(this)][other].length == 0 ||
                    !_arrayContains(_referredKeys[address(this)][other], address(this))) {
                    _referredKeys[address(this)][other].push(address(this));
                }

                _referredValues[address(this)][other][address(this)].push(tokenId);

                // Only emit update for tokens in this contract
                if (addresses[i] == address(this)) {
                    _emitUpdate(other, ownerOf(other));
                }

                unchecked { ++j; }
            }

            // Emit MetadataUpdate for tokens in this contract (EIP-4906)
            // Note: This updates the ERC-5521 reference mappings only.
            // The _refCount is only updated via mintWithChain/signedMintWithChain.
            if (addresses[i] == address(this)) {
                _emitMetadataUpdatesForTokens(address(this), tokenIds[i]);
            }

            unchecked { ++i; }
        }
    }

    /// @notice External contracts can mark themselves as referred
    /// @param target Target ERC-5521 contract
    /// @param tokenId This token's ID
    /// @param tokenIds Reference information
    function setNodeReferredExternal(
        address target,
        uint256 tokenId,
        uint256[][] calldata tokenIds
    ) external override {
        if (!IERC165(target).supportsInterface(type(IERC5521).interfaceId)) {
            revert NotERC5521();
        }

        IERC5521(target).setNodeReferredExternal(address(this), tokenId, tokenIds);
    }

    /// @notice Get tokens that this token refers to
    /// @param target Target contract address
    /// @param tokenId Token ID to query
    /// @return addresses Array of referred contract addresses
    /// @return tokenIds Array of referred token IDs for each address
    function referringOf(
        address target,
        uint256 tokenId
    ) public view override returns (address[] memory, uint256[][] memory) {
        if (target == address(this)) {
            ownerOf(tokenId); // Existence check
            return _convertMap(tokenId, true);
        } else {
            return _safeExternalReferringOf(target, tokenId);
        }
    }

    /// @notice Get tokens that refer to this token
    /// @param target Target contract address
    /// @param tokenId Token ID to query
    /// @return addresses Array of referring contract addresses
    /// @return tokenIds Array of referring token IDs for each address
    function referredOf(
        address target,
        uint256 tokenId
    ) external view override returns (address[] memory, uint256[][] memory) {
        if (target == address(this)) {
            ownerOf(tokenId); // Existence check
            return _convertMap(tokenId, false);
        } else {
            return _safeExternalReferredOf(target, tokenId);
        }
    }

    /// @notice Get creation timestamp of reference relationship
    /// @param target Target contract address
    /// @param tokenId Token ID to query
    /// @return timestamp Block timestamp
    function createdTimestampOf(
        address target,
        uint256 tokenId
    ) external view override returns (uint256) {
        if (target == address(this)) {
            ownerOf(tokenId); // Existence check
            return _createdTimestamps[address(this)][tokenId];
        } else {
            return IERC5521(target).createdTimestampOf(address(this), tokenId);
        }
    }

    /// @dev Emit UpdateNode event
    function _emitUpdate(uint256 tokenId, address sender) private {
        (address[] memory rK, uint256[][] memory rV) = _convertMap(tokenId, true);
        (address[] memory dK, uint256[][] memory dV) = _convertMap(tokenId, false);

        emit UpdateNode(tokenId, sender, rK, rV, dK, dV);
    }

    /// @dev Convert internal ERC-5521 mapping structure to arrays for external queries
    /// @param tokenId Token ID to query relationships for
    /// @param isReferring True for referring relationships, false for referred relationships
    /// @return addresses Array of contract addresses in the relationship
    /// @return tokenIds 2D array of token IDs for each contract address
    function _convertMap(
        uint256 tokenId,
        bool isReferring
    ) private view returns (address[] memory, uint256[][] memory) {
        address[] memory keys = isReferring
            ? _referringKeys[address(this)][tokenId]
            : _referredKeys[address(this)][tokenId];
        uint256[][] memory vals = new uint256[][](keys.length);

        for (uint256 i = 0; i < keys.length; i++) {
            vals[i] = isReferring
                ? _referringValues[address(this)][tokenId][keys[i]]
                : _referredValues[address(this)][tokenId][keys[i]];
        }

        return (keys, vals);
    }

    /// @dev Check if address array contains a specific element
    /// Linear search O(n) - suitable for small arrays
    /// @param array Array of addresses to search
    /// @param element Address to search for
    /// @return True if element is found in array, false otherwise
    function _arrayContains(
        address[] memory array,
        address element
    ) private pure returns (bool) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == element) {
                return true;
            }
        }
        return false;
    }

    // =========================
    // Text Storage (SSTORE2)
    // =========================

    /// @notice Get text stored with token
    /// @param tokenId Token ID to query
    /// @return s The stored text
    function textOf(uint256 tokenId) public view returns (string memory s) {
        _requireOwned(tokenId);
        uint256 meta = _textPtrMeta[tokenId];

        if (meta != 0) {
            // Pointer mode
            address ptr = address(uint160(meta));
            bytes memory data = SSTORE2.read(ptr);
            return string(data);
        }

        Packed54 memory p = _textInline[tokenId];
        uint256 len = p.w1 >> 248; // long: length stored in w1's top byte

        if (len == 0) {
            // short (≤31B): length in w0's top byte
            len = p.w0 >> 248;
            s = new string(len);
            assembly {
                mstore(s, len)
                mstore(add(s, 32), shl(8, mload(add(p, 0))))
            }
        } else {
            // long (32–54B)
            s = new string(len);
            assembly {
                mstore(s, len)
                mstore(add(s, 32), mload(add(p, 0)))
                let rem := sub(len, 32)
                let mask := sub(shl(mul(8, rem), 1), 1)
                let data := and(mload(add(p, 32)), mask)
                let sh := mul(8, sub(32, rem))
                mstore(add(s, 64), shl(sh, data))
            }
        }
    }

    /// @notice Get text metadata for gas-efficient queries
    /// @param tokenId Token ID to query
    /// @return isPtr True if using pointer storage
    /// @return byteLen UTF-8 byte length
    /// @return charLen UTF-8 code point count
    function textMetaOf(
        uint256 tokenId
    ) public view returns (bool isPtr, uint256 byteLen, uint256 charLen) {
        _requireOwned(tokenId);
        uint256 meta = _textPtrMeta[tokenId];

        if (meta != 0) {
            isPtr = true;
            bytes memory data = SSTORE2.read(address(uint160(meta)));
            byteLen = data.length;
            charLen = meta >> 160;
            return (isPtr, byteLen, charLen);
        }

        // Inline: rebuild and count
        string memory s = textOf(tokenId);
        bytes memory b = bytes(s);
        byteLen = b.length;
        charLen = _utf8CodePointCount(b);
        return (false, byteLen, charLen);
    }

    /// @dev Set text during minting (cannot be updated)
    function _setText(uint256 tokenId, string memory s) internal {
        bytes memory b = bytes(s);
        uint256 charLen = _utf8CodePointCount(b);
        if (charLen > 54) revert TextTooLong();

        if (b.length <= 54) {
            // Inline mode (≤54 bytes)
            uint256 w0;
            uint256 w1;
            assembly {
                let len := mload(b)
                switch lt(len, 32)
                case 1 {
                    // short: w0 = (len<<248) | (data >> 8)
                    w0 := or(shl(248, len), shr(8, mload(add(b, 32))))
                    w1 := 0
                }
                default {
                    // long: w0 = first 32B, w1 = (len<<248) | remaining right-aligned
                    w0 := mload(add(b, 32))
                    let rem := sub(len, 32)
                    let sh := mul(8, sub(32, rem))
                    w1 := or(shl(248, len), shr(sh, mload(add(b, 64))))
                }
            }
            _textInline[tokenId] = Packed54(w0, w1);
            _textPtrMeta[tokenId] = 0;
        } else {
            // Pointer mode (≥55B): store into code via SSTORE2
            address ptr = SSTORE2.write(b);
            _textPtrMeta[tokenId] = (uint256(charLen) << 160) | uint160(ptr);
            delete _textInline[tokenId];
        }
    }

    /// @dev Count UTF-8 code points (fast, non-validating)
    function _utf8CodePointCount(bytes memory b) internal pure returns (uint256 n) {
        uint256 i;
        uint256 len = b.length;
        while (i < len) {
            uint8 c;
            assembly {
                c := byte(0, mload(add(b, add(32, i))))
            }
            unchecked {
                i++;
                n++;
            }
            if (c < 0x80) {
                // 1B
            } else if (c < 0xE0) {
                i += 1; // 2B total
            } else if (c < 0xF0) {
                i += 2; // 3B total
            } else {
                i += 3; // 4B total
            }
        }
    }

    // =========================
    // Helper Functions
    // =========================

    /// @notice Get tree ID from tokenId
    /// @dev Optimized to read directly from mapping instead of full decodeTokenId
    function getTree(uint256 tokenId) public view returns (uint256) {
        _requireOwned(tokenId);
        return _tokenTrees[tokenId];
    }

    /// @notice Get generation from tokenId
    /// @dev Optimized to read directly from mapping instead of full decodeTokenId
    function getGeneration(uint256 tokenId) public view returns (uint256) {
        _requireOwned(tokenId);
        return _tokenGenerations[tokenId];
    }

    /// @notice Get total distance traveled for a token
    /// @dev Returns the maximum distance to any direct child
    /// This allows SVG to distinguish tokens with descendants from those without
    /// For full descendant distance sum, use Subgraph's totalDistance field
    /// @param tokenId Token ID to query
    /// @return Maximum distance in meters to any direct child (0 if no children)
    function totalDistanceOf(uint256 tokenId) public view returns (uint256) {
        // Validation: ensure token exists
        _requireOwned(tokenId);

        // Return max distance to any direct child
        // Tokens with no children will have 0
        // Tokens with children will have > 0
        return _maxChildDistance[tokenId];
    }

    /// @notice Get reference count for a token
    /// @param tokenId Token ID to query
    /// @return Number of tokens referring to this token
    function refCountOf(uint256 tokenId) public view returns (uint256) {
        return _refCount[tokenId];
    }

    /// @notice Get unique referrer count for a token
    /// @param tokenId Token ID to query
    /// @return Number of unique users who have referenced this token
    function uniqueRefCountOf(uint256 tokenId) public view returns (uint256) {
        return _uniqueRefCount[tokenId];
    }

    /// @notice Check if a reference to a token is still valid
    /// @dev Useful for detecting burned or non-existent tokens in reference chains
    /// For self-references, checks if token exists in this contract.
    /// For external references, checks code size first, then uses SafeExternalCall to query ownerOf with gas limits.
    /// @param contractAddr The contract address to check
    /// @param tokenId The token ID to check
    /// @return bool True if the reference is valid (token exists and is not burned)
    function isReferenceValid(
        address contractAddr,
        uint256 tokenId
    ) external view returns (bool) {
        if (contractAddr == address(this)) {
            // For self-references, use _ownerOf which returns address(0) for non-existent tokens
            return _ownerOf(tokenId) != address(0);
        } else {
            // For external contracts, first check if there's code at the address
            if (contractAddr.code.length == 0) {
                return false;
            }

            // Use SafeExternalCall to query ownerOf
            bytes memory data = abi.encodeWithSelector(
                IERC721.ownerOf.selector,
                tokenId
            );
            (bool success, ) = contractAddr.safeStaticCall(
                EXTERNAL_CALL_GAS_LIMIT,
                MAX_COPY_BYTES,
                data
            );
            return success;
        }
    }

    // =========================
    // Metadata
    // =========================

    /// @inheritdoc ERC721
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        // Decode tokenId to get parameters
        DecodedTokenData memory data = decodeTokenId(tokenId);

        // Get stored text message
        string memory message = textOf(tokenId);

        // Get creation timestamp
        uint256 timestamp = _createdTimestamps[address(this)][tokenId];

        // Calculate reference color index (if has references)
        uint256 referenceColorIndex = _calculateReferenceColorIndex(tokenId);

        // Get total distance (calculated dynamically from tree)
        uint256 totalDistance = totalDistanceOf(tokenId);

        // Get reference count
        uint256 refCount = _refCount[tokenId];

        // Get unique referrer count
        uint256 uniqueRefCount = _uniqueRefCount[tokenId];

        // Get parent's reference count
        uint256 parentRefCount = _getParentRefCount(tokenId);

        // Generate SVG via Fumi
        IFumi.TokenSVGParams memory params = IFumi.TokenSVGParams({
            tokenId: tokenId,
            colorIndex: data.colorIndex,
            referenceColorIndex: referenceColorIndex,
            totalDistance: totalDistance,
            createdTimestamp: timestamp,
            message: message,
            generation: data.generation,
            treeIndex: tokenTreeIndex[tokenId],
            refCountValue: refCount,
            parentRefCount: parentRefCount,
            tree: data.tree
        });

        string memory svg = fumi.tokenSVG(params);

        // Build metadata via GeoMetadata contract
        IGeoMetadata.TokenMetadataParams memory metadataParams = IGeoMetadata.TokenMetadataParams({
            latitude: data.latitude,
            longitude: data.longitude,
            elevation: data.elevation,
            generation: data.generation,
            totalDistance: totalDistance,
            refCount: refCount,
            uniqueRefCount: uniqueRefCount,
            parentRefCount: parentRefCount
        });

        // Build JSON metadata
        bytes memory json = abi.encodePacked(
            '{"name":"NOROSI #',
            Strings.toString(tokenId),
            '","description":"',
            geoMetadata.buildDescription(metadataParams),
            '","external_url":"',
            _externalUrlBase,
            Strings.toString(tokenId),
            '","background_color":"FFFFFF","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[',
            geoMetadata.buildAttributes(metadataParams),
            ']}'
        );

        // Return as data URI
        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(json)
            )
        );
    }

    /// @notice Contract-level metadata for OpenSea
    function contractURI() public view returns (string memory) {
        return geoMetadata.buildContractURI(owner());
    }

    // =========================
    // Pausable
    // =========================

    /// @notice Pause contract (owner only)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause contract (owner only)
    function unpause() external onlyOwner {
        _unpause();
    }

    // =========================
    // Required Overrides
    // =========================

    /// @inheritdoc ERC721
    /// @dev OpenZeppelin ERC721 v5 prevents burning by reverting with ERC721InvalidReceiver
    /// when attempting to transfer to address(0). This behavior is inherited from the base
    /// ERC721 contract and cannot be overridden as transferFrom/safeTransferFrom are not virtual.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    /// @inheritdoc ERC721
    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    /// @inheritdoc IERC165
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable, IERC165, IERC5521) returns (bool) {
        return
            interfaceId == 0x9f585a87 || // ERC-5521: Referable NFT
            interfaceId == 0x49064906 || // EIP-4906: Metadata Update Extension
            super.supportsInterface(interfaceId);
    }

    // =========================
    // Input Validation Helpers
    // =========================

    /// @dev Validate coordinate values are within valid geographic bounds
    /// @param latitude Latitude in millionths of degrees (±90 million max)
    /// @param longitude Longitude in millionths of degrees (±180 million max)
    function _validateCoordinates(int256 latitude, int256 longitude) internal pure {
        if (latitude < MIN_LAT || latitude > MAX_LAT) revert InvalidLatitude();
        if (longitude < MIN_LON || longitude > MAX_LON) revert InvalidLongitude();
    }

    // =========================
    // Internal Helpers
    // =========================

    /// @dev Get the first referring token ID (first parent NFT)
    /// @param tokenId The token ID to check
    /// @return hasReferringToken Whether the token has a referring token
    /// @return firstReferringTokenId The first referring token ID (if exists)
    function _getFirstReferringTokenId(uint256 tokenId)
        internal
        view
        returns (bool hasReferringToken, uint256 firstReferringTokenId)
    {
        (address[] memory addresses, uint256[][] memory tokenIds) =
            referringOf(address(this), tokenId);

        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] == address(this) && tokenIds[i].length > 0) {
                return (true, tokenIds[i][0]);
            }
        }
        return (false, 0);
    }

    /// @dev Get the reference count of the parent token
    /// @param tokenId The token ID to check
    /// @return The refCount of the parent token, or 0 if no parent exists
    function _getParentRefCount(uint256 tokenId) internal view returns (uint256) {
        (bool hasReferringToken, uint256 parentTokenId) =
            _getFirstReferringTokenId(tokenId);

        if (hasReferringToken && _ownerOf(parentTokenId) != address(0)) {
            return _refCount[parentTokenId];
        }

        return 0;
    }

    /// @dev Calculate reference color index from the first parent NFT's coordinates
    /// Like the original Norosi.sol, use the color index of the first referring token
    /// Color index is auto-calculated from latitude/longitude using _calculateColorIndex
    function _calculateReferenceColorIndex(uint256 tokenId) internal view returns (uint256) {
        // Get current token's color index as default
        DecodedTokenData memory tokenData = decodeTokenId(tokenId);
        uint256 referenceColorIndex = tokenData.colorIndex;

        // Get first referring token (parent NFT)
        (bool hasReferringToken, uint256 firstReferringTokenId) =
            _getFirstReferringTokenId(tokenId);

        // If has parent and parent exists, use parent's color index
        if (hasReferringToken && _ownerOf(firstReferringTokenId) != address(0)) {
            DecodedTokenData memory parentData = decodeTokenId(firstReferringTokenId);
            // Use parent's stored color index
            referenceColorIndex = parentData.colorIndex;
        }

        return referenceColorIndex;
    }

    // =========================
    // Safe External Reference Retrieval
    // =========================

    /// @dev Safely query external ERC-5521 contract for reference relationships
    /// Implements defensive programming with gas limits and data validation
    /// @param target External contract address to query
    /// @param selector Function selector (referringOf or referredOf)
    /// @param tokenId Token ID to query relationships for
    /// @return addresses Array of contract addresses (empty on failure)
    /// @return tokenIds Array of token ID arrays (empty on failure)
    function _safeExternalQuery(
        address target,
        bytes4 selector,
        uint256 tokenId
    ) private view returns (address[] memory, uint256[][] memory) {
        bytes memory data = abi.encodeWithSelector(
            selector,
            address(this),
            tokenId
        );

        (bool success, bytes memory returnData) = target.safeStaticCall(
            EXTERNAL_CALL_GAS_LIMIT,
            MAX_COPY_BYTES,
            data
        );

        if (!success) {
            return (new address[](0), new uint256[][](0));
        }

        try this._decodeReferenceData(returnData) returns (
            address[] memory addrs,
            uint256[][] memory ids
        ) {
            if (!_isValidReferenceData(addrs, ids)) {
                return (new address[](0), new uint256[][](0));
            }
            return (addrs, ids);
        } catch {
            return (new address[](0), new uint256[][](0));
        }
    }

    /// @dev Safely retrieve referring relationships from external contract
    /// @param target External contract address
    /// @param tokenId Token ID to query
    /// @return addresses Array of referring contract addresses
    /// @return tokenIds Array of referring token IDs
    function _safeExternalReferringOf(
        address target,
        uint256 tokenId
    ) private view returns (address[] memory, uint256[][] memory) {
        return _safeExternalQuery(target, IERC5521.referringOf.selector, tokenId);
    }

    /// @dev Safely retrieve referred relationships from external contract
    /// @param target External contract address
    /// @param tokenId Token ID to query
    /// @return addresses Array of referred contract addresses
    /// @return tokenIds Array of referred token IDs
    function _safeExternalReferredOf(
        address target,
        uint256 tokenId
    ) private view returns (address[] memory, uint256[][] memory) {
        return _safeExternalQuery(target, IERC5521.referredOf.selector, tokenId);
    }

    /// @dev Decode reference data from external contract (external for try-catch)
    function _decodeReferenceData(
        bytes calldata data
    ) external pure returns (address[] memory, uint256[][] memory) {
        return abi.decode(data, (address[], uint256[][]));
    }

    /// @dev Validate reference data structure
    function _isValidReferenceData(
        address[] memory addrs,
        uint256[][] memory ids
    ) private pure returns (bool) {
        return addrs.length == ids.length && addrs.length <= MAX_REFERENCES;
    }

    // =========================
    // External NFT Validation
    // =========================

    /// @dev Validate external contract safety
    function _validateExternalContract(address target) private view {
        // 1. Check if target is a contract
        if (target.code.length == 0) revert NotAContract();

        // 2. Check ERC-165 support (with gas limit)
        try IERC165(target).supportsInterface{gas: INTERFACE_CHECK_GAS}(
            type(IERC165).interfaceId
        ) returns (bool supported) {
            if (!supported) revert NoERC165Support();
        } catch {
            revert NoERC165Support();
        }

        // 3. Optional: Check ERC-5521 support (for bidirectional references)
        // Note: We don't enforce ERC-5521 support as it's optional
        try IERC165(target).supportsInterface{gas: INTERFACE_CHECK_GAS}(
            type(IERC5521).interfaceId
        ) returns (bool) {
            // Check only, don't enforce
        } catch {
            // Silently ignore if check fails
        }
    }

    /// @dev Validate external tokens exist
    function _validateExternalTokens(
        address target,
        uint256[] memory tokenIdArray
    ) private view {
        if (tokenIdArray.length > MAX_REFERENCES) revert TooManyReferences();

        // Check each token exists (with gas limit)
        uint256 len = tokenIdArray.length;
        for (uint256 i = 0; i < len; ) {
            try IERC721(target).ownerOf{gas: INTERFACE_CHECK_GAS}(tokenIdArray[i])
                returns (address) {
                // Token exists, continue
            } catch {
                revert ExternalTokenNotFound();
            }

            unchecked { ++i; }
        }
    }

    // =========================
    // EIP-4906 Metadata Update Helpers
    // =========================

    /// @dev Emit MetadataUpdate events for an array of token IDs (EIP-4906)
    /// @notice Only emits for tokens belonging to this contract (address(this))
    /// @param contractAddr The contract address of the tokens
    /// @param tokenIds Array of token IDs whose metadata has been updated
    function _emitMetadataUpdatesForTokens(
        address contractAddr,
        uint256[] memory tokenIds
    ) internal {
        // Only emit for this contract's tokens (not external references)
        if (contractAddr != address(this)) return;

        uint256 len = tokenIds.length;
        for (uint256 i = 0; i < len; ) {
            emit MetadataUpdate(tokenIds[i]);
            unchecked { ++i; }
        }
    }

}
