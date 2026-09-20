# Metropolis (Kudi) — Environment Variables Reference Guide

This document lists all environment variables required or supported across the Metropolis (Kudi) monorepo (`apps/api`, `apps/admin`, `apps/wallet`, `apps/web`, `apps/worker`, and `packages/*`).

---

## 1. ⚙️ Core Server & Database

| Variable | Description | Required in Production | Default Value (Dev) |
|---|---|---|---|
| `NODE_ENV` | Operating environment (`development`, `test`, `production`) | Yes | `development` |
| `PORT` | API server HTTP port | No | `4000` |
| `DATABASE_URL` | PostgreSQL connection string (Prisma ORM) | Yes | `postgresql://postgres:postgres@localhost:5432/kudi` |
| `JWT_SECRET` | Secret key for signing session JWT tokens | **Yes** | `kudi_jwt_secret_dev_key_32bytes_min` |
| `CORS_ORIGIN` | Allowed HTTP origins for API CORS | No | `*` |
| `REDIS_URL` | Redis instance URL for rate caching & rate limiting | No | `redis://localhost:6379` |
| `ENABLE_REDIS` | Enable Redis caching (`true` / `false`) | No | `false` |
| `SENTRY_DSN` | Sentry error monitoring & telemetry DSN URL | No | *Optional* |

---

## 2. 🔐 Admin & Ops Console Authentication

| Variable | Description | Required in Production | Default Value (Dev) |
|---|---|---|---|
| `ADMIN_API_KEY` | Admin API secret key for Ops endpoints | **Yes** | `kudi_admin_secret_dev` |
| `ADMIN_PASSWORD` | Password for Admin Console login UI | No | `admin123` |
| `SETUP_ADMIN_TOKEN` | One-time setup token for initial admin account creation | No | `admin_setup_token_dev` |
| `KUDI_API_URL` | API base URL consumed by Admin Next.js app | Yes | `https://kudiapi-production.up.railway.app` |

---

## 3. 🗝️ Privy Embedded & Server Wallet Custody (Track A / Track B)

| Variable | Description | Required in Production | Default Value (Dev) |
|---|---|---|---|
| `PRIVY_APP_ID` | Privy Application ID | **Yes** | `cmtmzjobd00t30dl1qgujdr3q` |
| `PRIVY_APP_SECRET` | Privy App Secret (Server Wallet signing API) | **Yes** | *Privy Secret* |
| `PRIVY_CLIENT_ID` | Privy Client ID for client SDK initialization | No | `client-WY6tG...` |
| `PRIVY_SPONSOR_TRANSACTIONS` | Auto-sponsor gas fees for Privy wallets (`true`/`false`) | No | `true` |
| `PRIVY_SPONSOR_SWEEPS` | Sponsor gas fees during treasury sweep (`true`/`false`) | No | `true` |

---

## 4. ⛓️ Blockchain, Tokens & Treasury Addresses

### Monad Testnet (EVM)
| Variable | Description | Default / Example Value |
|---|---|---|
| `MONAD_RPC_URL` | Monad EVM RPC Endpoint | `https://testnet-rpc.monad.xyz` |
| `AUSD_TOKEN_ADDRESS` | Monad AUSD Stablecoin Contract Address | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| `MONAD_CHAIN_ID` | Monad Network Chain ID | `10143` |
| `KUDI_TREASURY_EVM_ADDRESS` | Kudi Central Treasury Wallet Address for Monad | `0xKudiTreasuryMonadMetropolisTestnet000` |

### Solana Network (Devnet / Mainnet)
| Variable | Description | Default / Example Value |
|---|---|---|
| `SOLANA_RPC_URL` | Solana RPC Endpoint | `https://api.devnet.solana.com` |
| `USDC_MINT_ADDRESS` | Solana USDC SPL Token Mint Address | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| `SOLANA_CAIP2` | CAIP-2 Solana Chain Identifier | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| `KUDI_TREASURY_SOLANA_ADDRESS` | Kudi Central Treasury Wallet Address for Solana | **Required in Prod** |

### Track B VASP Partner Custody
| Variable | Description | Default / Example Value |
|---|---|---|
| `VASP_PARTNER_API_KEY` | Partner VASP API Key | *Optional* |
| `VASP_PARTNER_API_URL` | Partner VASP API Endpoint | `https://api.busha.co/v1` |
| `ALLOW_MOCK_CHAIN_SENDS` | Mock chain sends in dev mode (`true`/`false`) | `false` |

---

## 5. 🏦 Fiat Payout Providers (NGN Off-Ramp)

| Variable | Description | Default / Sandbox Fallback |
|---|---|---|
| `ACTIVE_PAYMENT_PROVIDER` | Default active payout rail (`PAYSTACK`, `MONNIFY`, `SQUAD`) | `PAYSTACK` |
| `PAYSTACK_SECRET_KEY` | Paystack Secret API Key | `sk_test_...` |
| `PAYSTACK_PUBLIC_KEY` | Paystack Public Key | `pk_test_...` |
| `MONNIFY_API_KEY` | Monnify API Key | `MK_TEST_...` |
| `MONNIFY_SECRET_KEY` | Monnify Secret Key | `secret_...` |
| `MONNIFY_CONTRACT_CODE` | Monnify Contract Code | `contract_...` |
| `MONNIFY_BASE_URL` | Monnify API Endpoint | `https://sandbox.monnify.com` |
| `MONNIFY_SOURCE_ACCOUNT_NUMBER` | Monnify Source Bank Account Number for payouts | `0123456789` |
| `SQUAD_SECRET_KEY` | Squad Secret API Key | `sandbox_sk_...` |
| `SQUAD_PUBLIC_KEY` | Squad Public API Key | `sandbox_pk_...` |
| `SQUAD_BASE_URL` | Squad API Endpoint | `https://sandbox-api-d.squadco.com` |

---

## 6. 🆔 KYC & Identity Verification Providers

| Variable | Description | Default / Fallback Mode |
|---|---|---|
| `IDENTITY_PROVIDER` | Preferred verification provider (`SMILE` or `DOJAH`) | `SMILE` |
| `IDENTITY_SIMULATE` | Force simulated KYC in dev mode (`true`/`false`) | `true` (in non-production) |
| `SMILE_IDENTITY_PARTNER_ID` | Smile Identity Partner ID | `partner_id_here` |
| `SMILE_IDENTITY_API_KEY` | Smile Identity API Key | `api_key_here` |
| `SMILE_IDENTITY_ENV` | Smile Identity Environment (`0` for sandbox, `1` for live) | `0` |
| `DOJAH_API_KEY` | Dojah API Key | *Optional* |
| `DOJAH_APP_ID` | Dojah App ID | *Optional* |

---

## 7. 📸 Media Storage & Email Services

| Variable | Description | Default / Example |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name for KYC document uploads | `kudi-cloud` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `api_key` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | `api_secret` |
| `RESEND_API_KEY` | Resend API Key for transactional emails | `re_123...` |
| `RESEND_FROM_EMAIL` | Sender email address for Resend | `onboarding@resend.dev` |

---

## 📱 8. Mobile Wallet & Web Public Env Exposure

> [!NOTE]
> Prefix with `EXPO_PUBLIC_` for Expo Mobile App or `NEXT_PUBLIC_` for Web App.

| Variable | Description | Value |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Backend REST API URL consumed by Expo Wallet | `https://kudiapi-production.up.railway.app` |
| `EXPO_PUBLIC_PRIVY_APP_ID` | Privy App ID for Expo Wallet | `cmtmzjobd00t30dl1qgujdr3q` |
| `EXPO_PUBLIC_PRIVY_CLIENT_ID` | Privy Client ID for Expo Wallet | `client-WY6tG...` |
| `NEXT_PUBLIC_API_URL` | Backend REST API URL consumed by Next.js Web | `https://kudiapi-production.up.railway.app` |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy App ID for Next.js Web | `cmtmzjobd00t30dl1qgujdr3q` |

---

## 💡 Quick Copy Template (`.env`)

```env
# Core Server & DB
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kudi"
JWT_SECRET="kudi_jwt_secret_dev_key_32bytes_min"
ADMIN_API_KEY="kudi_admin_secret_dev"
ADMIN_PASSWORD="admin123"

# Privy Custody
PRIVY_APP_ID="cmtmzjobd00t30dl1qgujdr3q"
PRIVY_APP_SECRET="privy_app_secret_here"

# Blockchain RPCs & Tokens
MONAD_RPC_URL="https://testnet-rpc.monad.xyz"
AUSD_TOKEN_ADDRESS="0x534b2f3A21130d7a60830c2Df862319e593943A3"
SOLANA_RPC_URL="https://api.devnet.solana.com"
USDC_MINT_ADDRESS="4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
KUDI_TREASURY_EVM_ADDRESS="0xKudiTreasuryMonadMetropolisTestnet000"
KUDI_TREASURY_SOLANA_ADDRESS="KudiTreasurySolanaDevnet11111111111111111111"

# Payout Rails
PAYSTACK_SECRET_KEY="sk_test_paystack_key_here"
MONNIFY_API_KEY="monnify_api_key_here"
MONNIFY_SECRET_KEY="monnify_secret_key_here"
SQUAD_SECRET_KEY="squad_secret_key_here"

# KYC Provider
SMILE_IDENTITY_PARTNER_ID="partner_id_here"
SMILE_IDENTITY_API_KEY="api_key_here"

# Public Expo & Web URLs
EXPO_PUBLIC_API_URL="https://kudiapi-production.up.railway.app"
EXPO_PUBLIC_PRIVY_APP_ID="cmtmzjobd00t30dl1qgujdr3q"
NEXT_PUBLIC_API_URL="https://kudiapi-production.up.railway.app"
```
