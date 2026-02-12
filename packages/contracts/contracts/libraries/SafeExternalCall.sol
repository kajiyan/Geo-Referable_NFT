// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SafeExternalCall
/// @notice Library for making safe external calls with gas limits and return data size limits
/// @dev Inspired by Nomad's ExcessivelySafeCall library
library SafeExternalCall {
    /// @notice Make a safe static call with gas limit and return data size limit
    /// @param target The address to call
    /// @param gasLimit Maximum gas to forward to the call
    /// @param maxCopyBytes Maximum bytes to copy from return data
    /// @param data The calldata to send
    /// @return success Whether the call succeeded
    /// @return returnData The return data (truncated to maxCopyBytes if necessary)
    function safeStaticCall(
        address target,
        uint256 gasLimit,
        uint256 maxCopyBytes,
        bytes memory data
    ) internal view returns (bool success, bytes memory returnData) {
        assembly {
            // Perform the staticcall
            success := staticcall(
                gasLimit,              // Gas limit
                target,                // Target address
                add(data, 0x20),      // Input data (skip length prefix)
                mload(data),          // Input data length
                0,                     // Output location (we'll copy manually)
                0                      // Output length (we'll get it from returndatasize)
            )

            // Get the size of the return data
            let returnDataSize := returndatasize()

            // If return data is larger than maxCopyBytes, truncate it
            if gt(returnDataSize, maxCopyBytes) {
                returnDataSize := maxCopyBytes
            }

            // Allocate memory for return data
            returnData := mload(0x40)

            // Store the length
            mstore(returnData, returnDataSize)

            // Copy the return data
            returndatacopy(add(returnData, 0x20), 0, returnDataSize)

            // Update free memory pointer
            mstore(0x40, add(returnData, add(0x20, returnDataSize)))
        }
    }

    /// @notice Make a safe call with gas limit and return data size limit
    /// @param target The address to call
    /// @param gasLimit Maximum gas to forward to the call
    /// @param maxCopyBytes Maximum bytes to copy from return data
    /// @param data The calldata to send
    /// @return success Whether the call succeeded
    /// @return returnData The return data (truncated to maxCopyBytes if necessary)
    function safeCall(
        address target,
        uint256 gasLimit,
        uint256 maxCopyBytes,
        bytes memory data
    ) internal returns (bool success, bytes memory returnData) {
        assembly {
            // Perform the call
            success := call(
                gasLimit,              // Gas limit
                target,                // Target address
                0,                     // Value (0 ETH)
                add(data, 0x20),      // Input data (skip length prefix)
                mload(data),          // Input data length
                0,                     // Output location (we'll copy manually)
                0                      // Output length (we'll get it from returndatasize)
            )

            // Get the size of the return data
            let returnDataSize := returndatasize()

            // If return data is larger than maxCopyBytes, truncate it
            if gt(returnDataSize, maxCopyBytes) {
                returnDataSize := maxCopyBytes
            }

            // Allocate memory for return data
            returnData := mload(0x40)

            // Store the length
            mstore(returnData, returnDataSize)

            // Copy the return data
            returndatacopy(add(returnData, 0x20), 0, returnDataSize)

            // Update free memory pointer
            mstore(0x40, add(returnData, add(0x20, returnDataSize)))
        }
    }
}
