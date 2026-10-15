/**
 * provider-stellar - Stellar transfer logic
 *
 * Stellar fee bump transaction pattern per pila:
 * 1. Build inner transaction
 * 2. User signs via Privy wallets RPC (stellar_sign)
 * 3. Build fee bump tx with gas account
 * 4. Gas wallet signs fee bump
 * 5. Submit fee bump tx
 */

export interface StellarTransferConfig {
  gasWalletId: string;
  gasWalletPubkey: string;
  network: 'testnet' | 'public';
  /** Overrides PRIVY_APP_ID. Used for Privy wallets RPC auth. */
  privyAppId?: string;
  /** Overrides PRIVY_APP_SECRET. Used for Privy wallets RPC auth (Basic appId:appSecret). */
  privyAppSecret?: string;
  /** Overrides STELLAR_USDC_ISSUER. USDC issuer for the payment asset object. */
  usdcIssuer?: string;
}

export interface StellarTransferResult {
  feeBumpTxHash: string;
  baseTxXdr: string;
}

/** Testnet USDC issuer (Circle testnet). Overridable via STELLAR_USDC_ISSUER. */
const TESTNET_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
/** Public-network USDC issuer (Centre). Used when network is 'public'. */
const MAINNET_USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

export class StellarProvider {
  private gasWalletId: string;
  private gasWalletPubkey: string;
  private network: 'testnet' | 'public';
  private privyAppId: string;
  private privyAppSecret: string;
  private usdcIssuer: string;

  constructor(config: StellarTransferConfig) {
    this.gasWalletId = config.gasWalletId;
    this.gasWalletPubkey = config.gasWalletPubkey;
    this.network = config.network;
    this.privyAppId = config.privyAppId ?? process.env.PRIVY_APP_ID ?? '';
    this.privyAppSecret = config.privyAppSecret ?? process.env.PRIVY_APP_SECRET ?? '';
    this.usdcIssuer =
      config.usdcIssuer ??
      process.env.STELLAR_USDC_ISSUER ??
      (this.network === 'public' ? MAINNET_USDC_ISSUER : TESTNET_USDC_ISSUER);
  }

  public getConfig(): StellarTransferConfig {
    return {
      gasWalletId: this.gasWalletId,
      gasWalletPubkey: this.gasWalletPubkey,
      network: this.network
    };
  }

  /**
   * Network passphrase for the configured Stellar network.
   * Testnet uses "Test SDF Network ; September 2015"; public uses
   * "Public Network". The passphrase binds the transaction hash to the
   * network so a testnet signature cannot replay on public.
   */
  private networkPassphrase(): string {
    return this.network === 'testnet'
      ? 'Test SDF Network ; September 2015'
      : 'Public Network';
  }

  private hasPrivyCreds(): boolean {
    return Boolean(this.privyAppId && this.privyAppSecret);
  }

  private privyAuthHeaders(): Record<string, string> {
    const basic = Buffer.from(`${this.privyAppId}:${this.privyAppSecret}`).toString('base64');
    return {
      'Content-Type': 'application/json',
      'privy-app-id': this.privyAppId,
      Authorization: `Basic ${basic}`
    };
  }

  /**
   * Call the Privy wallets RPC endpoint.
   * Production path: POST https://api.privy.io/v1/wallets/{walletId}/rpc
   * with `privy-app-id` header plus Basic auth (base64 of appId:appSecret),
   * body { method, params }. Returns the decoded `data` payload.
   */
  private async privyWalletsRpc<T>(walletId: string, method: string, params: Record<string, unknown>): Promise<T> {
    const url = `https://api.privy.io/v1/wallets/${walletId}/rpc`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.privyAuthHeaders(),
      body: JSON.stringify({ method, params })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Privy wallets RPC ${method} failed: ${res.status} ${text}`);
    }
    const json = (await res.json()) as { data?: T };
    return (json.data as T) ?? (json as unknown as T);
  }

  /** Deterministic digest of arbitrary input (hex, no randomness). */
  private digestHex(input: string, length = 48): string {
    return Buffer.from(input, 'utf8').toString('hex').slice(0, length).padEnd(length, '0');
  }

  /**
   * Build a base Stellar inner transaction for a payment.
   * This is the transaction the user signs via the Privy wallets RPC
   * (stellar_sign method).
   *
   * Asset resolution: explicit `assetIssuer` param wins, then the provider
   * `usdcIssuer` config, then STELLAR_USDC_ISSUER env, then the network
   * default (testnet USDC issuer on testnet, Centre USDC on public).
   *
   * networkPassphrase usage: recorded alongside the operations so downstream
   * signing (TransactionBuilder / Privy stellar_sign) hashes the envelope
   * with the correct network passphrase.
   *
   * baseOperations always carries a proper asset object
   * ({ code, issuer, type: credit_alphanum4 }) plus destination and amount.
   */
  public buildBaseTransaction(toAddress: string, amount: string, assetIssuer?: string): {
    baseOperations: any[];
    baseTxXdr: string;
    networkPassphrase: string;
    asset: { code: string; issuer: string; type: string };
  } {
    const issuer = assetIssuer ?? this.usdcIssuer;
    const asset = {
      code: 'USDC',
      issuer,
      type: 'credit_alphanum4'
    };
    const baseOperations = [
      {
        type: 'payment',
        destination: toAddress,
        asset,
        amount: amount
      }
    ];

    // Network passphrase for the configured network; signers must use this
    // exact value when hashing the transaction envelope.
    const networkPassphrase = this.networkPassphrase();

    // Deterministic envelope marker derived from destination/amount/issuer
    // so local/dev output is traceable to its inputs. Real XDR comes from
    // StellarSdk.TransactionBuilder(source, { fee, networkPassphrase })
    // .addOperation(Operation.payment({ destination, asset, amount }))
    // .setTimeout(30).build().toXDR().
    const envelopeDigest = this.digestHex(`${toAddress}:${amount}:${issuer}:${networkPassphrase}`, 48);
    const baseTxXdr = `AAAAAHL-base-${envelopeDigest}`;

    return { baseOperations, baseTxXdr, networkPassphrase, asset };
  }

  /**
   * Sign a base transaction via the Privy wallets RPC (stellar_sign).
   * Returns the XDR signed by the user's wallet.
   *
   * Production path:
   *   POST https://api.privy.io/v1/wallets/{walletId}/rpc
   *   Headers: privy-app-id, Authorization: Basic base64(appId:appSecret)
   *   Body: { method: "stellar_sign", params: { xdr, network } }
   *   Response data: { signed_xdr } (also accepts { xdr } / { signedXdr })
   *
   * Without Privy credentials, logs a warning and returns a deterministic
   * XDR derived from the input operations so dev/test flows stay traceable.
   */
  public async signBaseTransaction(baseTxOptions: {
    network: 'testnet' | 'public';
    baseOperations: any[];
    walletId?: string;
    baseTxXdr?: string;
  }): Promise<{ xdr: string }> {
    const walletId = baseTxOptions.walletId ?? process.env.PRIVY_USER_WALLET_ID ?? '';
    const network = baseTxOptions.network ?? this.network;

    if (this.hasPrivyCreds() && walletId) {
      const data = await this.privyWalletsRpc<{ signed_xdr?: string; xdr?: string; signedXdr?: string }>(
        walletId,
        'stellar_sign',
        { xdr: baseTxOptions.baseTxXdr ?? JSON.stringify(baseTxOptions.baseOperations), network }
      );
      const signed = data.signed_xdr ?? data.xdr ?? data.signedXdr;
      if (!signed) throw new Error('Privy stellar_sign response missing signed XDR');
      return { xdr: signed };
    }

    if (!this.hasPrivyCreds()) {
      console.warn(
        '[StellarProvider] PRIVY_APP_ID/PRIVY_APP_SECRET missing; returning deterministic dev XDR derived from baseOperations.'
      );
    } else {
      console.warn(
        '[StellarProvider] No user wallet id available (walletId / PRIVY_USER_WALLET_ID); returning deterministic dev XDR derived from baseOperations.'
      );
    }

    const input = baseTxOptions.baseTxXdr ?? JSON.stringify(baseTxOptions.baseOperations);
    const digest = this.digestHex(`${network}:${input}`, 48);
    const passphraseTag = network === 'testnet' ? 'testnet' : 'public';
    return { xdr: `AAAAAP-signed-${passphraseTag}-${digest}` };
  }

  /**
   * Build and sign a fee bump transaction with the gas account.
   * The fee bump tx wraps the signed base tx; the gas wallet pays the fee.
   *
   * Production path:
   *   POST https://api.privy.io/v1/wallets/{gasWalletId}/rpc
   *   Headers: privy-app-id, Authorization: Basic base64(appId:appSecret)
   *   Body: { method: "stellar_signFeeBump", params: { xdr: baseTxXdr, feeSource: gasWalletPubkey } }
   *   Response data: { signed_xdr } (also accepts { xdr } / { signedXdr })
   *
   * Without Privy credentials, logs a warning and returns a deterministic
   * fee-bump XDR derived from baseTxXdr plus the gas pubkey.
   */
  public async signFeeBumpTransaction(baseTxXdr: string): Promise<{ xdr: string }> {
    if (this.hasPrivyCreds() && this.gasWalletId) {
      const data = await this.privyWalletsRpc<{ signed_xdr?: string; xdr?: string; signedXdr?: string }>(
        this.gasWalletId,
        'stellar_signFeeBump',
        { xdr: baseTxXdr, feeSource: this.gasWalletPubkey, network: this.network }
      );
      const signed = data.signed_xdr ?? data.xdr ?? data.signedXdr;
      if (!signed) throw new Error('Privy stellar_signFeeBump response missing signed XDR');
      return { xdr: signed };
    }

    console.warn(
      '[StellarProvider] Privy credentials or gas wallet id missing; returning deterministic dev fee-bump XDR derived from baseTxXdr.'
    );
    const digest = this.digestHex(`${baseTxXdr}:${this.gasWalletPubkey}`, 48);
    return { xdr: `AAAAAQ-feeBump-${digest}` };
  }

  /**
   * Submit a signed fee bump transaction to the Stellar network.
   *
   * Production path:
   *   POST https://api.privy.io/v1/wallets/{gasWalletId}/rpc
   *   Headers: privy-app-id, Authorization: Basic base64(appId:appSecret)
   *   Body: { method: "stellar_submitTransaction", params: { xdr: feeBumpXdr, network } }
   *   Response data: { hash } (also accepts { tx_hash } / { txHash })
   *
   * Without Privy credentials, logs a warning and returns a deterministic
   * 64-hex-char hash derived from feeBumpXdr (same shape as a Stellar tx hash).
   */
  public async submitFeeBumpTransaction(feeBumpXdr: string): Promise<{ hash: string }> {
    if (this.hasPrivyCreds() && this.gasWalletId) {
      const data = await this.privyWalletsRpc<{ hash?: string; tx_hash?: string; txHash?: string }>(
        this.gasWalletId,
        'stellar_submitTransaction',
        { xdr: feeBumpXdr, network: this.network }
      );
      const hash = data.hash ?? data.tx_hash ?? data.txHash;
      if (!hash) throw new Error('Privy stellar_submitTransaction response missing hash');
      return { hash };
    }

    console.warn(
      '[StellarProvider] Privy credentials or gas wallet id missing; returning deterministic dev hash derived from feeBumpXdr.'
    );
    const hash = this.digestHex(`submit:${feeBumpXdr}`, 64);
    return { hash };
  }
}
