// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NOROSIFont
 * @notice On-chain storage for the NOROSI brand custom font (Norosi Regular)
 * @dev This contract provides the Norosi-Regular.woff2 font as a base64-encoded
 *      data URI. It is designed to be used by SVG generation contracts such as Fumi.sol.
 *
 * Font Information:
 * - Name: Norosi Regular
 * - Format: WOFF2 (Web Open Font Format version 2)
 * - Original File Size: 4040 bytes
 * - Base64 Encoded Size: 5388 characters
 * - Version: 1.0
 *
 * License:
 * This font is provided under the MIT License.
 *
 * Usage Example:
 * ```solidity
 * NOROSIFont fontContract = NOROSIFont(fontAddress);
 * string memory fontDataUri = fontContract.font();
 * // Use in SVG style tag with font-face rule
 * ```
 */
contract NOROSIFont {

    /**
     * @notice Base64-encoded data URI for the Norosi Regular font
     * @dev Contains the complete WOFF2 font data in data URI format.
     *      Can be used directly in SVG style tags.
     * @return The font data URI string
     */
    string public constant font =
        "data:application/font-woff2;charset=utf-8;base64,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";

    /**
     * @notice Returns metadata about the font contract
     * @dev Provides font information for frontends and tooling to identify the font
     * @return name Font name
     * @return format Font format
     * @return version Version number
     */
    function getFontInfo() external pure returns (
        string memory name,
        string memory format,
        string memory version
    ) {
        return ("Norosi Regular", "WOFF2", "1.0");
    }
}
