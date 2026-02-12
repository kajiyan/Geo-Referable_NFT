// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGeoMetadata {
    /// @dev Parameters for building token metadata
    struct TokenMetadataParams {
        int256 latitude;
        int256 longitude;
        int256 elevation;
        uint256 generation;
        uint256 totalDistance;
        uint256 refCount;
        uint256 uniqueRefCount;  // Unique referrer count
        uint256 parentRefCount;  // Reference count of parent token
    }

    /// @notice Build description string for token metadata
    /// @param params Token metadata parameters
    /// @return Description string
    function buildDescription(TokenMetadataParams calldata params)
        external
        pure
        returns (string memory);

    /// @notice Build attributes JSON array for token metadata
    /// @param params Token metadata parameters
    /// @return Attributes JSON string
    function buildAttributes(TokenMetadataParams calldata params)
        external
        pure
        returns (string memory);

    /// @notice Build contract-level metadata for OpenSea
    /// @param owner Contract owner address for fee recipient
    /// @return Contract URI as data URI
    function buildContractURI(address owner)
        external
        pure
        returns (string memory);
}
