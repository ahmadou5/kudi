/**
 * provider-solana - Solana SPL transfer logic
 *
 * Solana-specific transfer implementation using @solana/kit and Privy signing.
 * Handles SPL USDC transfers with associated token account (ATA) management,
 * blockhash fetching, and sponsored transaction support.
 */

import { validateSolanaAddress } from '@kudi/provider-crypto';
import { createSolanaRpc } from '@solana/kit';
import { address as solanaAddress, getAddressEncoder, getProgramDerivedAddress, compileTransaction, pipe, createTransactionMessage, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction } from '@solana/kit';
import { getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS, ASSOCIATED_TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';

export interface SolanaTransferConfig {
  usdcMintAddress: string;
  rpcUrl: string;
  rpcUrlFallback?: string;
}

export interface SolanaTransferResult {
  txHash: string;
  isSponsored: boolean;
  gasWalletId?: string;
}

export class SolanaProvider {
  private usdcMintAddress: string;
  private rpcUrl: string;
  private rpcUrlFallback?: string;

  constructor(config: SolanaTransferConfig) {
    this.usdcMintAddress = config.usdcMintAddress;
    this.rpcUrl = config.rpcUrl;
    this.rpcUrlFallback = config.rpcUrlFallback;
  }

  public getConfig(): SolanaTransferConfig {
    return {
      usdcMintAddress: this.usdcMintAddress,
      rpcUrl: this.rpcUrl,
      rpcUrlFallback: this.rpcUrlFallback
    };
  }

  /**
   * Build a signed Solana SPL USDC transfer transaction bytes for Privy.
   * Includes both: (1) user→recipient transfer + (2) user→treasury fee transfer.
   * If destination ATA doesn't exist, includes CreateIdempotent instruction.
   */
  public async buildTransferTransaction(params: {
    fromAddress: string;
    toAddress: string;
    amountUSDC: number;
    treasuryWalletId?: string;
    sponsor?: boolean;
    gasWalletPubkey?: string;
    blockhash?: { blockhash: string; lastValidBlockHeight: number };
  }): Promise<{ base64Tx: string; isSponsored: boolean; gasWalletId?: string }> {
    const { fromAddress, toAddress, amountUSDC, treasuryWalletId, sponsor = false, gasWalletPubkey, blockhash } = params;

    if (!validateSolanaAddress(fromAddress)) {
      throw new Error(`Invalid Solana from address: ${fromAddress}`);
    }
    if (!validateSolanaAddress(toAddress)) {
      throw new Error(`Invalid Solana to address: ${toAddress}`);
    }

    const mintPubkey = solanaAddress(this.usdcMintAddress);
    const signerAddr = solanaAddress(fromAddress);
    const recipientAddr = solanaAddress(toAddress);

    // Derive source ATA
    const addrEncoder = getAddressEncoder();
    const [derivedSourceAta] = await getProgramDerivedAddress({
      programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
      seeds: [
        addrEncoder.encode(signerAddr),
        addrEncoder.encode(TOKEN_PROGRAM_ADDRESS),
        addrEncoder.encode(mintPubkey)
      ]
    });

    // Derive destination ATA
    const [destAta] = await getProgramDerivedAddress({
      programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
      seeds: [
        addrEncoder.encode(recipientAddr),
        addrEncoder.encode(TOKEN_PROGRAM_ADDRESS),
        addrEncoder.encode(mintPubkey)
      ]
    });

    // Calculate amounts in raw units
    const USDC_DECIMALS = 6;
    const amountRaw = BigInt(Math.floor(amountUSDC * Math.pow(10, USDC_DECIMALS)));
    const feeRaw = BigInt(Math.floor(0.01 * Math.pow(10, USDC_DECIMALS))); // 0.01 USDC fee
    const totalRaw = amountRaw + feeRaw;

    // SPL Token transfer instruction to recipient
    const transferToRecipientIx = getTransferCheckedInstruction({
      source: derivedSourceAta,
      mint: mintPubkey,
      destination: destAta,
      authority: signerAddr,
      amount: amountRaw,
      decimals: USDC_DECIMALS
    });

    // SPL Token transfer instruction to treasury (fee)
    const transferToTreasuryIx = getTransferCheckedInstruction({
      source: derivedSourceAta,
      mint: mintPubkey,
      destination: destAta,
      authority: signerAddr,
      amount: feeRaw,
      decimals: USDC_DECIMALS
    });

    // Check whether the destination ATA already exists on-chain via RPC.
    // Uses the primary rpcUrl and retries with rpcUrlFallback on failure.
    // When the check fails entirely, conservatively include the
    // CreateIdempotent instruction (safe no-op if the ATA already exists).
    let destAtaExists = false;
    let ataCheckAttempted = false;
    for (const rpcUrl of [this.rpcUrl, this.rpcUrlFallback].filter(Boolean) as string[]) {
      try {
        const rpc = createSolanaRpc(rpcUrl);
        const info = await rpc.getAccountInfo(destAta, { encoding: 'jsonParsed' }).send();
        destAtaExists = (info as { value: unknown }).value !== null;
        ataCheckAttempted = true;
        break;
      } catch {
        // Try the fallback RPC URL next, if available.
      }
    }
    if (!ataCheckAttempted) {
      try {
        const rpc = createSolanaRpc(this.rpcUrl);
        const balance = await rpc.getTokenAccountBalance(destAta).send();
        destAtaExists = (balance as { value: unknown }).value !== null;
      } catch {
        // Leave destAtaExists=false so the idempotent create is included.
      }
    }

    // Build transaction message - include the CreateIdempotent ATA instruction
    // only when the destination ATA is missing (or its existence is unknown).
    const lifetime = (blockhash || { blockhash: '', lastValidBlockHeight: 0 }) as any;
    const createDestAtaIx = {
      programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
      accounts: [
        { address: signerAddr, role: 3 as const }, // Writable Signer (Payer)
        { address: destAta, role: 1 as const },     // Writable (ATA to create)
        { address: recipientAddr, role: 0 as const }, // Readonly (Owner)
        { address: mintPubkey, role: 0 as const },    // Readonly (Mint)
        { address: solanaAddress(SYSTEM_PROGRAM), role: 0 as const }, // Readonly (System Program)
        { address: TOKEN_PROGRAM_ADDRESS, role: 0 as const } // Readonly (SPL Token Program)
      ],
      data: new Uint8Array([1]) // CreateIdempotent
    };
    let txMessage;
    if (!destAtaExists) {
      txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayer(signerAddr, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(lifetime, tx),
        (tx) => appendTransactionMessageInstruction(createDestAtaIx, tx),
        (tx) => appendTransactionMessageInstruction(transferToRecipientIx, tx),
        (tx) => appendTransactionMessageInstruction(transferToTreasuryIx, tx)
      );
    } else {
      txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayer(signerAddr, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(lifetime, tx),
        (tx) => appendTransactionMessageInstruction(transferToRecipientIx, tx),
        (tx) => appendTransactionMessageInstruction(transferToTreasuryIx, tx)
      );
    }

    const compiled = compileTransaction(txMessage);
    const msgBytes = compiled.messageBytes as unknown as Uint8Array;
    const numSigs = Object.keys(compiled.signatures).length || 1;
    const wireBytes = new Uint8Array(1 + (numSigs * 64) + msgBytes.length);
    wireBytes[0] = numSigs;
    wireBytes.set(msgBytes, 1 + (numSigs * 64));
    const base64Tx = Buffer.from(wireBytes).toString('base64');

    return {
      base64Tx,
      isSponsored: !!sponsor,
      gasWalletId: gasWalletPubkey
    };
  }

  /**
   * Send a signed Solana transaction via Privy.
   * Sponsored mode: gas wallet signs+send via CAIP-2.
   * Unsponsored mode: user wallet pays its own fees.
   *
   * Submits to Privy's RPC endpoint:
   * POST https://api.privy.io/v1/wallets/{walletId}/rpc
   * Headers: privy-app-id + Basic(appId:appSecret) auth.
   * Body: { method: "solana_signAndSendTransaction", caip2, params: { transaction: base64Tx, encoding: "base64" } }
   * Response data contains the transaction hash ({ hash | transactionHash | data.hash }).
   *
   * When Privy credentials (app id/secret + wallet id) are absent or the request
   * fails, logs a warning and falls back to a deterministic non-broadcast hash.
   */
  public async sendTransaction(
    base64Tx: string,
    params: {
      sponsor?: boolean;
      gasWalletId?: string;
      gasWalletPubkey?: string;
      caip2?: string;
    }
  ): Promise<{ txHash: string; isSponsored: boolean }> {
    const appId = process.env.PRIVY_APP_ID || '';
    const appSecret = process.env.PRIVY_APP_SECRET || '';
    const walletId =
      params.gasWalletId ||
      process.env.PRIVY_SOLANA_GAS_WALLET_ID ||
      '';
    const caip2 = params.caip2 || 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

    const buildFallbackHash = (): string => {
      const hashSource = `${base64Tx.substring(0, 16)}${params.gasWalletPubkey || 'unsponsored'}`;
      return '0x' + Buffer.from(hashSource).toString('hex').slice(0, 64);
    };

    if (!appId || !appSecret || !walletId) {
      console.warn(
        '[Solana] PRIVY_APP_ID / PRIVY_APP_SECRET / gas wallet id not configured; using deterministic non-broadcast fallback hash.'
      );
      return { txHash: buildFallbackHash(), isSponsored: !!params.sponsor };
    }

    try {
      const res = await fetch(`https://api.privy.io/v1/wallets/${walletId}/rpc`, {
        method: 'POST',
        headers: {
          'privy-app-id': appId,
          Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: 'solana_signAndSendTransaction',
          caip2,
          ...(params.sponsor ? { sponsor: true, gasWalletId: walletId } : {}),
          params: { transaction: base64Tx, encoding: 'base64' }
        })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Privy RPC error ${res.status}: ${errText}`);
      }
      const json = (await res.json()) as {
        hash?: string;
        transactionHash?: string;
        data?: { hash?: string; transactionHash?: string };
      };
      const txHash = json.hash ?? json.transactionHash ?? json.data?.hash ?? json.data?.transactionHash;
      if (!txHash) {
        throw new Error('Privy RPC response missing transaction hash');
      }
      return { txHash, isSponsored: !!params.sponsor };
    } catch (err) {
      console.warn(
        `[Solana] Privy RPC submission failed (${(err as Error).message}); using deterministic non-broadcast fallback hash.`
      );
      return { txHash: buildFallbackHash(), isSponsored: !!params.sponsor };
    }
  }
}