// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IDateTime.sol";
import "./interfaces/IFumi.sol";

/**
 * @notice Interface for font contract
 * @dev Used to integrate with external font contracts like NOROSIFont.sol
 */
interface IFont {
    function font() external view returns (string memory);
}

/**
 * @title Fumi (煙 = smoke)
 * @notice Utility contract for generating on-chain SVG for Geo-Referable NFT tokens.
 * @dev Gas-optimized implementation with the following techniques:
 * - Direct writing to large bytes buffer (avoiding repeated abi.encodePacked calls)
 * - Sine value Look-Up Table (LUT) packed in bytes with linear interpolation
 * - Pre-calculated fade coefficients fade(i) reused in loops
 * - Wave path generation split into `_buildWavePath` function (avoiding Stack too deep)
 */
contract Fumi is IFumi {

    /// @notice Timestamp-to-date conversion contract (immutable for gas optimization)
    /// @dev Set once in constructor, embedded in contract bytecode to avoid SLOAD costs
    IDateTime private immutable datetime;

    /// @notice NOROSI brand custom font provider contract (immutable for gas optimization)
    /// @dev Set once in constructor, embedded in contract bytecode to avoid SLOAD costs
    IFont private immutable norosiFont;

    /**
     * @notice Constructor for Fumi contract
     * @param _datetimeAddress Address of the `IDateTime` implementation contract
     * @param _norosiFontAddress Address of the `IFont` implementation contract (NOROSIFont)
     * @dev Reverts if either address is zero to prevent unusable contract deployment
     */
    constructor(address _datetimeAddress, address _norosiFontAddress) {
        if (_datetimeAddress == address(0)) revert ZeroAddressNotAllowed();
        if (_norosiFontAddress == address(0)) revert ZeroAddressNotAllowed();
        datetime = IDateTime(_datetimeAddress);
        norosiFont = IFont(_norosiFontAddress);
    }

    // ---------- Fixed parameters and constants ----------
    uint256 internal constant TWO_PI_1e4 = 62832;        // ≈ 2π * 1e4
    uint256 internal constant STEP_1e4   = 137_931;      // 13.7931 * 1e4

    // rad(1e4) → (degrees*10) using 1800/π ≈ 203400/355
    uint256 internal constant DEG10_NUM  = 203_400;
    uint256 internal constant DEG10_DEN  = 3_550_000;    // 355 * 1e4

    // RNG ranges (fixed-point scales)
    uint256 internal constant AMP_MIN_1e5 = 2_000_000;   // 20 px * 1e5
    uint256 internal constant AMP_SPAN    = 3_000_001;   // → max 5_000_000
    uint256 internal constant FREQ_MIN_1e4= 50;          // 0.005 *1e4
    uint256 internal constant FREQ_SPAN   = 101;         // → max 0.015*1e4 (=150)
    uint256 internal constant N_SEG       = 29;          // Vertical step count (29 relative l commands)
    uint256 internal constant PARENT_N_SEG = 12;         // Parent wave vertical step count (for 40% height)

    // Scale constants for fixed-point arithmetic
    uint256 internal constant SCALE_1E4   = 10_000;      // 1e4 scale for precision
    uint256 internal constant SCALE_1E5   = 100_000;     // 1e5 scale for precision
    uint256 internal constant SCALE_1E10  = 10_000_000_000; // 1e10 scale for precision

    // ASCII character codes
    uint8 internal constant ASCII_ZERO    = 48;          // ASCII code for '0'

    // Wave Y-axis start positions
    int256 internal constant MAIN_WAVE_START_Y = -20;    // Main wave starting Y coordinate
    uint256 internal constant PARENT_WAVE_START_Y = 200; // Parent wave starting Y coordinate

    // Leading path (white frame). stroke inherits from group specification.
    string internal constant FRAME_PATH = '<path class="bg" d="M-20,420v-440h440v440z" stroke="none"/>';

    // ---------- Color Table ----------
    // 14 colors * 3 bytes = 42 bytes packed into a single constant
    // Colors indexed by color index value (0-13)
    bytes internal constant COLOR_TABLE = hex"F3A0B6F7D6BAD3FFE2FBFFC5C9EDFDB8B3FB9993FBE3FFB28AD2B6E1FF86DB78FB96FFCD93B2B6B2B2B2";

    // ===== Input Validation Errors =====
    /// @notice Thrown when a zero address is provided where it's not allowed
    error ZeroAddressNotAllowed();

    /// @notice Thrown when colorIndex parameter is out of range (> 13)
    /// @param colorIndex The invalid color index value
    error InvalidColorIndexValue(uint256 colorIndex);

    /// @notice Thrown when referenceColorIndex parameter is out of range (> 13)
    /// @param referenceColorIndex The invalid reference color index value
    error InvalidReferenceColorIndexValue(uint256 referenceColorIndex);

    /// @notice Thrown when a value to be padded is >= 100
    /// @param value The value that's too large
    error NumberTooLargeForPadding(uint256 value);

    /// @notice Thrown when a value to be padded to 3 digits is >= 1000
    /// @param value The value that's too large
    error ValueMustBeLessThan1000(uint256 value);

    /// @notice Thrown when month is outside the valid range of 1..12
    /// @param month The invalid month value
    error InvalidMonth(uint256 month);

    /// @notice Thrown when message length exceeds maximum allowed
    /// @param length The actual message length in bytes
    error MessageTooLong(uint256 length);

    /// @notice Thrown when treeIndex is >= 1000
    /// @param treeIndex The invalid tree index value
    error InvalidTreeIndex(uint256 treeIndex);

    // ---------- LUT: sin(0..90°, step 0.1°), scale=1e5, packed as uint24 LE (3 bytes/entry) ----------
    // 901 entries × 3 bytes = 2703 bytes
    bytes internal constant SIN_U24 = hex"000000af00005d01000c0200ba0200690300170400c60400740500230600d106008007002e0800dd08008b09003a0a00e80a00970b00450c00f40c00a20d00500e00ff0e00ad0f005c10000a1100b81100671200151300c31300721400201500ce15007c16002b1700d91700871800351900e31900921a00401b00ee1b009c1c004a1d00f81d00a61e00541f00022000b020005e21000c2200b92200672300152400c324007125001e2600cc26007a2700272800d52800822900302a00dd2a008b2b00382c00e62c00932d00402e00ee2e009b2f00483000f53000a23100503200fd3200aa3300573400043500b035005d36000a3700b73700643800103900bd39006a3a00163b00c33b006f3c001b3d00c83d00743e00203f00cd3f00794000254100d141007d4200294300d543008144002c4500d84500844600304700db4700874800324900de4900894a00344b00df4b008b4c00364d00e14d008c4e00374f00e24f008c5000375100e251008c5200375300e253008c5400365500e155008b5600355700df5700895800335900dd5900875a00315b00da5b00845c002d5d00d75d00805e002a5f00d35f007c6000256100ce6100776200206300c963007164001a6500c265006b6600136700bc67006468000c6900b469005c6a00046b00ac6b00536c00fb6c00a36d004a6e00f26e00996f00407000e770008e7100357200dc7200837300297400d074007775001d7600c376006a7700107800b678005c7900017a00a77a004d7b00f27b00987c003d7d00e37d00887e002d7f00d27f007780001b8100c08100658200098300ae8300528400f684009a85003e8600e28600868700298800cd8800708900138a00b78a005a8b00fd8b00a08c00428d00e58d00888e002a8f00cc8f006f9000119100b39100559200f692009893003a9400db94007c95001e9600bf9600609700009800a19800429900e29900839a00239b00c39b00639c00039d00a39d00429e00e29e00819f0020a000bfa0005ea100fda1009ca2003ba300d9a30078a40016a500b4a50052a600f0a6008ea7002ba800c9a80066a90003aa00a0aa003dab00daab0077ac0013ad00b0ad004cae00e8ae0084af0020b000bbb00057b100f2b1008eb20029b300c4b3005fb400fab40094b5002fb600c9b60063b700fdb70097b80031b900cab90064ba00fdba0096bb002fbc00c8bc0061bd00fabd0092be002abf00c2bf005ac000f2c0008ac10021c200b9c20050c300e7c3007ec40015c500abc50042c600d8c6006ec70004c8009ac80030c900c5c9005bca00f0ca0085cb001acc00afcc0043cd00d8cd006cce0000cf0094cf0028d000bbd0004fd100e2d10075d20008d3009bd3002dd400c0d40052d500e4d50076d60008d7009ad7002bd800bcd8004ed900dfd9006fda0000db0090db0021dc00b1dc0041dd00d0dd0060de00efde007fdf000ee0009de0002be100bae10048e200d6e20064e300f2e30080e4000de5009be50028e600b5e60041e700cee7005ae800e6e80073e900fee9008aea0016eb00a1eb002cec00b7ec0042ed00cced0057ee00e1ee006bef00f5ef007ef00008f10091f1001af200a3f2002bf300b4f3003cf400c4f4004cf500d4f5005cf600e3f6006af700f1f70078f800fef80085f9000bfa0091fa0017fb009cfb0022fc00a7fc002cfd00b1fd0035fe00bafe003eff00c2ff00460001ca00014d0101d00101530201d60201590301db03015d0401df0401610501e30501640601e50601660701e70701680801e80801680901e80901680a01e70a01670b01e60b01650c01e30c01620d01e00d015e0e01dc0e015a0f01d70f01551001d210014e1101cb1101471201c312013f1301bb1301371401b214012d1501a815012316019d16011717019117010b1801851801fe1801771901f01901691a01e11a01591b01d11b01491c01c11c01381d01af1d01261e019d1e01131f018a1f01002001762001eb2001602101d621014a2201bf2201342301a823011c2401902401032501762501e925015c2601cf2601412701b427012528019728010929017a2901eb29015c2a01cc2a013c2b01ad2b011c2c018c2c01fb2c016a2d01d92d01482e01b62e01252f01932f010030016e3001db3001483101b531012132018e3201fa3201663301d133013c3401a834011235017d3501e73501513601bb36012537018e3701f83701603801c938013239019a3901023a01693a01d13a01383b019f3b01063c016c3c01d23c01383d019e3d01043e01693e01ce3e01323f01973f01fb3f015f4001c340012641018a4101ed41014f4201b24201144301764301d843013944019a4401fb44015c4501bd45011d46017d4601dc46013c47019b4701fa4701594801b74801154901734901d149012e4a018b4a01e84a01454b01a14b01fd4b01594c01b54c01104d016b4d01c64d01204e017b4e01d54e012e4f01884f01e14f013a5001935001eb50014451019b5101f351014b5201a25201f952014f5301a55301fc5301515401a75401fc5401515501a65501fa55014f5601a35601f656014a57019d5701f05701425801955801e758013959018a5901db59012c5a017d5a01ce5a011e5b016e5b01bd5b010d5c015c5c01ab5c01f95c01475d01955d01e35d01315e017e5e01cb5e01175f01645f01b05f01fc5f01476001936001de6001286101736101bd61010762015062019a6201e362012c6301746301bc63010464014c6401936401db6401216501686501ae6501f465013a66017f6601c566010a67014e6701926701d767011a68015e6801a16801e46801276901696901ab6901ed69012e6a01706a01b16a01f16a01326b01726b01b26b01f16b01306c016f6c01ae6c01ec6c012b6d01686d01a66d01e36d01206e015d6e01996e01d56e01116f014d6f01886f01c36f01fe6f01387001726001ac7001e670011f7101587101917101c97101017201397201707201a87201df72011573014c7301827301b77301ed73012274015774018c7401c07401f474012875015b75018e7501c17501f475012676015876018a7601bb7601ed76011d77014e77017e7701ae7701de77010d78013c78016b78019a7801c87801f678012379015179017e7901aa7901d77901037a012f7a015a7a01867a01b17a01db7a01067b01307b01597b01837b01ac7b01d57b01fe7b01267c014e7c01767c019d7c01c47c01eb7c01117d01387d015e7d01837d01a97d01ce7d01f27d01177e013b7e015f7e01827e01a67e01c87e01eb7e010d7f01307f01517f01737f01947f01b57f01d57f01f67f01158001358001558001748001928001b18001cf8001ed80010a81012881014581016181017e81019a8101b58101d18101ec81010782012182013c82015682016f8201898201a28201ba8201d38201eb82010383011a83013283014883015f83017583018b8301a18301b78301cc8301e18301f583010984011d84013184014484015784016a84017c84018e8401a08401b28401c38401d48401e48401f484010485011485012385013385014185015085015e85016c8501798501878501938501a08501ac8501b88501c48501d08501db8501e58501f08501fa85010486010e86011786012086012986013186013986014186014886014f86015686015d86016386016986016f86017486017986017e86018286018686018a86018e86019186019486019686019986019b86019c86019e86019f86019f8601a08601a08601";

    // ---------- Small utility functions (direct memory write helpers) ----------
    /**
     * @dev Writes source bytes directly into output buffer at specified offset
     * @param outBuf The output buffer to write into
     * @param offset Current write position in the buffer
     * @param src Source bytes to append
     * @return Updated offset after appending src
     */
    function _append(bytes memory outBuf, uint256 offset, bytes memory src) private pure returns (uint256) {
        unchecked {
            uint256 len = src.length;
            for (uint256 i = 0; i < len; ++i) outBuf[offset + i] = src[i];
            return offset + len;
        }
    }

    /**
     * @dev Appends a 3-digit decimal number to buffer without zero-padding
     * @param outBuf The output buffer to write into
     * @param offset Current write position in the buffer
     * @param x Number to append (0-999)
     * @return Updated offset after appending the number
     */
    function _appendBaseX3(bytes memory outBuf, uint256 offset, uint256 x) private pure returns (uint256) {
        unchecked {
            outBuf[offset++] = bytes1(uint8(ASCII_ZERO + x / 100));
            outBuf[offset++] = bytes1(uint8(ASCII_ZERO + (x / 10) % 10));
            outBuf[offset++] = bytes1(uint8(ASCII_ZERO + (x % 10)));
            return offset;
        }
    }

    /**
     * @dev Appends a non-negative integer in decimal format to buffer
     * @param outBuf The output buffer to write into
     * @param offset Current write position in the buffer
     * @param ip Number to append
     * @return Updated offset after appending the number
     */
    function _appendUint(bytes memory outBuf, uint256 offset, uint256 ip) private pure returns (uint256) {
        unchecked {
            if (ip == 0) { outBuf[offset++] = '0'; return offset; }
            bytes memory tmp = new bytes(10);
            uint256 n = 0;
            while (ip > 0) { tmp[n++] = bytes1(uint8(ASCII_ZERO + (ip % 10))); ip /= 10; }
            while (n > 0) { outBuf[offset++] = tmp[--n]; }
            return offset;
        }
    }

    /**
     * @dev Appends a 5-digit fixed-point decimal (xxxxx) to buffer
     * @notice Gas-optimized implementation with no memory allocation and no branching
     * @param outBuf The output buffer to write into
     * @param offset Current write position in the buffer
     * @param fp Fixed-point number (0-99999)
     * @return Updated offset after appending the 5 digits
     */
    function _appendFrac5(bytes memory outBuf, uint256 offset, uint256 fp) private pure returns (uint256) {
        unchecked {
            outBuf[offset + 4] = bytes1(uint8(ASCII_ZERO + (fp % 10))); fp /= 10;
            outBuf[offset + 3] = bytes1(uint8(ASCII_ZERO + (fp % 10))); fp /= 10;
            outBuf[offset + 2] = bytes1(uint8(ASCII_ZERO + (fp % 10))); fp /= 10;
            outBuf[offset + 1] = bytes1(uint8(ASCII_ZERO + (fp % 10))); fp /= 10;
            outBuf[offset + 0] = bytes1(uint8(ASCII_ZERO + (fp % 10)));
            return offset + 5;
        }
    }

    // ---------- Color Helper Functions ----------
    /// @notice Extracts RGB value corresponding to color index from packed `COLOR_TABLE`
    /// @param w Color index (0..13)
    /// @return Packed RGB value (bytes3)
    function getColorBytes(uint256 w) public pure returns (bytes3) {
        if (w >= 14) revert InvalidColorIndexValue(w);
        uint256 i = w * 3;
        bytes memory t = COLOR_TABLE;
        uint24 v = (uint24(uint8(t[i])) << 16)
                 | (uint24(uint8(t[i + 1])) << 8)
                 | uint24(uint8(t[i + 2]));
        return bytes3(v);
    }

    /// @notice Converts bytes3 RGB to 6-digit hexadecimal string (without `#` prefix)
    /// @param c RGB value
    /// @return 6-digit hexadecimal string (uppercase)
    function toHexString(bytes3 c) public pure returns (string memory) {
        bytes memory hexTable = "0123456789ABCDEF";
        bytes memory result = new bytes(6);
        uint24 v = uint24(c);

        for (uint256 i = 0; i < 6; i++) {
            result[5 - i] = hexTable[v & 0x0F];
            v >>= 4;
        }

        return string(result);
    }

    // ---------- SIN LUT reading and sine approximation ----------
    /**
     * @dev Reads a 24-bit little-endian value from the lookup table
     * @param t The lookup table bytes
     * @param i Index of the entry to read
     * @return v The 24-bit value as uint32
     */
    function _u24At(bytes memory t, uint256 i) private pure returns (uint32 v) {
        unchecked {
            uint256 o = i * 3;
            v = uint32(uint8(t[o])) | (uint32(uint8(t[o + 1])) << 8) | (uint32(uint8(t[o + 2])) << 16);
        }
    }

    /**
     * @dev Calculates sine value (scaled by 1e5) using 90-degree LUT with linear interpolation
     * @param angle1e4 Angle in radians scaled by 1e4
     * @param T The sine lookup table (SIN_U24)
     * @return s1e5 Sine value scaled by 1e5
     */
    function _sin1e5(uint256 angle1e4, bytes memory T) private pure returns (int256 s1e5) {
        unchecked {
            uint256 num   = angle1e4 * DEG10_NUM;
            uint256 deg10 = (num / DEG10_DEN) % 3600;      // [0..3599]
            uint256 rem   = num % DEG10_DEN;               // remainder for interpolation
            uint256 quad  = deg10 / 900;                   // 0..3
            uint256 pos   = deg10 % 900;                   // 0..899
            uint256 base  = (quad % 2 == 0) ? pos : (900 - pos);
            uint256 b1    = (quad % 2 == 0) ? (base < 900 ? base + 1 : 900) : (base > 0 ? base - 1 : 0);
            int256 v0     = int256(uint256(_u24At(T, base)));
            int256 v1     = int256(uint256(_u24At(T, b1)));
            int256 vi     = v0 + ((v1 - v0) * int256(rem)) / int256(DEG10_DEN);
            s1e5          = (quad >= 2) ? -vi : vi;
        }
    }

    /**
     * @dev Calculates absolute sine value for fade curve (0..π) scaled by 1e5
     * @param i Fade index (0-29 for 30 segments)
     * @param T The sine lookup table (SIN_U24)
     * @return Absolute sine value scaled by 1e5
     */
    function _fade1e5(uint256 i, bytes memory T) private pure returns (uint256) {
        uint256 angle1e4 = (3_550_000 * i) / (113 * 29);  // π ≈ 355/113
        int256 s = _sin1e5(angle1e4, T);
        return uint256(s >= 0 ? s : -s);
    }

    // ---------- Build and write single wave path to outBuf ----------
    /**
     * @dev Builds and appends a single wave path as SVG to the output buffer
     * @param T The sine lookup table (SIN_U24)
     * @param params Token SVG parameters including tokenId for randomness
     * @param index Wave index (0-11)
     * @param fade Fade curve values array (30 segments, scaled by 1e5)
     * @param outBuf The output buffer to write into
     * @param offset Current write position in the buffer
     * @param waveCount Total number of waves (for center alignment calculation)
     * @return Updated offset after appending the wave path
     */
    function _buildWavePath(
        bytes memory T,
        TokenSVGParams calldata params,
        uint256 index,
        uint256[30] memory fade,
        bytes memory outBuf,
        uint256 offset,
        uint256 waveCount
    ) internal pure returns (uint256) {
        unchecked {
            // Generate wave parameters (amplitude, frequency, phase) using tokenId as seed
            bytes32 s = keccak256(abi.encode(params.tokenId, index, "amp"));
            uint256 amp1e5 = AMP_MIN_1e5 + (uint256(s) % AMP_SPAN);
            s = keccak256(abi.encode(params.tokenId, index, "freq"));
            uint256 freq1e4 = FREQ_MIN_1e4 + (uint256(s) % FREQ_SPAN);
            s = keccak256(abi.encode(params.tokenId, index, "phase"));
            uint256 phase1e4 = uint256(s) % TWO_PI_1e4;

            // Calculate horizontal offsets for wave oscillation
            int256[30] memory off;
            off[0] = 0;
            uint256 y1e4 = STEP_1e4;
            for (uint256 k = 1; k < N_SEG; ++k) {
                uint256 angle1e4 = (y1e4 * freq1e4) / SCALE_1E4 + phase1e4;
                y1e4 += STEP_1e4;
                int256 sin1e5 = _sin1e5(angle1e4, T);
                uint256 fade1e5 = fade[k];
                int256 dx = (int256(amp1e5) * sin1e5 * int256(fade1e5)) / int256(SCALE_1E10); // 1e5 scale
                off[k] = dx;
            }
            off[N_SEG] = 0;
            for (uint256 k = 1; k < N_SEG; ++k) {
                off[k] = (off[k - 1] + off[k] * 2 + off[k + 1]) / 4; // 1:2:1 smoothing
            }

            // Build SVG path string
            outBuf[offset++] = '<'; outBuf[offset++] = 'p'; outBuf[offset++] = 'a';
            outBuf[offset++] = 't'; outBuf[offset++] = 'h'; outBuf[offset++] = ' ';
            outBuf[offset++] = 'd'; outBuf[offset++] = '='; outBuf[offset++] = '"';
            outBuf[offset++] = 'M';
            uint256 startX = _getCenteredStartX(waveCount);
            uint256 baseX = startX + index * 10;
            offset = _appendBaseX3(outBuf, offset, baseX);
            outBuf[offset++] = ','; outBuf[offset++] = '-'; outBuf[offset++] = '2'; outBuf[offset++] = '0';

            for (uint256 k = 1; k <= N_SEG; ++k) {
                int256 ddx = off[k] - off[k - 1];
                outBuf[offset++] = 'l';
                if (ddx < 0) { outBuf[offset++] = '-'; ddx = -ddx; }
                uint256 u  = uint256(ddx);
                uint256 ip = u / SCALE_1E5;
                uint256 fp = u % SCALE_1E5;
                offset = _appendUint(outBuf, offset, ip);
                outBuf[offset++] = '.';
                offset = _appendFrac5(outBuf, offset, fp);
                outBuf[offset++] = ',';
                // dy = 15.172 (main wave vertical step size)
                outBuf[offset++] = '1'; outBuf[offset++] = '5'; outBuf[offset++] = '.';
                outBuf[offset++] = '1'; outBuf[offset++] = '7'; outBuf[offset++] = '2';
            }
            // Close path tag
            outBuf[offset++] = '"';
            outBuf[offset++] = '/';
            outBuf[offset++] = '>';
            return offset;
        }
    }

    // ---------- Determine wave count based on reference count ----------
    /**
     * @dev Determines the number of waves to draw based on reference count
     * @notice Distribution: 0-4: 3 waves, 5-9: 5 waves, 10-19: 7 waves, 20-49: 9 waves, 50-99: 10 waves, 100+: 12 waves
     * @param refCount Number of references for the token
     * @return Number of waves to draw (3-12)
     */
    function _getWaveCountFromRefs(uint256 refCount) private pure returns (uint256) {
        if (refCount < 5) return 3;          // Minimum (0-4 refs)
        if (refCount < 10) return 5;         // LOW (5-9 refs)
        if (refCount < 20) return 7;         // MEDIUM (10-19 refs)
        if (refCount < 50) return 9;         // HIGH (20-49 refs)
        if (refCount < 100) return 10;       // ELITE (50-99 refs)
        return 12;                           // LEGENDARY (≥100 refs)
    }

    /**
     * @dev Calculates the starting X coordinate to center waves at SVG center (x=200)
     * @notice Wave spacing is fixed at 10px, center calculation: 200 - (waveCount - 1) * 5
     * @param waveCount Number of waves to draw
     * @return Starting X coordinate for centered wave placement
     */
    function _getCenteredStartX(uint256 waveCount) private pure returns (uint256) {
        return 200 - (waveCount - 1) * 5;
    }

    // ---------- Build and write parent reference wave path (y-axis 200-420) to outBuf ----------
    /**
     * @dev Builds and appends a parent reference wave path (y-axis 200-420 range) to the output buffer
     * @param T The sine lookup table (SIN_U24)
     * @param params Token SVG parameters including tokenId for randomness
     * @param index Wave index (0-11)
     * @param outBuf The output buffer to write into
     * @param offset Current write position in the buffer
     * @param waveCount Total number of waves (for center alignment calculation)
     * @return Updated offset after appending the parent wave path
     */
    function _buildParentRefWavePath(
        bytes memory T,
        TokenSVGParams calldata params,
        uint256 index,
        bytes memory outBuf,
        uint256 offset,
        uint256 waveCount
    ) internal pure returns (uint256) {
        unchecked {
            // Parent reference waves start at y=200, drawn with 220px height (200-420)
            // Segment count: 12 (PARENT_N_SEG) - visual step is 18.333px per segment
            // Note: parentStepSize is for wave phase calculation, not visual step size
            uint256 parentStepSize = 133_333; // Phase calculation step (scaled by 1e4)

            // Generate wave parameters (using different seed strings for parent refs)
            bytes32 s = keccak256(abi.encode(params.tokenId, index, "parent_amp"));
            uint256 amp1e5 = AMP_MIN_1e5 + (uint256(s) % AMP_SPAN);
            s = keccak256(abi.encode(params.tokenId, index, "parent_freq"));
            uint256 freq1e4 = FREQ_MIN_1e4 + (uint256(s) % FREQ_SPAN);
            s = keccak256(abi.encode(params.tokenId, index, "parent_phase"));
            uint256 phase1e4 = uint256(s) % TWO_PI_1e4;

            // Calculate fade table for parent reference waves (0..12)
            uint256[13] memory fade;
            fade[0] = 0;
            for (uint256 k = 1; k < PARENT_N_SEG; ++k) {
                uint256 angle1e4 = (3_550_000 * k) / (113 * PARENT_N_SEG);  // π ≈ 355/113
                int256 sin_val = _sin1e5(angle1e4, T);
                fade[k] = uint256(sin_val >= 0 ? sin_val : -sin_val);
            }
            fade[PARENT_N_SEG] = 0;

            // Calculate horizontal offsets for parent wave oscillation
            int256[13] memory off;
            off[0] = 0;
            uint256 y1e4 = parentStepSize;
            for (uint256 k = 1; k < PARENT_N_SEG; ++k) {
                uint256 angle1e4 = (y1e4 * freq1e4) / SCALE_1E4 + phase1e4;
                y1e4 += parentStepSize;
                int256 sin1e5 = _sin1e5(angle1e4, T);
                uint256 fade1e5 = fade[k];
                int256 dx = (int256(amp1e5) * sin1e5 * int256(fade1e5)) / int256(SCALE_1E10); // 1e5 scale
                off[k] = dx;
            }
            off[PARENT_N_SEG] = 0;
            for (uint256 k = 1; k < PARENT_N_SEG; ++k) {
                off[k] = (off[k - 1] + off[k] * 2 + off[k + 1]) / 4; // 1:2:1 smoothing
            }

            // Build SVG path string (starting at y=200)
            outBuf[offset++] = '<'; outBuf[offset++] = 'p'; outBuf[offset++] = 'a';
            outBuf[offset++] = 't'; outBuf[offset++] = 'h'; outBuf[offset++] = ' ';
            outBuf[offset++] = 'd'; outBuf[offset++] = '='; outBuf[offset++] = '"';
            outBuf[offset++] = 'M';
            uint256 startX = _getCenteredStartX(waveCount);
            uint256 baseX = startX + index * 10;
            offset = _appendBaseX3(outBuf, offset, baseX);
            outBuf[offset++] = ',';
            // Start at y=200, ends at y=420 (12 segments × 18.333px = 220px total)
            outBuf[offset++] = '2'; outBuf[offset++] = '0'; outBuf[offset++] = '0';

            for (uint256 k = 1; k <= PARENT_N_SEG; ++k) {
                int256 ddx = off[k] - off[k - 1];
                outBuf[offset++] = 'l';
                if (ddx < 0) { outBuf[offset++] = '-'; ddx = -ddx; }
                uint256 u  = uint256(ddx);
                uint256 ip = u / SCALE_1E5;
                uint256 fp = u % SCALE_1E5;
                offset = _appendUint(outBuf, offset, ip);
                outBuf[offset++] = '.';
                offset = _appendFrac5(outBuf, offset, fp);
                outBuf[offset++] = ',';
                // dy = 18.333 (parent wave vertical step size)
                outBuf[offset++] = '1'; outBuf[offset++] = '8'; outBuf[offset++] = '.';
                outBuf[offset++] = '3'; outBuf[offset++] = '3'; outBuf[offset++] = '3';
            }
            // Close path tag
            outBuf[offset++] = '"';
            outBuf[offset++] = '/';
            outBuf[offset++] = '>';
            return offset;
        }
    }

    // ---------- Timestamp formatting functions ----------
    /**
     * @notice Formats Unix timestamp to "MMM dd,yyyy HH:mm" format
     * @dev Example: 1732980720 -> "NOV. 30,2024 23:32" / 1719759120 -> "JUN 30,2024 23:32"
     * @dev Falls back to "TS: {timestamp}" if datetime contract call fails
     * @param timestamp Unix timestamp
     * @return Formatted timestamp string
     */
    function formatTimestamp(uint256 timestamp) public view returns (string memory) {
        try datetime.timestampToDateTime(timestamp) returns (
            uint256 year,
            uint256 month,
            uint256 day,
            uint256 hour,
            uint256 minute,
            uint256 /* second */
        ) {
            // Assemble the final string in the new format.
            return string.concat(
                _getMonthAbbreviation(month),
                " ",
                _toPaddedString(day),
                ",",
                _toString(year),
                " ",
                _toPaddedString(hour),
                ":",
                _toPaddedString(minute)
            );
        } catch {
            // Fallback to raw Unix timestamp display if datetime conversion fails
            return string.concat("TS: ", _toString(timestamp));
        }
    }

    /**
     * @dev Converts month number (1-12) to abbreviated English month name
     * @notice MAY, JUN, JUL have no period; others have period (e.g., JAN., FEB.)
     * @param month Month number (1-12)
     * @return Abbreviated month name string
     */
    function _getMonthAbbreviation(uint256 month) internal pure returns (string memory) {
        // Early revert for invalid input
        if (month == 0 || month > 12) {
            revert InvalidMonth(month);
        }

        // Define month abbreviations array with periods
        string[12] memory monthAbbrs = [
            "JAN.", // 1
            "FEB.", // 2
            "MAR.", // 3
            "APR.", // 4
            "MAY",  // 5 (no period)
            "JUN",  // 6 (no period)
            "JUL",  // 7 (no period)
            "AUG.", // 8
            "SEP.", // 9
            "OCT.", // 10
            "NOV.", // 11
            "DEC."  // 12
        ];

        // Array is 0-indexed, so access with month - 1
        return monthAbbrs[month - 1];
    }

    /**
     * @dev Converts colorIndex (0-13) to Unicode Private Use Area character (U+E900-U+E90D)
     * @notice Used for custom font icon display in SVG
     * @param colorIndex Color index value (0-13)
     * @return UTF-8 encoded Unicode character string
     */
    function _colorIndexToUnicode(uint256 colorIndex) internal pure returns (string memory) {
        // Revert if colorIndex is out of range
        if (colorIndex > 13) revert InvalidColorIndexValue(colorIndex);

        // Unicode codepoint: E900 + colorIndex
        // Example: colorIndex=0 → U+E900, colorIndex=1 → U+E901, ..., colorIndex=13 → U+E90D
        uint256 codepoint = 0xE900 + colorIndex;

        // UTF-8 encoding (3-byte format)
        // U+E900-E90D are in BMP Private Use Area, requiring 3-byte UTF-8
        // Format: 1110xxxx 10xxxxxx 10xxxxxx
        bytes memory result = new bytes(3);
        result[0] = bytes1(uint8(0xEE));                          // 1110 1110
        result[1] = bytes1(uint8(0xA4 | ((codepoint >> 6) & 0x03))); // 10 10 01xx
        result[2] = bytes1(uint8(0x80 | (codepoint & 0x3F)));     // 10 xxxxxx

        return string(result);
    }

    /**
     * @dev Converts a non-negative integer to decimal string representation
     * @param value The number to convert
     * @return Decimal string representation
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(ASCII_ZERO + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @dev Converts an integer (0-99) to a 2-digit zero-padded string
     * @notice Reverts if value >= 100
     * @param value The number to convert (0-99)
     * @return 2-digit zero-padded string (e.g., "05", "42")
     */
    function _toPaddedString(uint256 value) internal pure returns (string memory) {
        if (value >= 100) revert NumberTooLargeForPadding(value);
        if (value < 10) {
            return string.concat("0", _toString(value));
        }
        return _toString(value);
    }

    /**
     * @dev Zero-pads a number to 3 digits
     * @notice Examples: 42 → "042", 999 → "999". Reverts if value >= 1000
     * @param _value The number to zero-pad (0-999)
     * @return 3-digit zero-padded string
     */
    function _padToThreeDigits(uint256 _value) internal pure returns (string memory) {
        if (_value >= 1000) revert ValueMustBeLessThan1000(_value);

        string memory valueStr = _toString(_value);
        uint256 len = bytes(valueStr).length;

        if (len == 3) {
            return valueStr;
        }

        // Calculate number of missing '0's and build string directly
        // This approach is more gas-efficient than using loops
        if (len == 2) {
            return string(abi.encodePacked("0", valueStr));
        }
        // len == 1
        return string(abi.encodePacked("00", valueStr));
    }

    // ---------- Main: SVG assembly ----------
    /**
     * @notice Generates SVG for embedding in token metadata
     * @dev Creates dynamic 9-12KB SVG with sine wave animations, color gradients, and metadata display
     * @dev Uses calldata for params to avoid expensive memory copy (~300 gas savings)
     * @param params TokenSVGParams struct containing tokenId, colorIndex, referenceColorIndex, totalDistance, createdTimestamp, message, generation, refCountValue, and treeIndex
     * @return Generated SVG string with embedded font and animations
     */
    function tokenSVG(TokenSVGParams calldata params) external view override returns (string memory) {
        if (params.colorIndex > 13) revert InvalidColorIndexValue(params.colorIndex);
        if (params.referenceColorIndex > 13) revert InvalidReferenceColorIndexValue(params.referenceColorIndex);
        if (bytes(params.message).length > 500) revert MessageTooLong(bytes(params.message).length);
        if (params.treeIndex >= 1000) revert InvalidTreeIndex(params.treeIndex);

        // Load LUT to memory once
        bytes memory T = SIN_U24;

        // Calculate fade table for main waves (0..29)
        uint256[30] memory fade;
        fade[0] = 0;
        for (uint256 k = 1; k < N_SEG; ++k) fade[k] = _fade1e5(k, T);
        fade[N_SEG] = 0;

        // Fetch font data with error handling
        string memory fontData;
        try norosiFont.font() returns (string memory data) {
            fontData = string.concat("@font-face{font-family:'Norosi';font-display:block;src:url(", data, ") format('woff2')}");
        } catch {
            // Fallback to empty string - system fonts will be used
            fontData = "";
        }

        // Output buffer (22KB with margin - increased for NOROSI logo path data)
        bytes memory outBuf = new bytes(22_000);
        uint256 offset = 0;

        // --- header: <svg> + <style> + <defs> ---
        // Load NOROSI custom font via @font-face, applied to .icon class
        // If colorIndex == 13, add static class to stop animations
        bytes memory header = abi.encodePacked(
            params.colorIndex == 13
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" class="static">'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
            '<style>',
            fontData,
            'text{fill:#0C0A09;font:300 16px/1 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial;dominant-baseline:middle}',
            '.l{fill:#78716c}',
            '.t{fill:#78716C;font-weight:700;dominant-baseline:auto;font-variant-numeric:tabular-nums}',
            '.i{font-family:\'Norosi\';font-weight:400}',
            '.tl{font-size:20px}',
            '.tm{font-size:16px}',
            '.ts{fill:#57534E;font-size:12px;font-weight:300}',
            '.b{stroke:#57534E;fill:none}',
            '.d{stroke-dasharray:1 1}',
            '.bg{fill:#fff}',
            '@keyframes riseMain{to{stroke-dashoffset:456}}',
            '@keyframes riseParent{to{stroke-dashoffset:228}}',
            '.wm path{stroke-dasharray:41 16;stroke-linecap:round;animation:riseMain 8s linear infinite}',
            '.wp path{stroke-dasharray:41 16;stroke-linecap:round;animation:riseParent 10s linear infinite;opacity:.85}',
            '.static .wm,.static .wp,.static .i,.static .ts,.static .icon{display:none}',
            '</style>',
            '<defs>',
                '<filter id="F" filterUnits="userSpaceOnUse" x="-20" y="-20" width="440" height="440">',
                    '<feGaussianBlur stdDeviation="9" result="b"/>',
                    '<feComponentTransfer in="b" result="c">',
                        '<feFuncR type="discrete" tableValues="0 .5 1"/>',
                        '<feFuncG type="discrete" tableValues="0 .5 1"/>',
                        '<feFuncB type="discrete" tableValues="0 .5 1"/>',
                    '</feComponentTransfer>',
                    '<feFlood x="0" y="0" width="3" height="3" flood-color="#000" result="d"/>',
                    '<feTile in="d" result="t"/>',
                    '<feComposite in="c" in2="t" operator="in" result="h"/>',
                    '<feMorphology in="h" operator="dilate" radius="3" result="m"/>',
                    '<feBlend in="b" in2="m" mode="multiply"/>',
                '</filter>'
        );

        offset = _append(outBuf, offset, bytes(header));

        // --- Dynamic linearGradient + remaining defs + opening <g> ---
        // Combine with abi.encodePacked and append directly to buffer
        offset = _append(outBuf, offset, abi.encodePacked(
            '<linearGradient id="g" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">'
                '<stop offset="0" stop-color="#', toHexString(getColorBytes(params.colorIndex)), '" stop-opacity="', params.totalDistance > 0 ? "1" : "0", '"/>'
                '<stop offset="0.7" stop-color="#', toHexString(getColorBytes(params.colorIndex)), '"/>'
                '<stop offset="1" stop-color="#', toHexString(getColorBytes(params.referenceColorIndex)), '"/>'
            '</linearGradient>'
            '</defs>'
            '<g filter="url(#F)" fill="none" stroke="url(#g)" stroke-width="10" stroke-linecap="round">'
        ));
        offset = _append(outBuf, offset, bytes(FRAME_PATH));

        // Main waves based on token's own reference count (y-axis 0-400, 3-12 waves, centered)
        uint256 mainWaveCount = _getWaveCountFromRefs(params.refCountValue);
        // Start main wave group
        offset = _append(outBuf, offset, bytes('<g class="wm">'));
        for (uint256 i = 0; i < mainWaveCount; ++i) {
            offset = _buildWavePath(T, params, i, fade, outBuf, offset, mainWaveCount);
        }
        // End main wave group
        offset = _append(outBuf, offset, bytes('</g>'));

        // Parent reference waves (3-12 waves based on rarity, y-axis 240-400, centered)
        uint256 parentWaveCount = _getWaveCountFromRefs(params.parentRefCount);
        // Start parent wave group
        offset = _append(outBuf, offset, bytes('<g class="wp">'));
        for (uint256 i = 0; i < parentWaveCount; ++i) {
            offset = _buildParentRefWavePath(T, params, i, outBuf, offset, parentWaveCount);
        }
        // End parent wave group
        offset = _append(outBuf, offset, bytes('</g>'));

        // --- Footer: close wave group, append metadata block, close </svg> ---
        // Convert colorIndex (0-13) to Unicode character (U+E900-E90D) for icon display
        bytes memory blockAfterWaves = bytes(string.concat(
            "</g>"
            "<path class=\"l\" d=\"M142.822 20.508h3.533v17.666h-3.533zM61.435 32.095l-7.97-11.584v-.003H50v17.666h3.465V26.587l7.969 11.585v.003h3.464V20.508h-3.464zm19.193-11.173c-4.384-1.86-9.616.403-11.665 5.045s-.15 9.931 4.233 11.792a8.2 8.2 0 0 0 3.213.65c3.476 0 6.89-2.157 8.452-5.696 2.049-4.64.15-9.93-4.233-11.79m1.054 10.443c-1.29 2.923-4.48 4.393-7.109 3.277-2.63-1.117-3.72-4.402-2.43-7.325 1.289-2.923 4.479-4.392 7.108-3.276 2.63 1.116 3.721 4.401 2.431 7.324m35.906-10.44c-2.152-.914-4.562-.874-6.785.112-2.166.96-3.898 2.713-4.88 4.933-.98 2.22-1.096 4.66-.326 6.865.79 2.263 2.41 4.013 4.562 4.927a8.2 8.2 0 0 0 3.213.65c3.475 0 6.89-2.156 8.451-5.696 2.05-4.64.15-9.93-4.233-11.79zm1.057 10.442c-1.29 2.923-4.478 4.393-7.11 3.277-1.244-.53-2.189-1.562-2.658-2.908-.49-1.406-.407-2.973.23-4.417s1.747-2.575 3.127-3.186c.67-.3 1.395-.459 2.13-.465.637 0 1.263.124 1.851.375 2.63 1.116 3.72 4.401 2.431 7.324zm-17.234 3.103a4.3 4.3 0 0 1-1.518-1.08 4.7 4.7 0 0 1-.96-1.633 5 5 0 0 1-.199-.745q.12-.039.237-.084a6 6 0 0 0 1.876-1.13 5.4 5.4 0 0 0 1.305-1.728 5.04 5.04 0 0 0 0-4.342A5.4 5.4 0 0 0 100.849 22a6 6 0 0 0-1.876-1.13 6.4 6.4 0 0 0-2.179-.404h-7.886V38.13h3.465v-6.793h2.907q.12.779.377 1.52a8.1 8.1 0 0 0 1.649 2.791 7.86 7.86 0 0 0 6.044 2.565l-.093-3.396a4.4 4.4 0 0 1-1.843-.348zm-9.042-10.608h4.348q.53.002 1.01.182.45.17.788.472c.214.19.38.41.493.647a1.7 1.7 0 0 1 0 1.477c-.113.24-.28.457-.493.647a2.5 2.5 0 0 1-.788.472 2.9 2.9 0 0 1-1.01.181h-4.348zm45.116 5.178a7.8 7.8 0 0 0-2.26-1.133 9.3 9.3 0 0 0-1.808-.38c-.351-.04-.683-.045-.976-.05q-.315-.003-.63-.028a5 5 0 0 1-1.061-.222 3.8 3.8 0 0 1-1.11-.566 2.2 2.2 0 0 1-.6-.667 1.13 1.13 0 0 1-.15-.6c.011-.219.082-.431.205-.613.151-.239.384-.468.675-.665.33-.224.735-.408 1.172-.53a5.35 5.35 0 0 1 3.019.061c.42.137.804.334 1.11.566.265.202.473.433.6.667q.16.298.15.6l3.462.128a4.46 4.46 0 0 0-.555-2.325 5.5 5.5 0 0 0-1.536-1.756 7.2 7.2 0 0 0-2.13-1.102 8.7 8.7 0 0 0-2.525-.423 8.8 8.8 0 0 0-2.547.316c-.78.215-1.52.554-2.192 1.004a5.7 5.7 0 0 0-1.642 1.663 4.47 4.47 0 0 0-.17 4.604c.36.662.877 1.252 1.535 1.754.62.47 1.336.842 2.132 1.103.587.192 1.194.32 1.81.38.327.033.639.04.914.044.24.004.464.01.657.03.39.043.768.122 1.123.235.475.151.907.365 1.254.62.301.222.538.475.683.731.116.195.175.418.17.644-.013.235-.092.461-.227.653-.17.258-.43.507-.757.721-.37.243-.825.44-1.316.572a6 6 0 0 1-1.706.2 6 6 0 0 1-1.682-.273 4.4 4.4 0 0 1-1.255-.62 2.4 2.4 0 0 1-.683-.73 1.2 1.2 0 0 1-.17-.646l-3.461-.125c-.032.84.17 1.652.6 2.415.385.683.935 1.29 1.636 1.805a7.8 7.8 0 0 0 2.262 1.133 9.5 9.5 0 0 0 2.9.44c.849 0 1.68-.108 2.474-.32a8 8 0 0 0 2.326-1.024c.728-.478 1.317-1.052 1.748-1.708a4.6 4.6 0 0 0 .774-2.367 4.5 4.5 0 0 0-.6-2.415c-.385-.683-.935-1.29-1.637-1.805z\"/>"
            "<text class=\"t i tl\" x=\"152\" y=\"38\">", _colorIndexToUnicode(params.colorIndex), "</text>"
            "<text class=\"t ts\" x=\"350\" y=\"22\" text-anchor=\"end\">Tree ", _toString(params.tree), " - Gen ", _toString(params.generation), "</text>"
            "<text class=\"t tm\" x=\"308\" y=\"40\">#", _padToThreeDigits(params.treeIndex), "</text>"
            "<rect class=\"b\" x=\"51\" y=\"51\" width=\"298\" height=\"298\" stroke-width=\"2\"/>"
            "<rect class=\"b\" x=\"56.5\" y=\"56.5\" width=\"287\" height=\"287\"/>"
            "<path class=\"b d\" d=\"M56 87.5h288 M56 103.5h288 M56 135.5h288 M56 151.5h288 M56 183.5h288 M56 199.5h288 M56 231.5h288 M56 247.5h288 M56 279.5h288 M56 295.5h288 M56 327.5h288\" />"
            "<path class=\"b d\" d=\"M87.5 87V56 M119.5 87V56 M151.5 87V56 M183.5 87V56 M215.5 87V56 M247.5 87V56 M279.5 87V56 M311.5 87V56 M87.5 135v-31 M119.5 135v-31 M151.5 135v-31 M183.5 135v-31 M215.5 135v-31 M247.5 135v-31 M279.5 135v-31 M311.5 135v-31 M87.5 183v-31 M119.5 183v-31 M151.5 183v-31 M183.5 183v-31 M215.5 183v-31 M247.5 183v-31 M279.5 183v-31 M311.5 183v-31 M87.5 231v-31 M119.5 231v-31 M151.5 231v-31 M183.5 231v-31 M215.5 231v-31 M247.5 231v-31 M279.5 231v-31 M311.5 231v-31 M87.5 279v-31 M119.5 279v-31 M151.5 279v-31 M183.5 279v-31 M215.5 279v-31 M247.5 279v-31 M279.5 279v-31 M311.5 279v-31 M87.5 327v-31 M119.5 327v-31 M151.5 327v-31 M183.5 327v-31 M215.5 327v-31 M247.5 327v-31 M279.5 327v-31 M311.5 327v-31\" />"
            "<text text-anchor=\"middle\"><tspan x=\"72 104 136 168 200 232 264 296 328 72 104 136 168 200 232 264 296 328 72 104 136 168 200 232 264 296 328 72 104 136 168 200 232 264 296 328 72 104 136 168 200 232 264 296 328 72 104 136 168 200 232 264 296 328\" y=\"74 74 74 74 74 74 74 74 74 122 122 122 122 122 122 122 122 122 170 170 170 170 170 170 170 170 170 218 218 218 218 218 218 218 218 218 266 266 266 266 266 266 266 266 266 314 314 314 314 314 314 314 314 314\">", params.message, "</tspan></text>"
            "<path class=\"icon\" fill=\"#78716C\" d=\"m78 333.1-4.5 2.6-.3-.6-1.3.8 2.9 5.8h-1.3l-2.4-4.8-2.6 5.7h-1.7l2.5-5.4-.5.3-.2-.3-3.3 2L64 337l3.4-2-.2-.4 4.3-2.5-.3-.5 4.4-2.6 2.4 4.1Z\"/>"
            "<text class=\"t ts\" x=\"82\" y=\"340\">", _toString(params.totalDistance / 1000), ".", _toString((params.totalDistance / 100) % 10), "km</text>"
            "<path class=\"icon\" fill=\"#78716C\" d=\"M298 331.3v4.7h2.9c0 1.7-1.3 3.1-3 3.1v1.6c2.5 0 4.4-2.1 4.4-4.7v-4.7h-4.3Zm7.3 0v4.7h2.9c0 1.7-1.3 3.1-3 3.1v1.6c2.5 0 4.4-2.1 4.4-4.7v-4.7h-4.3Z\"/>"
            "<text class=\"t ts\" x=\"314\" y=\"340\">", _padToThreeDigits(params.refCountValue), "</text>"
            "<text class=\"t tm\" x=\"50\" y=\"376\">",
            formatTimestamp(params.createdTimestamp),
            "</text>"
            "</svg>"
        ));
        offset = _append(outBuf, offset, blockAfterWaves);

        // Trim buffer to actual length
        assembly { mstore(outBuf, offset) }
        return string(outBuf);
    }
}
