// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDateTime {
    function timestampToDateTime(uint256 timestamp)
        external
        pure
        returns (
            uint256 year,
            uint256 month,
            uint256 day,
            uint256 hour,
            uint256 minute,
            uint256 second
        );
}
