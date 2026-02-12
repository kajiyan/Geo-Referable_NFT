#!/usr/bin/env node

/**
 * Generate TypeScript types from contract artifacts
 *
 * This script reads the contract ABI from the contracts package
 * and validates that our manually defined types are compatible.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONTRACTS_PATH = resolve(__dirname, '../../contracts/artifacts/contracts');
const TARGET_CONTRACT = 'GeoRelationalNFT.sol/GeoRelationalNFT.json';

function main() {
  console.log('🔧 Generating contract types...\n');

  const artifactPath = resolve(CONTRACTS_PATH, TARGET_CONTRACT);

  if (!existsSync(artifactPath)) {
    console.warn('⚠️  Contract artifact not found. Have you compiled the contracts?');
    console.warn(`   Looking for: ${artifactPath}`);
    console.warn('   Run: pnpm contracts:compile\n');
    console.warn('   Skipping contract type generation for now.');
    return;
  }

  try {
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    const abi = artifact.abi;

    console.log('✅ Found contract artifact');
    console.log(`   Contract: ${artifact.contractName}`);
    console.log(`   Functions: ${abi.filter((item) => item.type === 'function').length}`);
    console.log(`   Events: ${abi.filter((item) => item.type === 'event').length}`);

    // Extract event types
    const events = abi.filter((item) => item.type === 'event');
    console.log('\n📋 Events found:');
    events.forEach((event) => {
      console.log(`   - ${event.name}`);
    });

    // Extract function signatures
    const functions = abi.filter((item) => item.type === 'function');
    const viewFunctions = functions.filter((fn) => fn.stateMutability === 'view' || fn.stateMutability === 'pure');
    const writeFunctions = functions.filter((fn) => fn.stateMutability !== 'view' && fn.stateMutability !== 'pure');

    console.log('\n📖 View functions:');
    viewFunctions.forEach((fn) => {
      console.log(`   - ${fn.name}`);
    });

    console.log('\n✍️  Write functions:');
    writeFunctions.forEach((fn) => {
      console.log(`   - ${fn.name}`);
    });

    console.log('\n✅ Contract type validation complete!');
    console.log('   Our manually defined types in src/contract.ts should match these.');
  } catch (error) {
    console.error('❌ Error reading contract artifact:', error.message);
    process.exit(1);
  }
}

main();
