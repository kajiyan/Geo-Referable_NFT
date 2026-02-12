// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IGeoMath.sol";

contract GeoMath is IGeoMath {
    uint256 private constant PRECISION = 1e6;
    uint256 private constant METERS_PER_DEGREE = 111_320;

    function calculateDistance(
        int256 lat1,
        int256 lon1,
        int256 lat2,
        int256 lon2
    ) external pure override returns (uint256) {
        // Handle same location
        if (lat1 == lat2 && lon1 == lon2) {
            return 0;
        }

        // Convert to absolute differences
        int256 dLat = lat2 - lat1;
        int256 dLon = lon2 - lon1;

        // Average latitude for approximation
        int256 avgLat = (lat1 + lat2) / 2;

        // Calculate latitude distance (straightforward)
        uint256 latDistance = abs(dLat) * METERS_PER_DEGREE / PRECISION;

        // Calculate longitude distance (adjusted by latitude)
        // cos(lat) approximation using Taylor series: cos(x) ≈ 1 - x²/2
        // avgLatRadians = avgLat × (π/180) scaled by PRECISION
        // = avgLat × 314159 / (180 × 100000) where 314159 = π × 1e5
        int256 avgLatRadians = (avgLat * 314159) / (180 * 100000);
        int256 cosLat = int256(PRECISION) - (avgLatRadians * avgLatRadians) / (2 * int256(PRECISION));
        if (cosLat < 0) cosLat = 0; // Clamp to 0 for extreme latitudes

        uint256 lonDistance = (abs(dLon) * METERS_PER_DEGREE * uint256(cosLat)) /
            (PRECISION * PRECISION);

        // Pythagorean theorem: sqrt(x² + y²)
        return sqrt(latDistance * latDistance + lonDistance * lonDistance);
    }

    function abs(int256 x) private pure returns (uint256) {
        return uint256(x >= 0 ? x : -x);
    }

    function sqrt(uint256 x) private pure returns (uint256) {
        if (x == 0) return 0;
        if (x <= 3) return 1;

        // Newton's method with unchecked for gas optimization
        // Safe because: z decreases monotonically toward sqrt(x), division by z is safe (z > 0)
        unchecked {
            uint256 z = (x + 1) / 2;
            uint256 y = x;

            while (z < y) {
                y = z;
                z = (x / z + z) / 2;
            }

            return y;
        }
    }
}
