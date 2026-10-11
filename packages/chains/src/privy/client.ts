import { z } from 'zod';

const verificationKeySchema = z.string().optional();
const walletOwnerKeyQuorumIdSchema = z.string().optional();
const authorizationPrivateKeyB64Schema = z.string().optional();
const authorizationKeyIdSchema = z.string().optional;

export interface NewClientOptions {
  appID: string;
  appSecret: string;
  verificationKeyPEM?: string;
  walletOwnerKeyQuorumID?: string;
  authorizationPrivateKeyB64?: string;
  authorizationKeyID?: string;
}

export interface Client {
  sdk: import('@privy-io/server-sdk').Privy | null;
  appID: string;
  appSecret: string;
  verificationKey: string | undefined;
  walletOwnerKeyQuorumID: string;
  authorizationPrivateKeyB64: string;
  authorizationKeyID: string;
  rpcAuthOpts: {
    verifyJwt: boolean;
    walletQuorumId: string;
  };
}

export function NewClient(options: NewClientOptions): Client {
  let sdk: import('@privy-io/server-sdk').Privy | null = null;

  try {
    sdk = new (require('@privy-io/server-sdk').Privy)({
      appId: options.appID,
      appSecret: options.appSecret,
    });
  } catch (e) {
    console.warn('[PrivyClient] @privy-io/server-sdk not available, using direct API calls');
    sdk = null;
  }

  const verificationKey = options.verificationKeyPEM || undefined;

  return {
    sdk,
    appID: options.appID,
    appSecret: options.appSecret,
    verificationKey,
    walletOwnerKeyQuorumID: options.walletOwnerKeyQuorumID || '',
    authorizationPrivateKeyB64: options.authorizationPrivateKeyB64 || '',
    authorizationKeyID: options.authorizationKeyID || '',
    rpcAuthOpts: {
      verifyJwt: !!verificationKey,
      walletQuorumId: options.walletOwnerKeyQuorumID || '',
    },
  };
}

export { verificationKeySchema, walletOwnerKeyQuorumIdSchema, authorizationPrivateKeyB64Schema, authorizationKeyIdSchema };