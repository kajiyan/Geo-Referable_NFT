// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title ERC-5521: Referable NFT Interface
/// @notice 必須のイベントと関数シグネチャを定義
interface IERC5521 is IERC165 {
  /// @notice ノード情報が更新されたときに発火
  event UpdateNode(
    uint256 indexed tokenId,
    address indexed owner,
    address[] _address_referringList,
    uint256[][] _tokenIds_referringList,
    address[] _address_referredList,
    uint256[][] _tokenIds_referredList
  );
  function setNode(uint256 tokenId, address[] memory addresses, uint256[][] memory tokenIds) external;
  function setNodeReferring(address[] memory addresses, uint256 tokenId, uint256[][] memory tokenIds) external;
  function setNodeReferred(address[] memory addresses, uint256 tokenId, uint256[][] memory tokenIds) external;
  function setNodeReferredExternal(address _address, uint256 tokenId, uint256[][] memory tokenIds) external;
  function referringOf(address _address, uint256 tokenId) external view returns (address[] memory, uint256[][] memory);
  function referredOf(address _address, uint256 tokenId) external view returns (address[] memory, uint256[][] memory);
  function createdTimestampOf(address _address, uint256 tokenId) external view returns (uint256);
  function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
