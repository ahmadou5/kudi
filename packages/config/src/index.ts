import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

const emptyStringToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalUrl = z.preprocess(emptyStringToUndefined, z.string().url().optional());

const apiEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    PORT: z.coerce.number().int().positive().default(4000),
    JWT_SECRET: z.string().optional(),
    ADMIN_API_KEY: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    REDIS_URL: z.string().optional(),
    ENABLE_REDIS: z.enum(['true', 'false']).default('false'),
    SENTRY_DSN: optionalUrl,
    PAYSTACK_SECRET_KEY: z.string().optional(),
    MONNIFY_API_KEY: z.string().optional(),
    MONNIFY_SECRET_KEY: z.string().optional(),
    MONNIFY_BASE_URL: z.string().url().default('https://api.monnify.com'),
    MONNIFY_SOURCE_ACCOUNT: z.string().optional(),
    SQUAD_SECRET_KEY: z.string().optional(),
    SQUAD_BASE_URL: z.string().url().default('https://api-d.squadco.com'),
    DOJAH_API_KEY: z.string().optional(),
    DOJAH_APP_ID: z.string().optional(),
    PRIVY_APP_ID: z.string().optional(),
    PRIVY_APP_SECRET: z.string().optional(),
    SOLANA_RPC_URL: z.string().url().default('https://api.devnet.solana.com'),
    SOLANA_RPC_URL_FALLBACK: optionalUrl,
    MONAD_RPC_URL: z.string().url().default('https://testnet-rpc.monad.xyz'),
    MONAD_RPC_URL_FALLBACK: optionalUrl,
    USDC_MINT_ADDRESS: z.string().default('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    AUSD_TOKEN_ADDRESS: z.string().default('0x534b2f3A21130d7a60830c2Df862319e593943A3'),
    MONAD_CHAIN_ID: z.coerce.number().int().positive().default(10143),
    KUDI_TREASURY_SOLANA_ADDRESS: z.string().optional(),
    KUDI_TREASURY_EVM_ADDRESS: z.string().optional(),
    SOLANA_CAIP2: z.string().default('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'),
    VASP_PARTNER_API_KEY: z.string().optional(),
    VASP_PARTNER_API_URL: z.string().url().default('https://api.busha.co/v1'),
    RECONCILIATION_ALERT_THRESHOLD_USDC: z.coerce.number().int().positive().default(10000)
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET is required in production'
      });
    }
    if (env.NODE_ENV === 'production' && !env.ADMIN_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_API_KEY'],
        message: 'ADMIN_API_KEY is required in production'
      });
    }
    if (env.NODE_ENV === 'production' && !env.PRIVY_APP_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PRIVY_APP_ID'],
        message: 'PRIVY_APP_ID is required in production'
      });
    }
    if (env.NODE_ENV === 'production' && !env.PRIVY_APP_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PRIVY_APP_SECRET'],
        message: 'PRIVY_APP_SECRET is required in production'
      });
    }
    if (env.NODE_ENV === 'production' && !env.KUDI_TREASURY_SOLANA_ADDRESS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['KUDI_TREASURY_SOLANA_ADDRESS'],
        message: 'KUDI_TREASURY_SOLANA_ADDRESS is required in production'
      });
    }
  });

const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  HOSTNAME: z.string().optional(),
  MONAD_RPC_URL: z.string().url().default('https://testnet-rpc.monad.xyz'),
  MONAD_RPC_URL_FALLBACK: optionalUrl,
  AUSD_TOKEN_ADDRESS: z.string().default('0x534b2f3A21130d7a60830c2Df862319e593943A3'),
  MONAD_CHAIN_ID: z.coerce.number().int().positive().default(10143),
  SOLANA_RPC_URL: z.string().url().default('https://api.devnet.solana.com'),
  SOLANA_RPC_URL_FALLBACK: optionalUrl,
  USDC_MINT_ADDRESS: z.string().default('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  KUDI_TREASURY_SOLANA_ADDRESS: z.string().optional(),
  KUDI_TREASURY_EVM_ADDRESS: z.string().optional(),
  PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  RECONCILIATION_ALERT_THRESHOLD_USDC: z.coerce.number().int().positive().default(10000)
})
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.KUDI_TREASURY_SOLANA_ADDRESS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['KUDI_TREASURY_SOLANA_ADDRESS'],
          message: 'KUDI_TREASURY_SOLANA_ADDRESS is required in production'
        });
      }
      if (!env.KUDI_TREASURY_EVM_ADDRESS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['KUDI_TREASURY_EVM_ADDRESS'],
          message: 'KUDI_TREASURY_EVM_ADDRESS is required in production'
        });
      }
      if (!env.PRIVY_APP_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PRIVY_APP_ID'],
          message: 'PRIVY_APP_ID is required in production'
        });
      }
      if (!env.PRIVY_APP_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PRIVY_APP_SECRET'],
          message: 'PRIVY_APP_SECRET is required in production'
        });
      }
    }
  });

const adminEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  KUDI_API_URL: z.string().url().default('http://localhost:4000')
});

const walletPublicEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url().optional(),
  EXPO_PUBLIC_PRIVY_APP_ID: z.string().optional()
});

function formatConfigError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');
}

function parseEnv<T extends z.ZodTypeAny>(schema: T, env: NodeJS.ProcessEnv, name: string): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(`[Config] Invalid ${name} environment: ${formatConfigError(result.error)}`);
  }
  return result.data;
}

function lazyConfig<T extends z.ZodTypeAny>(schema: T, name: string): z.infer<T> {
  let parsed: z.infer<T> | undefined;

  const getParsed = () => {
    if (!parsed) {
      parsed = parseEnv(schema, process.env, name);
    }
    return parsed;
  };

  return new Proxy({} as z.infer<T>, {
    get(_target, property) {
      const config = getParsed() as Record<PropertyKey, unknown>;
      return config[property];
    },
    has(_target, property) {
      const config = getParsed() as Record<PropertyKey, unknown>;
      return property in config;
    },
    ownKeys() {
      return Reflect.ownKeys(getParsed() as object);
    },
    getOwnPropertyDescriptor(_target, property) {
      const config = getParsed() as object;
      if (!(property in config)) return undefined;
      return { enumerable: true, configurable: true };
    }
  });
}

export const apiConfig = lazyConfig(apiEnvSchema, 'api');
export const workerConfig = lazyConfig(workerEnvSchema, 'worker');
export const adminConfig = lazyConfig(adminEnvSchema, 'admin');
export const walletPublicConfig = lazyConfig(walletPublicEnvSchema, 'wallet public');

export type ApiConfig = z.infer<typeof apiEnvSchema>;
export type WorkerConfig = z.infer<typeof workerEnvSchema>;
export type AdminConfig = z.infer<typeof adminEnvSchema>;
export type WalletPublicConfig = z.infer<typeof walletPublicEnvSchema>;

// ---------------------------------------------------------------------------
// R6: shared chain-config validation (fail closed), log redaction, RPC failover
// Single validator used by both API and worker at startup so placeholder or
// missing treasury/mint addresses can never reach transaction builders.
// ---------------------------------------------------------------------------

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58ToBytes(value: string): Uint8Array | undefined {
  const bytes: number[] = [0];
  for (const char of value) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit < 0) return undefined;
    let carry = digit;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let leadingZeros = 0;
  for (const char of value) {
    if (char !== '1') break;
    leadingZeros++;
  }
  const decoded = new Uint8Array(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    decoded[decoded.length - 1 - i] = bytes[i];
  }
  return decoded;
}

/** True for a real Solana pubkey: base58 decoding to exactly 32 bytes. */
export function isValidSolanaAddress(value: string | undefined): value is string {
  if (!value || typeof value !== 'string') return false;
  const decoded = base58ToBytes(value.trim());
  return !!decoded && decoded.length === 32;
}

/** True for a real EVM address: 0x + 40 hex chars. */
export function isValidEvmAddress(value: string | undefined): value is string {
  return !!value && /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

const PLACEHOLDER_HINT = /(\.\.\.|kudi|treasury|ausd|xxxx|your_|example|placeholder|test_|todo|changeme)/i;

/** Catches dev placeholders (KudiTreasury..., 0x...AUSD, 0xYOUR_...) even if format-adjacent. */
export function looksLikePlaceholderAddress(value: string | undefined): boolean {
  if (!value) return true;
  return value.includes('...') || PLACEHOLDER_HINT.test(value);
}

export interface ChainRuntimeConfigInput {
  nodeEnv?: string;
  solanaTreasuryAddress?: string;
  evmTreasuryAddress?: string;
  usdcMintAddress?: string;
  ausdTokenAddress?: string;
  monadChainId?: number;
  solanaCaip2?: string;
  privyAppId?: string;
  privyAppSecret?: string;
}

/**
 * Fail-closed startup validation shared by API and worker.
 * Throws with a clear, actionable message on any missing/invalid chain config.
 * Money-path addresses (treasury, mints) are validated in ALL environments;
 * third-party secrets (Privy) are required in production and warn otherwise.
 */
export function validateChainRuntimeConfig(input: ChainRuntimeConfigInput, serviceName = 'service'): void {
  const failures: string[] = [];

  if (!isValidSolanaAddress(input.solanaTreasuryAddress) || looksLikePlaceholderAddress(input.solanaTreasuryAddress)) {
    failures.push(
      'KUDI_TREASURY_SOLANA_ADDRESS must be a valid base58 Solana pubkey (no placeholders like KudiTreasury...)'
    );
  } else if (input.solanaTreasuryAddress.trim() === '11111111111111111111111111111111') {
    failures.push('KUDI_TREASURY_SOLANA_ADDRESS must not be the system program address');
  }
  if (!isValidEvmAddress(input.evmTreasuryAddress) || looksLikePlaceholderAddress(input.evmTreasuryAddress)) {
    failures.push(
      'KUDI_TREASURY_EVM_ADDRESS must be a valid 0x EVM address (no placeholders like 0x...AUSD)'
    );
  } else if (/^0x0{40}$/i.test(input.evmTreasuryAddress.trim())) {
    failures.push('KUDI_TREASURY_EVM_ADDRESS must not be the zero address (funds would be unrecoverable)');
  }
  if (!isValidSolanaAddress(input.usdcMintAddress)) {
    failures.push('USDC_MINT_ADDRESS must be a valid base58 Solana mint address');
  }
  if (!isValidEvmAddress(input.ausdTokenAddress) || looksLikePlaceholderAddress(input.ausdTokenAddress)) {
    failures.push('AUSD_TOKEN_ADDRESS must be a valid 0x EVM token contract address');
  } else if (/^0x0{40}$/i.test(input.ausdTokenAddress.trim())) {
    failures.push('AUSD_TOKEN_ADDRESS must not be the zero address');
  }
  if (!input.monadChainId || !Number.isInteger(input.monadChainId) || input.monadChainId <= 0) {
    failures.push('MONAD_CHAIN_ID must be a positive integer chain ID');
  }
  if (input.solanaCaip2 !== undefined && !/^solana:[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input.solanaCaip2)) {
    failures.push('SOLANA_CAIP2 must look like solana:<base58-genesis-hash>');
  }

  if (failures.length > 0) {
    throw new Error(
      `[Config] ${serviceName} refusing to boot with invalid chain config: ${failures.join('; ')}. ` +
        'Set the listed env vars to real chain values (see .env.example).'
    );
  }

  if (input.nodeEnv === 'production' && (!input.privyAppId || !input.privyAppSecret)) {
    throw new Error(
      `[Config] ${serviceName} refusing to boot: PRIVY_APP_ID and PRIVY_APP_SECRET are required in production.`
    );
  }
  if (input.nodeEnv !== 'production' && (!input.privyAppId || !input.privyAppSecret)) {
    console.warn(
      `[Config] ${serviceName} starting without PRIVY_APP_ID/PRIVY_APP_SECRET — Privy signing paths will fail at runtime.`
    );
  }
}

/** Truncate an address for logs: first/last 4 chars (e.g. "Abc1…wxyz"). Never log full addresses. */
export function redactAddress(address: string | undefined | null, visible = 4): string {
  if (!address || typeof address !== 'string') return '<missing>';
  if (address.length <= visible * 2 + 1) return '…';
  return `${address.slice(0, visible)}…${address.slice(-visible)}`;
}

/** Strip query strings/credentials from an RPC URL before logging (keys often live in query params). */
export function redactRpcUrl(url: string | undefined): string {
  if (!url) return '<missing>';
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.username = '';
    parsed.password = '';
    // Provider keys are also commonly embedded as the last path segment
    // (e.g. /v2/<KEY>, /v3/<KEY>) — mask anything that looks like a key.
    const segments = parsed.pathname.split('/').map((segment) => {
      if (/^[A-Za-z0-9_-]{20,}$/.test(segment)) return '[key]';
      const eq = segment.indexOf('=');
      if (eq >= 0) return `${segment.slice(0, eq + 1)}[redacted]`;
      return segment;
    });
    parsed.pathname = segments.join('/');
    return parsed.toString();
  } catch {
    return '<invalid-url>';
  }
}

/** Never log push tokens or secret-like values — log this placeholder instead. */
export const REDACTED = '[redacted]';

/**
 * POST JSON to the first healthy RPC endpoint (primary, then fallbacks).
 * Minimal failover helper for RPC read paths; listeners keep their own logic.
 */
export async function fetchJsonWithRpcFallback(
  endpoints: Array<string | undefined>,
  body: unknown,
  label = 'RPC'
): Promise<unknown> {
  const urls = endpoints.filter((u): u is string => !!u && u.length > 0);
  if (urls.length === 0) {
    throw new Error(`[${label}] No RPC endpoints configured (primary or fallback)`);
  }
  let lastError: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as unknown;
    } catch (err) {
      lastError = err;
      console.warn(`[${label}] RPC endpoint failed (${redactRpcUrl(url)}): ${err instanceof Error ? err.message : String(err)} — trying next`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`[${label}] All RPC endpoints failed`);
}
