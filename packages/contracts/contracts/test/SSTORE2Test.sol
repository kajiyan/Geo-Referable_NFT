// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/SSTORE2.sol";

contract SSTORE2Test {
    function testWrite(bytes memory data) external returns (address) {
        return SSTORE2.write(data);
    }

    function testRead(address pointer) external view returns (bytes memory) {
        return SSTORE2.read(pointer);
    }
}
