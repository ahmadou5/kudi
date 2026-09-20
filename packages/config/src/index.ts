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
    MONAD_RPC_URL: z.string().url().default('https://testnet-rpc.monad.xyz'),
    USDC_MINT_ADDRESS: z.string().default('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    AUSD_TOKEN_ADDRESS: z.string().default('0x534b2f3A21130d7a60830c2Df862319e593943A3'),
    MONAD_CHAIN_ID: z.coerce.number().int().positive().default(10143),
    KUDI_TREASURY_SOLANA_ADDRESS: z.string().optional(),
    SOLANA_CAIP2: z.string().default('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'),
    VASP_PARTNER_API_KEY: z.string().optional(),
    VASP_PARTNER_API_URL: z.string().url().default('https://api.busha.co/v1'),
    ALLOW_MOCK_CHAIN_SENDS: z.enum(['true', 'false']).default('false')
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
  AUSD_TOKEN_ADDRESS: z.string().default('0x534b2f3A21130d7a60830c2Df862319e593943A3'),
  MONAD_CHAIN_ID: z.coerce.number().int().positive().default(10143),
  SOLANA_RPC_URL: z.string().url().default('https://api.devnet.solana.com'),
  USDC_MINT_ADDRESS: z.string().default('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
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
