// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "../interfaces/IGeoMetadata.sol";

/// @title GeoMetadata
/// @notice Enhanced metadata formatting for GeoReferableNFT with gas optimizations and richer content
/// @dev Provides coordinate formatting, attribute generation, and rarity calculation
/// @author GeoReferableNFT Team
contract GeoMetadata is IGeoMetadata {
    // ============================================
    // CONSTANTS: Precision & Conversion
    // ============================================

    /// @dev Coordinate precision: values stored as millionths of degree
    uint256 private constant COORD_PRECISION = 1e6;

    /// @dev Elevation precision: values stored as ten-thousandths of meter
    uint256 private constant ELEVATION_PRECISION = 1e4;

    /// @dev Conversion factor from meters to kilometers
    uint256 private constant METERS_TO_KM = 1000;

    /// @dev Number of decimal places for coordinate formatting
    uint256 private constant COORD_DECIMAL_PLACES = 4;

    // ============================================
    // CONSTANTS: Elevation Thresholds (meters)
    // ============================================

    /// @dev Deep ocean threshold (-1000m and below)
    int256 private constant DEEP_OCEAN_THRESHOLD = -1000;

    /// @dev Sea level reference point
    int256 private constant SEA_LEVEL = 0;

    /// @dev Lowland threshold (0-500m)
    int256 private constant LOWLAND_THRESHOLD = 500;

    /// @dev Highland threshold (500-2000m)
    int256 private constant HIGHLAND_THRESHOLD = 2000;

    /// @dev Mountain threshold (2000-5000m)
    int256 private constant MOUNTAIN_THRESHOLD = 5000;

    /// @dev Extreme elevation threshold for special scoring
    int256 private constant EXTREME_HIGH_ELEVATION = 8000;      // Near Everest
    int256 private constant EXTREME_LOW_ELEVATION = -10000;     // Near Mariana Trench

    // ============================================
    // CONSTANTS: Distance Thresholds (kilometers)
    // ============================================

    /// @dev Ultra-long distance threshold (3,000+ km) - intercontinental
    uint256 private constant ULTRA_DISTANCE_THRESHOLD = 3000;

    /// @dev Long distance threshold (2,000-3,000 km) - cross-country
    uint256 private constant LONG_DISTANCE_THRESHOLD = 2000;

    /// @dev Medium distance threshold (1,000-2,000 km) - regional
    uint256 private constant MEDIUM_DISTANCE_THRESHOLD = 1000;

    /// @dev Short distance threshold (500-1,000 km) - inter-city
    uint256 private constant SHORT_DISTANCE_THRESHOLD = 500;

    // ============================================
    // CONSTANTS: Network Thresholds (Unique Referrer-based)
    // ============================================

    /// @dev Legendary unique referrer threshold (50+ users) - maximum score
    uint256 private constant LEGENDARY_UNIQUE_REFS = 50;

    /// @dev Elite unique referrer threshold (20-49 users) - very high score
    uint256 private constant ELITE_UNIQUE_REFS = 20;

    /// @dev High unique referrer threshold (10-19 users) - high score
    uint256 private constant HIGH_UNIQUE_REFS = 10;

    /// @dev Medium unique referrer threshold (5-9 users) - medium score
    uint256 private constant MEDIUM_UNIQUE_REFS = 5;

    /// @dev Low unique referrer threshold (2-4 users) - early reward
    uint256 private constant LOW_UNIQUE_REFS = 2;

    // ============================================
    // CONSTANTS: Diversity Bonus Thresholds
    // ============================================

    /// @dev High diversity ratio threshold (80%+ unique referrers)
    uint256 private constant HIGH_DIVERSITY_RATIO = 80;

    /// @dev Medium diversity ratio threshold (50%+ unique referrers)
    uint256 private constant MEDIUM_DIVERSITY_RATIO = 50;

    /// @dev High generation threshold (50+ generations) - ancient lineage
    uint256 private constant HIGH_GEN_THRESHOLD = 50;

    // ============================================
    // CONSTANTS: Rarity Score Thresholds
    // ============================================

    /// @dev Mythic rarity minimum score (10+ points)
    uint256 private constant MYTHIC_SCORE_THRESHOLD = 10;

    /// @dev Legendary rarity minimum score (8-9 points)
    uint256 private constant LEGENDARY_SCORE_THRESHOLD = 8;

    /// @dev Epic rarity minimum score (5-7 points)
    uint256 private constant EPIC_SCORE_THRESHOLD = 5;

    /// @dev Rare rarity minimum score (3-4 points)
    uint256 private constant RARE_SCORE_THRESHOLD = 3;

    // Common: 0-2 points (no threshold needed)

    // ============================================
    // CONSTANTS: Geographic References
    // ============================================

    /// @dev Pole latitude threshold (≥85° or ≤-85° considered polar)
    int256 private constant POLE_LATITUDE_THRESHOLD = 85_000000;

    /// @dev Tropical zone latitude threshold (±23.5°)
    int256 private constant TROPICAL_ZONE_THRESHOLD = 23_500000;

    /// @dev Temperate zone latitude threshold (±66.5°)
    int256 private constant TEMPERATE_ZONE_THRESHOLD = 66_500000;

    // ============================================
    // PUBLIC FUNCTIONS: Main Interface
    // ============================================

    /// @inheritdoc IGeoMetadata
    /// @dev Generates compact description format for gas efficiency
    /// @dev Format: "35.6789N,138.7274E 3776m G1 1r 0k"
    function buildDescription(TokenMetadataParams calldata params)
        external
        pure
        override
        returns (string memory)
    {
        return _buildCompactDescription(params);
    }

    /// @inheritdoc IGeoMetadata
    /// @dev Builds OpenSea-compatible attributes array with enhanced metadata
    function buildAttributes(TokenMetadataParams calldata params)
        external
        pure
        override
        returns (string memory)
    {
        // Pre-calculate meters/kilometers for reuse
        int256 metersElevation = params.elevation / int256(ELEVATION_PRECISION);
        uint256 kilometersDistance = params.totalDistance / METERS_TO_KM;

        // Calculate rarity once (using unique referrer count for scoring)
        uint256 rarityScore = _calculateRarityScore(
            metersElevation,
            kilometersDistance,
            params.refCount,
            params.uniqueRefCount,
            params.generation,
            params.latitude
        );
        string memory rarityTier = _scoreToTier(rarityScore);

        // Build attributes using optimized concatenation
        return string(
            abi.encodePacked(
                _buildCoreAttributes(params.latitude, params.longitude, metersElevation),
                ",",
                _buildNetworkAttributes(params.generation, kilometersDistance, params.refCount, params.uniqueRefCount, params.parentRefCount),
                ",",
                _buildGeographicAttributes(params.latitude, metersElevation),
                ",",
                _buildRarityAttribute(rarityTier)
            )
        );
    }

    /// @inheritdoc IGeoMetadata
    /// @dev Generates collection-level metadata for OpenSea
    function buildContractURI(address owner)
        external
        pure
        override
        returns (string memory)
    {
        bytes memory json = abi.encodePacked(
            '{"name":"NOROSI",',
            '"description":"A global network of geo-location NFTs. Each token marks a unique coordinate on Earth, forming chains of exploration and discovery across the world.",',
            '"image":"https://norosi.xyz/collection.png",',
            '"banner_image":"https://norosi.xyz/banner.png",',
            '"featured_image":"https://norosi.xyz/featured.png",',
            '"external_link":"https://norosi.xyz",',
            '"seller_fee_basis_points":250,',
            '"fee_recipient":"', Strings.toHexString(uint160(owner), 20), '"}'
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(json)
            )
        );
    }

    // ============================================
    // INTERNAL: Description Builders
    // ============================================

    /// @dev Builds compact description format (current default)
    /// @dev Format: "lat,lon elevM [Ggen] [refsR distK]"
    /// @param params Token metadata parameters
    /// @return Compact description string
    function _buildCompactDescription(TokenMetadataParams calldata params)
        internal
        pure
        returns (string memory)
    {
        bytes memory desc = abi.encodePacked(
            _formatCoordinate(params.latitude, true),
            ",",
            _formatCoordinate(params.longitude, false),
            " ",
            _elevationToMeters(params.elevation),
            "m"
        );

        if (params.generation > 0) {
            desc = abi.encodePacked(desc, " G", Strings.toString(params.generation));
        }

        if (params.refCount > 0) {
            desc = abi.encodePacked(
                desc,
                " ",
                Strings.toString(params.refCount),
                "r ",
                Strings.toString(params.totalDistance / METERS_TO_KM),
                ".",
                Strings.toString((params.totalDistance / 100) % 10),
                "km"
            );
        }

        return string(desc);
    }

    // ============================================
    // INTERNAL: Attribute Builders (Optimized)
    // ============================================

    /// @dev Builds core geographic attributes (Lat, Lon, Elevation)
    /// @param latitude Latitude in millionths of degree
    /// @param longitude Longitude in millionths of degree
    /// @param metersElevation Pre-calculated elevation in meters
    /// @return JSON string of core attributes
    function _buildCoreAttributes(int256 latitude, int256 longitude, int256 metersElevation)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            '{"trait_type":"Lat","value":"',
            _formatCoordinate(latitude, true),
            '"},{"trait_type":"Lon","value":"',
            _formatCoordinate(longitude, false),
            '"},{"display_type":"number","trait_type":"Elev(m)","value":',
            _elevationToMeters(metersElevation * int256(ELEVATION_PRECISION)),
            ',"max_value":8849}'
        );
    }

    /// @dev Builds network-related attributes (Generation, Distance, References, Unique Refs, Parent Refs)
    /// @param generation Generation number
    /// @param kilometersDistance Pre-calculated distance in kilometers
    /// @param refCount Number of references
    /// @param uniqueRefCount Number of unique referrers
    /// @param parentRefCount Number of references on parent token
    /// @return JSON string of network attributes
    function _buildNetworkAttributes(uint256 generation, uint256 kilometersDistance, uint256 refCount, uint256 uniqueRefCount, uint256 parentRefCount)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            '{"display_type":"number","trait_type":"Gen","value":',
            Strings.toString(generation),
            '},{"display_type":"boost_number","trait_type":"Dist(km)","value":',
            Strings.toString(kilometersDistance),
            '},{"trait_type":"Refs","value":',
            Strings.toString(refCount),
            '},{"trait_type":"Unique Refs","value":',
            Strings.toString(uniqueRefCount),
            '},{"trait_type":"Parent Refs","value":',
            Strings.toString(parentRefCount),
            "}"
        );
    }

    /// @dev Builds geographic classification attributes (Hemisphere, Terrain, Climate)
    /// @param latitude Latitude in millionths of degree
    /// @param metersElevation Pre-calculated elevation in meters
    /// @return JSON string of geographic attributes
    function _buildGeographicAttributes(int256 latitude, int256 metersElevation)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            '{"trait_type":"Hemisphere","value":"',
            latitude >= 0 ? "Northern" : "Southern",
            '"},{"trait_type":"Terrain","value":"',
            _getTerrainType(metersElevation),
            '"},{"trait_type":"Climate","value":"',
            _getClimateZone(latitude),
            '"}'
        );
    }

    /// @dev Builds rarity attribute
    /// @param rarityTier Pre-calculated rarity tier
    /// @return JSON string of rarity attribute
    function _buildRarityAttribute(string memory rarityTier)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            '{"trait_type":"Rarity","value":"',
            rarityTier,
            '"}'
        );
    }

    // ============================================
    // INTERNAL: Coordinate Formatting
    // ============================================

    /// @dev Formats coordinate with directional indicator (N/S/E/W)
    /// @param coord Coordinate in millionths of degree (can be negative)
    /// @param isLatitude True for latitude, false for longitude
    /// @return Formatted coordinate string (e.g., "35.6789N")
    function _formatCoordinate(int256 coord, bool isLatitude)
        internal
        pure
        returns (string memory)
    {
        bool isPositive = coord >= 0;
        uint256 abs = uint256(coord < 0 ? -coord : coord);
        uint256 degrees = abs / COORD_PRECISION;
        uint256 decimals = (abs % COORD_PRECISION) / 100; // 4 decimal places

        string memory direction;
        if (isLatitude) {
            direction = isPositive ? "N" : "S";
        } else {
            direction = isPositive ? "E" : "W";
        }

        return string(
            abi.encodePacked(
                Strings.toString(degrees),
                ".",
                _padToFourDigits(decimals),
                direction
            )
        );
    }

    /// @dev Pads fractional part to 4 digits with leading zeros
    /// @param value Value to pad (should be 0-9999)
    /// @return 4-character string with leading zeros
    function _padToFourDigits(uint256 value)
        internal
        pure
        returns (string memory)
    {
        bytes memory buffer = new bytes(COORD_DECIMAL_PLACES);
        for (uint256 i = COORD_DECIMAL_PLACES; i > 0; i--) {
            buffer[i - 1] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // ============================================
    // INTERNAL: Numeric Conversion
    // ============================================

    /// @dev Converts elevation to meters string with sign handling
    /// @param elevation Elevation in ten-thousandths of meter
    /// @return Elevation string in meters (e.g., "3776" or "-2500")
    function _elevationToMeters(int256 elevation)
        internal
        pure
        returns (string memory)
    {
        int256 meters = elevation / int256(ELEVATION_PRECISION);
        if (meters < 0) {
            return string(abi.encodePacked("-", Strings.toString(uint256(-meters))));
        }
        return Strings.toString(uint256(meters));
    }

    // ============================================
    // INTERNAL: Rarity Calculation (Enhanced)
    // ============================================

    /// @dev Calculates comprehensive rarity score (0-17 points)
    /// Rebalanced: Distance (travel) > Unique Referrers (community diversity) > Geography
    /// @param metersElevation Elevation in meters
    /// @param kilometersDistance Total distance in kilometers
    /// @param refCount Total number of references
    /// @param uniqueRefCount Number of unique referrers
    /// @param generation Generation number
    /// @param latitude Latitude for special location detection
    /// @return score Total rarity score
    function _calculateRarityScore(
        int256 metersElevation,
        uint256 kilometersDistance,
        uint256 refCount,
        uint256 uniqueRefCount,
        uint256 generation,
        int256 latitude
    ) internal pure returns (uint256 score) {
        // Elevation scoring (0-2 points)
        if (metersElevation > MOUNTAIN_THRESHOLD || metersElevation < DEEP_OCEAN_THRESHOLD) {
            score += 2; // Mountains (>5000m) or Deep Ocean (<-1000m)
        } else if (metersElevation > HIGHLAND_THRESHOLD || metersElevation < -500) {
            score += 1; // Highlands (>2000m) or Shallow Ocean
        }

        // Extreme elevation bonus (0-1 point)
        if (metersElevation >= EXTREME_HIGH_ELEVATION || metersElevation <= EXTREME_LOW_ELEVATION) {
            score += 1; // Everest-class (≥8000m) or Mariana-class (≤-10000m)
        }

        // Distance scoring (0-6 points) - HIGHEST PRIORITY
        if (kilometersDistance > ULTRA_DISTANCE_THRESHOLD) {
            score += 6; // > 3,000km (intercontinental)
        } else if (kilometersDistance > LONG_DISTANCE_THRESHOLD) {
            score += 5; // > 2,000km (cross-country)
        } else if (kilometersDistance > MEDIUM_DISTANCE_THRESHOLD) {
            score += 4; // > 1,000km (regional)
        } else if (kilometersDistance > SHORT_DISTANCE_THRESHOLD) {
            score += 2; // > 500km (inter-city)
        }

        // Unique referrer count scoring (0-4 points) - based on unique users, not raw count
        if (uniqueRefCount >= LEGENDARY_UNIQUE_REFS) {
            score += 4; // ≥ 50 unique users (legendary)
        } else if (uniqueRefCount >= ELITE_UNIQUE_REFS) {
            score += 3; // ≥ 20 unique users (elite)
        } else if (uniqueRefCount >= HIGH_UNIQUE_REFS) {
            score += 2; // ≥ 10 unique users (high)
        } else if (uniqueRefCount >= MEDIUM_UNIQUE_REFS) {
            score += 1; // ≥ 5 unique users (medium)
        } else if (uniqueRefCount >= LOW_UNIQUE_REFS) {
            score += 1; // ≥ 2 unique users (early reward)
        }

        // Diversity bonus (0-2 points) - rewards diverse community over single-user spam
        if (refCount > 0) {
            uint256 diversityRatio = (uniqueRefCount * 100) / refCount;
            if (diversityRatio >= HIGH_DIVERSITY_RATIO) {
                score += 2; // 80%+ of references from unique users
            } else if (diversityRatio >= MEDIUM_DIVERSITY_RATIO) {
                score += 1; // 50%+ of references from unique users
            }
        }

        // Generation scoring (0-1 point)
        if (generation >= HIGH_GEN_THRESHOLD) {
            score += 1; // ≥ 50 generations (ancient lineage)
        }

        // Special location bonuses (0-2 points)
        if (_isAtPole(latitude)) score += 1; // Polar regions
        if (generation == 0) score += 1; // Genesis bonus

        return score;
    }

    /// @dev Converts rarity score to tier name
    /// @param score Total rarity score
    /// @return Tier abbreviation (MTH, LGD, EPC, RARE, CMN)
    function _scoreToTier(uint256 score)
        internal
        pure
        returns (string memory)
    {
        if (score >= MYTHIC_SCORE_THRESHOLD) return "MTH";
        if (score >= LEGENDARY_SCORE_THRESHOLD) return "LGD";
        if (score >= EPIC_SCORE_THRESHOLD) return "EPC";
        if (score >= RARE_SCORE_THRESHOLD) return "RARE";
        return "CMN";
    }

    // ============================================
    // INTERNAL: Geographic Classification
    // ============================================

    /// @dev Determines terrain type based on elevation
    /// @param metersElevation Elevation in meters
    /// @return Terrain type name
    function _getTerrainType(int256 metersElevation)
        internal
        pure
        returns (string memory)
    {
        if (metersElevation < DEEP_OCEAN_THRESHOLD) return "Deep Ocean";
        if (metersElevation < SEA_LEVEL) return "Ocean";
        if (metersElevation < LOWLAND_THRESHOLD) return "Lowland";
        if (metersElevation < HIGHLAND_THRESHOLD) return "Hills";
        if (metersElevation < MOUNTAIN_THRESHOLD) return "Mountain";
        return "Peak";
    }

    /// @dev Determines climate zone based on latitude
    /// @param latitude Latitude in millionths of degree
    /// @return Climate zone name
    function _getClimateZone(int256 latitude)
        internal
        pure
        returns (string memory)
    {
        int256 absLat = latitude < 0 ? -latitude : latitude;

        if (absLat >= TEMPERATE_ZONE_THRESHOLD) return "Polar";
        if (absLat >= TROPICAL_ZONE_THRESHOLD) return "Temperate";
        return "Tropical";
    }

    /// @dev Checks if location is at or near a pole
    /// @param latitude Latitude in millionths of degree
    /// @return True if latitude ≥85° or ≤-85°
    function _isAtPole(int256 latitude)
        internal
        pure
        returns (bool)
    {
        int256 absLat = latitude < 0 ? -latitude : latitude;
        return absLat >= POLE_LATITUDE_THRESHOLD;
    }
}
