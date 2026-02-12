// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/interfaces/IERC165.sol";

/// @title EIP-721 Metadata Update Extension
/// @dev Interface for EIP-4906: Metadata Update Extension
/// @notice This interface adds standard events for NFT metadata updates
interface IERC4906 is IERC165 {
    /// @dev This event emits when the metadata of a token is changed.
    /// So that third-party platforms such as NFT marketplaces could
    /// timely update the images and related attributes of the NFT.
    /// @param _tokenId The token ID whose metadata has been updated
    event MetadataUpdate(uint256 _tokenId);

    /// @dev This event emits when the metadata of a range of tokens is changed.
    /// So that third-party platforms such as NFT marketplaces could
    /// timely update the images and related attributes of the NFTs.
    /// @param _fromTokenId The starting token ID of the range (inclusive)
    /// @param _toTokenId The ending token ID of the range (inclusive)
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
}
