import {
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
  type Hash,
} from 'viem';
import { geoNftAbi } from './abi.js';
import type { GeoLocation, MintParams, UpdateGeoLocationParams } from './types.js';

/**
 * GeoNFT Client for interacting with the GeoNFT smart contract
 */
export class GeoNFTClient {
  private publicClient: PublicClient;
  private walletClient?: WalletClient<Transport, Chain, Account>;
  private contractAddress: `0x${string}`;

  constructor(
    publicClient: PublicClient,
    contractAddress: `0x${string}`,
    walletClient?: WalletClient<Transport, Chain, Account>,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.contractAddress = contractAddress;
  }

  /**
   * Mint a new GeoNFT
   */
  async mint(params: MintParams): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client is required for minting');
    }

    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: geoNftAbi,
      functionName: 'mint',
      args: [params.to, params.uri, params.latitude, params.longitude, params.radius],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  /**
   * Update geographical location of an existing token
   */
  async updateGeoLocation(params: UpdateGeoLocationParams): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client is required for updating geo location');
    }

    const { request } = await this.publicClient.simulateContract({
      address: this.contractAddress,
      abi: geoNftAbi,
      functionName: 'updateGeoLocation',
      args: [params.tokenId, params.latitude, params.longitude, params.radius],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  /**
   * Get geographical location data for a token
   */
  async getGeoLocation(tokenId: bigint): Promise<GeoLocation> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: geoNftAbi,
      functionName: 'getGeoLocation',
      args: [tokenId],
    });

    return {
      latitude: result.latitude,
      longitude: result.longitude,
      radius: result.radius,
      timestamp: result.timestamp,
    };
  }

  /**
   * Get the owner of a token
   */
  async ownerOf(tokenId: bigint): Promise<`0x${string}`> {
    return await this.publicClient.readContract({
      address: this.contractAddress,
      abi: geoNftAbi,
      functionName: 'ownerOf',
      args: [tokenId],
    });
  }

  /**
   * Get the token URI
   */
  async tokenURI(tokenId: bigint): Promise<string> {
    return await this.publicClient.readContract({
      address: this.contractAddress,
      abi: geoNftAbi,
      functionName: 'tokenURI',
      args: [tokenId],
    });
  }

  /**
   * Get the total supply of tokens
   */
  async totalSupply(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.contractAddress,
      abi: geoNftAbi,
      functionName: 'totalSupply',
    });
  }

  /**
   * Watch for GeoNFTMinted events
   */
  watchMintedEvents(
    onLogs: (
      logs: Array<{
        tokenId: bigint;
        owner: `0x${string}`;
        latitude: bigint;
        longitude: bigint;
        radius: bigint;
      }>,
    ) => void,
  ) {
    return this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: geoNftAbi,
      eventName: 'GeoNFTMinted',
      onLogs: (logs) => {
        const parsedLogs = logs.map((log) => ({
          tokenId: log.args.tokenId!,
          owner: log.args.owner!,
          latitude: log.args.latitude!,
          longitude: log.args.longitude!,
          radius: log.args.radius!,
        }));
        onLogs(parsedLogs);
      },
    });
  }

  /**
   * Watch for GeoLocationUpdated events
   */
  watchLocationUpdatedEvents(
    onLogs: (
      logs: Array<{
        tokenId: bigint;
        latitude: bigint;
        longitude: bigint;
        radius: bigint;
      }>,
    ) => void,
  ) {
    return this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: geoNftAbi,
      eventName: 'GeoLocationUpdated',
      onLogs: (logs) => {
        const parsedLogs = logs.map((log) => ({
          tokenId: log.args.tokenId!,
          latitude: log.args.latitude!,
          longitude: log.args.longitude!,
          radius: log.args.radius!,
        }));
        onLogs(parsedLogs);
      },
    });
  }
}
