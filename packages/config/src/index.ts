import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

const optionalUrl = z.string().url().optional();

const apiEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    PORT: z.coerce.number().int().positive().default(4000),
    JWT_SECRET: z.string().optional(),
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
    MONAD_RPC_URL: z.string().url().default('https://testnet-rpc.monad.xyz'),
    USDC_MINT_ADDRESS: z.string().default('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    AUSD_TOKEN_ADDRESS: z.string().default('0x534b2f3A21130d7a60830c2Df862319e593943A3'),
    MONAD_CHAIN_ID: z.coerce.number().int().positive().default(10143),
    KUDI_TREASURY_SOLANA_ADDRESS: z.string().optional(),
    SOLANA_CAIP2: z.string().default('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'),
    VASP_PARTNER_API_KEY: z.string().optional(),
    VASP_PARTNER_API_URL: z.string().url().default('https://api.busha.co/v1')
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET is required in production'
      });
    }
  });

const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  HOSTNAME: z.string().optional(),
  MONAD_RPC_URL: z.string().url().default('https://testnet-rpc.monad.xyz'),
  AUSD_TOKEN_ADDRESS: z.string().default('0x534b2f3A21130d7a60830c2Df862319e593943A3'),
  MONAD_CHAIN_ID: z.coerce.number().int().positive().default(10143)
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

export const apiConfig = parseEnv(apiEnvSchema, process.env, 'api');
export const workerConfig = parseEnv(workerEnvSchema, process.env, 'worker');
export const adminConfig = parseEnv(adminEnvSchema, process.env, 'admin');
export const walletPublicConfig = parseEnv(walletPublicEnvSchema, process.env, 'wallet public');

export type ApiConfig = typeof apiConfig;
export type WorkerConfig = typeof workerConfig;
export type AdminConfig = typeof adminConfig;
export type WalletPublicConfig = typeof walletPublicConfig;
