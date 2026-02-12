// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFumi {
    struct TokenSVGParams {
        uint256 tokenId;
        uint256 colorIndex;
        uint256 referenceColorIndex;
        uint256 totalDistance;
        uint256 createdTimestamp;
        string message;
        uint256 generation;
        uint256 treeIndex;
        uint256 refCountValue;
        uint256 parentRefCount;  // Parent token reference count
        uint256 tree;            // Tree ID (which tree the token belongs to)
    }

    /// @notice Generates SVG for token metadata with gas-optimized calldata parameter
    /// @param params Token SVG parameters (uses calldata to avoid memory copy)
    /// @return Generated SVG string
    function tokenSVG(TokenSVGParams calldata params) external view returns (string memory);
}
