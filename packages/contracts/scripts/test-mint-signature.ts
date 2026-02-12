import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x776Cd3f6FC7558d7e930a656288116ca1D242008";
  
  const contract = await ethers.getContractAt("GeoRelationalNFT", contractAddress);
  
  // Check contract state
  console.log("Contract address:", contractAddress);
  console.log("Owner:", await contract.owner());
  
  // Check nonce for the user
  const userAddress = "0x113E971Bf59b8c7F3C276EBf97dd7646D97F22eC";
  const nonce = await contract.nonces(userAddress);
  console.log("Current nonce for user:", nonce.toString());
  
  // Try to simulate the mint call with the exact parameters from the error
  const to = userAddress;
  const latitude = 35150053n;
  const longitude = 136911399n;
  const elevation = 70000n;
  const colorIndex = 1n;
  const message = "0"; // String "0"
  const h3 = {
    h3r6: "862e60547ffffff",
    h3r8: "882e605451fffff",
    h3r10: "8a2e60545077fff",
    h3r12: "8c2e605450721ff"
  };
  const signature = "0x5876e22b1598e1d557af35540495883907234684be0824a3069a8355c46bbfad248962fb52130fd2df9a6352937dd7d4001acc2ce5063c636af56c2c2e6c38d41c";
  
  console.log("\nAttempting signedMint with:");
  console.log("  to:", to);
  console.log("  latitude:", latitude.toString());
  console.log("  longitude:", longitude.toString());
  console.log("  elevation:", elevation.toString());
  console.log("  colorIndex:", colorIndex.toString());
  console.log("  message:", message, "(type:", typeof message, ")");
  console.log("  h3:", h3);
  console.log("  signature:", signature.slice(0, 40) + "...");
  
  try {
    // Try to estimate gas (this will fail if the contract would revert)
    const gasEstimate = await contract.signedMint.estimateGas(
      to, latitude, longitude, elevation, colorIndex, message, h3, signature
    );
    console.log("\n✅ Gas estimate succeeded:", gasEstimate.toString());
  } catch (error: any) {
    console.log("\n❌ Error:", error.message);
    if (error.data) {
      console.log("Error data:", error.data);
    }
    if (error.reason) {
      console.log("Revert reason:", error.reason);
    }
  }
}

main().catch(console.error);
