"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var hardhat_1 = require("hardhat");
var fs_1 = require("fs");
var path_1 = require("path");
/**
 * Generate SVG samples for all colorIndex values (0-13)
 *
 * This script creates 14 SVG files demonstrating each color variation
 * available in the Fumi.sol contract.
 */
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var DateTime, datetime, datetimeAddress, NOROSIFont, norosiFont, norosiFontAddress, Fumi, fumi, fumiAddress, outputDir, colorNames, baseTokenId, timestamp, message, totalDistance, generation, refCountValue, parentRefCount, treeIndex, colorIndex, referenceColorIndex, params, svg, filename, filepath, fileSize, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🎨 Generating SVG samples for all colorIndex values (0-13)...\n");
                    // Deploy DateTime library
                    console.log("Deploying DateTime library...");
                    return [4 /*yield*/, hardhat_1.ethers.getContractFactory("DateTime")];
                case 1:
                    DateTime = _a.sent();
                    return [4 /*yield*/, DateTime.deploy()];
                case 2:
                    datetime = _a.sent();
                    return [4 /*yield*/, datetime.waitForDeployment()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, datetime.getAddress()];
                case 4:
                    datetimeAddress = _a.sent();
                    console.log("\u2713 DateTime deployed at: ".concat(datetimeAddress, "\n"));
                    // Deploy NOROSIFont contract
                    console.log("Deploying NOROSIFont contract...");
                    return [4 /*yield*/, hardhat_1.ethers.getContractFactory("NOROSIFont")];
                case 5:
                    NOROSIFont = _a.sent();
                    return [4 /*yield*/, NOROSIFont.deploy()];
                case 6:
                    norosiFont = _a.sent();
                    return [4 /*yield*/, norosiFont.waitForDeployment()];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, norosiFont.getAddress()];
                case 8:
                    norosiFontAddress = _a.sent();
                    console.log("\u2713 NOROSIFont deployed at: ".concat(norosiFontAddress, "\n"));
                    // Deploy Fumi
                    console.log("Deploying Fumi contract...");
                    return [4 /*yield*/, hardhat_1.ethers.getContractFactory("Fumi")];
                case 9:
                    Fumi = _a.sent();
                    return [4 /*yield*/, Fumi.deploy(datetimeAddress, norosiFontAddress)];
                case 10:
                    fumi = _a.sent();
                    return [4 /*yield*/, fumi.waitForDeployment()];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, fumi.getAddress()];
                case 12:
                    fumiAddress = _a.sent();
                    console.log("\u2713 Fumi deployed at: ".concat(fumiAddress, "\n"));
                    outputDir = path_1.default.join(__dirname, "..", "svg-samples");
                    if (!fs_1.default.existsSync(outputDir)) {
                        fs_1.default.mkdirSync(outputDir, { recursive: true });
                    }
                    colorNames = [
                        "Pink", // 0: #F3A0B6
                        "Peach", // 1: #F7D6BA
                        "Mint", // 2: #D3FFE2
                        "Light Yellow", // 3: #FBFFC5
                        "Sky Blue", // 4: #C9EDFB
                        "Light Green", // 5: #B8B3FB
                        "Salmon", // 6: #9993FB
                        "Light Orange", // 7: #E3FFB2
                        "Purple", // 8: #8AD2B6
                        "Cyan", // 9: #E1FF86
                        "Lime", // 10: #DB78FB
                        "Magenta", // 11: #96FFCD
                        "Aqua", // 12: #93B2B6
                        "Gray" // 13: #B2B2B2 (static mode - no animations)
                    ];
                    baseTokenId = 123456789n;
                    timestamp = Math.floor(Date.now() / 1000);
                    message = "NOROSI Geo-relational NFT";
                    totalDistance = 1500000;
                    generation = 5;
                    refCountValue = 50;
                    parentRefCount = 8;
                    treeIndex = 42;
                    colorIndex = 0;
                    _a.label = 13;
                case 13:
                    if (!(colorIndex <= 13)) return [3 /*break*/, 18];
                    console.log("Generating SVG for colorIndex ".concat(colorIndex, " (").concat(colorNames[colorIndex], ")..."));
                    referenceColorIndex = (colorIndex + 7) % 14;
                    params = {
                        tokenId: baseTokenId + BigInt(colorIndex),
                        colorIndex: colorIndex,
                        referenceColorIndex: referenceColorIndex,
                        totalDistance: totalDistance,
                        createdTimestamp: timestamp,
                        message: message,
                        generation: generation,
                        treeIndex: treeIndex,
                        refCountValue: refCountValue,
                        parentRefCount: parentRefCount,
                        tree: colorIndex // Use colorIndex as tree ID for variety
                    };
                    _a.label = 14;
                case 14:
                    _a.trys.push([14, 16, , 17]);
                    return [4 /*yield*/, fumi.tokenSVG(params)];
                case 15:
                    svg = _a.sent();
                    filename = "color-".concat(colorIndex.toString().padStart(2, '0'), "-").concat(colorNames[colorIndex].toLowerCase().replace(/\s+/g, '-'), ".svg");
                    filepath = path_1.default.join(outputDir, filename);
                    fs_1.default.writeFileSync(filepath, svg);
                    fileSize = Buffer.byteLength(svg, 'utf8');
                    console.log("\u2713 Saved: ".concat(filename, " (").concat(fileSize.toLocaleString(), " bytes)"));
                    return [3 /*break*/, 17];
                case 16:
                    error_1 = _a.sent();
                    console.error("\u2717 Error generating SVG for colorIndex ".concat(colorIndex, ":"), error_1);
                    return [3 /*break*/, 17];
                case 17:
                    colorIndex++;
                    return [3 /*break*/, 13];
                case 18:
                    console.log("\n\u2705 Successfully generated 14 SVG files in ".concat(outputDir));
                    console.log("\nColor variations:");
                    colorNames.forEach(function (name, index) {
                        console.log("  ".concat(index.toString().padStart(2, ' '), ": ").concat(name).concat(index === 13 ? ' (static mode)' : ''));
                    });
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return process.exit(0); })
    .catch(function (error) {
    console.error(error);
    process.exit(1);
});
