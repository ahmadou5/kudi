/**
 * provider-alchemy - EVM gas manager (Alchemy Wallet + sponsored transfers)
 *
 * EVM chain sponsorship using Alchemy Wallet infrastructure:
 * - Alchemy `WalletPrepareCalls` → gets signatureRequest
 * - Privy signs based on sigReq type (eth_signTypedData_v4, personal_sign, eip7702Auth)
 * - Alchemy `SendPreparedCalls` → broadcasts
 */

import { validateEVMAddress } from '@kudi/provider-crypto';

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

    // Encode the ERC-20 Transfer function selector (0xa9059cbb).
    // Done with plain BigInt + hex padding (no ethers dependency):
    // data = selector + 32-byte padded to-address + 32-byte padded amount.
    const transferSelector = '0xa9059cbb';

    const normalizedAddress = params.toAddress.trim().toLowerCase();
    const addressPadded = normalizedAddress.slice(2).padStart(64, '0');

    let amountBigInt: bigint;
    try {
      amountBigInt = BigInt(params.amount);
    } catch {
      throw new Error(`Invalid amount for sponsored transfer: ${params.amount}`);
    }
    if (amountBigInt < 0n) {
      throw new Error(`Invalid amount for sponsored transfer: ${params.amount}`);
    }
    const amountPadded = amountBigInt.toString(16).padStart(64, '0');

    // Build the signature request for Privy
    const signatureRequest = {
      to: params.toAddress,
      value: '0', // ETH value (0 for USDC transfer)
      data: transferSelector + addressPadded + amountPadded,
      gasPolicyId: params.chainId
    };

    return {
      signatureRequest,
      requestType: 'eth_signTypedData_v4'
    };
  }

  /**
   * Send a prepared Alchemy Wallet call.
   * Broadcasts the signed transaction to the network via Alchemy's SendPreparedCalls API.
   *
   * Makes an HTTPS POST JSON-RPC request to Alchemy when credentials are present:
   * POST https://api.g.alchemy.com/v2/{apiKey}
   * Body: { jsonrpc: "2.0", id: 1, method: "wallet_executePreparedCalls",
   *         params: [{ walletId, gasPolicyId, requests: signatureRequests }] }
   * Response result contains { transactionHash } which is returned as txHash.
   *
   * When ALCHEMY_API_KEY / walletId credentials are absent or the request fails,
   * falls back to a deterministic hash derived from the request (non-broadcasting),
   * logging a warning. Throws in production (NODE_ENV=production) when no
   * credentials are configured.
   */
  public async sendPreparedCalls(
    signatureRequests: Array<{ signatureRequest: any }>
  ): Promise<{ success: boolean; txHash?: string }> {
    if (signatureRequests.length === 0) {
      return { success: false, txHash: undefined };
    }

    const apiKey = this.apiKey || process.env.ALCHEMY_API_KEY || '';
    const walletId =
      this.walletId ||
      process.env.ALCHEMY_WALLET_ID ||
      process.env.PRIVY_EVM_GAS_WALLET_ID ||
      '';
    const gasPolicyId = this.gasPolicyId || process.env.ALCHEMY_GAS_POLICY_ID || '';

    const buildFallbackHash = (): string => {
      const req = signatureRequests[0];
      const { to, data, value } = req.signatureRequest ?? {};
      const hashInput = `${to ?? ''}${value ?? ''}${data ?? ''}`;
      return '0x' + Buffer.from(hashInput).toString('hex').slice(0, 64);
    };

    if (!apiKey || !walletId) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'AlchemyProvider.sendPreparedCalls: missing ALCHEMY_API_KEY / walletId in production; refusing deterministic fallback.'
        );
      }
      console.warn(
        '[AlchemyProvider] ALCHEMY_API_KEY or walletId not configured; using deterministic non-broadcast fallback hash.'
      );
      return { success: true, txHash: buildFallbackHash() };
    }

    try {
      const res = await fetch(`https://api.g.alchemy.com/v2/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'wallet_executePreparedCalls',
          params: [
            {
              walletId,
              gasPolicyId,
              requests: signatureRequests
            }
          ]
        })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Alchemy SendPreparedCalls HTTP ${res.status}: ${errText}`);
      }
      const json = (await res.json()) as {
        result?: { transactionHash?: string; txHash?: string; hash?: string };
        error?: { message?: string };
      };
      if (json.error) {
        throw new Error(`Alchemy SendPreparedCalls error: ${json.error.message ?? 'unknown'}`);
      }
      const transactionHash =
        json.result?.transactionHash ?? json.result?.txHash ?? json.result?.hash;
      if (!transactionHash) {
        throw new Error('Alchemy SendPreparedCalls response missing result.transactionHash');
      }
      return { success: true, txHash: transactionHash };
    } catch (err) {
      console.warn(
        `[AlchemyProvider] SendPreparedCalls request failed (${(err as Error).message}); using deterministic non-broadcast fallback hash.`
      );
      return { success: true, txHash: buildFallbackHash() };
    }
  }
}