// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal SSTORE2 using a small deployer contract (robust, readable).
contract __SSTORE2Pointer {
  constructor(bytes memory data) {
    // Prefix STOP (0x00) so the deployed code cannot be called.
    bytes memory runtime = bytes.concat(bytes1(0x00), data);
    assembly {
      return(add(runtime, 32), mload(runtime))
    }
  }
}

library SSTORE2 {
  function write(bytes memory data) internal returns (address pointer) {
    pointer = address(new __SSTORE2Pointer(data));
  }

  function read(address pointer) internal view returns (bytes memory data) {
    assembly {
      let size := sub(extcodesize(pointer), 1)
      let ptr := mload(0x40)
      mstore(ptr, size)
      extcodecopy(pointer, add(ptr, 32), 1, size)
      mstore(0x40, add(add(ptr, 32), size))
      data := ptr
    }
  }
}
