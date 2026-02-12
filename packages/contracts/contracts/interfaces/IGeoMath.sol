// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGeoMath {
    function calculateDistance(
        int256 lat1,
        int256 lon1,
        int256 lat2,
        int256 lon2
    ) external pure returns (uint256);
}
