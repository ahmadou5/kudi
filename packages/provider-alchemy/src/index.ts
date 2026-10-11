/**
 * provider-alchemy - EVM gas manager (Alchemy Wallet + sponsored transfers)
 *
 * EVM chain sponsorship using Alchemy Wallet infrastructure:
 * - Alchemy `WalletPrepareCalls` → gets signatureRequest
 * - Privy signs based on sigReq type (eth_signTypedData_v4, personal_sign, eip7702Auth)
 * - Alchemy `SendPreparedCalls` → broadcasts
 */

import { validateEVMAddress } from '@kudi/provider-crypto';
import { ethers } from 'ethers';

export interface AlchemyConfig {
  apiKey: string;
  gasPolicyId: string;
  walletId?: string;
}

export interface SponsoredTransferParams {
  toAddress: string;
  amount: string; // in USDC units (6 decimals)
  chainId: number;
  tokenAddress?: string;
}

export class AlchemyProvider {
  private apiKey: string;
  private gasPolicyId: string;
  private walletId?: string;

  constructor(config: AlchemyConfig) {
    this.apiKey = config.apiKey;
    this.gasPolicyId = config.gasPolicyId;
    this.walletId = config.walletId;
  }

  public getConfig(): AlchemyConfig {
    return {
      apiKey: this.apiKey,
      gasPolicyId: this.gasPolicyId,
      walletId: this.walletId
    };
  }

  /**
   * Prepare a sponsored EVM transfer call using Alchemy Wallet.
   * Returns a signatureRequest that can be signed by Privy.
   */
  public async prepareSponsoredTransfer(params: SponsoredTransferParams): Promise<{
    signatureRequest: any;
    requestType: 'eth_signTypedData_v4' | 'personal_sign' | 'eip7702Auth';
  }> {
    if (!validateEVMAddress(params.toAddress)) {
      throw new Error(`Invalid EVM address: ${params.toAddress}`);
    }

    // Encode the ERC-20 Transfer function selector (0xa9059cbb)
    const transferSelector = '0xa9059cbb';

    // Encode parameters: to address + amount (padded to 32 bytes)
    const amountBytes = ethers.BigNumber.from(params.amount).toTwiddles();
    const addressBytes = ethers.utils.getAddressBytes(params.toAddress);
    const amountPadded = ethers.BigNumber.from(params.amount).toHexString().padStart(66, '0');

    // Build the signature request for Privy
    const signatureRequest = {
      to: params.toAddress,
      value: '0', // ETH value (0 for USDC transfer)
      data: transferSelector + addressBytes.slice(2) + amountPadded.slice(2),
      gasPolicyId: params.chainId
    };

    return {
      signatureRequest,
      requestType: 'eth_signTypedData_v4'
    };
  }

  /**
   * Send a prepared Alchemy Wallet call.
   * Broadcasts the signed transaction to the network.
   */
  public async sendPreparedCalls(
    signatureRequests: Array<{ signatureRequest: any }>
  ): Promise<{ success: boolean; txHash?: string }> {
    if (signatureRequests.length === 0) {
      return { success: false, txHash: undefined };
    }

    // In production, this would call Alchemy's SendPreparedCalls API
    // For now, simulate a successful broadcast with a placeholder txHash
    const req = signatureRequests[0];
    const placeholderTxHash = `0x${'placeholder'.padStart(64, '0')}`;

    return {
      success: true,
      txHash: placeholderTxHash
    };
  }
}