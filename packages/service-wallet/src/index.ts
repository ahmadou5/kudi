/**
 * service-wallet - Wallet service orchestration
 *
 * Wallet generation and management, chain configuration,
 * and custody provider selection following pila's pattern.
 */

import { PrivyClient } from '@kudi/provider-privy';
import { AlchemyProvider } from '@kudi/provider-alchemy';
import { SolanaProvider } from '@kudi/provider-solana';
import { StellarProvider } from '@kudi/provider-stellar';
import { validateCryptoAddress, formatUSDC, normalizeDecimalAmount } from '@kudi/provider-crypto';
import { CustodyProvider, CustodyTrack, DepositWallet } from '@kudi/types';

export interface WalletConfig {
  userId: string;
  chain: 'solana' | 'monad' | 'stellar';
  custodyTrack: CustodyTrack;
}

export interface WalletGenerationResult {
  walletId: string;
  address: string;
  chain: string;
  track: CustodyTrack;
  createdAt: string;
}

export interface ChainConfig {
  id: string;
  name: string;
  type: 'solana' | 'evm' | 'stellar';
  rpcUrl: string;
  rpcUrlFallback?: string;
  usdcMintAddress?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  confirmationThreshold?: number;
  enabled: boolean;
}

export class WalletService {
  private privyClient: PrivyClient;
  privatealchemyProvider: AlchemyProvider;
  private solanaProvider: SolanaProvider;
  private stellarProvider: StellarProvider;

  constructor() {
    this.privyClient = new PrivyClient({
      appID: process.env.PRIVY_APP_ID || '',
      appSecret: process.env.PRIVY_APP_SECRET || ''
    });
    this.alchemyProvider = new AlchemyProvider({
      apiKey: process.env.ALCHEMY_API_KEY || '',
      gasPolicyId: process.env.ALCHEMY_GAS_POLICY_ID || ''
    });
    this.solanaProvider = new SolanaProvider({
      usdcMintAddress: process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      rpcUrlFallback: process.env.SOLANA_RPC_URL_FALLBACK
    });
    this.stellarProvider = new StellarProvider({
      gasWalletId: process.env.PRIVY_STELLAR_GAS_WALLET_ID || '',
      gasWalletPubkey: process.env.PRIVY_STELLAR_GAS_WALLET_PUBKEY || '',
      network: 'testnet'
    });
  }

  /**
   * Generate a new wallet for a user on the specified chain.
   * Selects the appropriate custody provider based on track.
   */
  public async generateWallet(config: WalletConfig): Promise<WalletGenerationResult> {
    const { userId, chain, custodyTrack } = config;

    let wallet: DepositWallet;

    switch (custodyTrack) {
      case CustodyTrack.TRACK_A_SELF_CUSTODY:
        wallet = await this.privyClient.createEmbeddedWallet(
          chain === 'solana' ? 'solana' : 'ethereum',
          userId
        );
        break;
      case CustodyTrack.TRACK_B_PARTNER:
        // Partner custody would call VASP API
        throw new Error('Partner custody wallet generation not yet implemented');
      default:
        throw new Error(`Unsupported custody track: ${custodyTrack}`);
    }

    return {
      walletId: wallet.id || 'placeholder-wallet-id',
      address: wallet.address,
      chain,
      track: custodyTrack,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Get chain configuration for the specified chain.
   */
  public getChainConfig(chain: 'solana' | 'monad' | 'stellar'): ChainConfig {
    switch (chain) {
      case 'solana':
        return {
          id: 'solana-devnet',
          name: 'Solana Devnet',
          type: 'solana',
          rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
          usdcMintAddress: process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
          tokenSymbol: 'USDC',
          tokenDecimals: 6,
          confirmationThreshold: 1,
          enabled: true
        };
      case 'monad':
        return {
          id: 'monad-testnet',
          name: 'Monad Testnet',
          type: 'evm',
          rpcUrl: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
          tokenAddress: process.env.AUSD_TOKEN_ADDRESS || '0x534b2f3A21130d7a60830c2Df862319e593943A3',
          tokenSymbol: 'AUSD',
          tokenDecimals: 6,
          confirmationThreshold: 1,
          enabled: true
        };
      case 'stellar':
        return {
          id: 'stellar-testnet',
          name: 'Stellar Testnet',
          type: 'stellar',
          network: 'testnet',
          enabled: true
        };
      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  /**
   * Select the appropriate custody provider based on track and chain.
   */
  public selectProvider(track: CustodyTrack, chain: 'solana' | 'monad' | 'stellar'): import('@kudi/provider-crypto' | '@kudi/provider-solana' | '@kudi/provider-alchemy' | '@kudi/provider-stellar' | '@kudi/provider-privy') {
    switch (track) {
      case CustodyTrack.TRACK_A_SELF_CUSTODY:
        return this.privyClient;
      case CustodyTrack.TRACK_B_PARTNER:
        // Return partner provider
        throw new Error('Partner provider not yet implemented');
      default:
        throw new Error(`Unsupported custody track: ${track}`);
    }
  }

  /**
   * Normalize an amount string for the specified chain's decimals.
   */
  public normalizeAmount(amount: string | number, decimals: number): string {
    return normalizeDecimalAmount(amount, decimals);
  }

  /**
   * Validate a crypto address for the specified chain.
   */
  public validateAddress(address: string, chain: 'solana' | 'monad' | 'stellar'): boolean {
    return validateCryptoAddress(address, chain);
  }
}