# 🔑 How to Get Every New Environment Variable

This guide covers the **23 variables** that were missing from `.env.example` but exist in `.env`, plus variables found only in `.env.example`. Follow each section to obtain the values needed for local dev and Railway deployment.

---

## 1. JWT_SECRET

**Purpose**: Signs all user auth tokens. Must be a strong random string.

```bash
# Generate a secure value locally:
openssl rand -base64 48
```
Paste the output as `JWT_SECRET`. Never reuse across environments.

---

## 2. REDIS_URL + ENABLE_REDIS

**Purpose**: Used for rate limiting, caching, and session data.

**Option A — Railway Redis plugin (recommended for production)**
1. In your Railway project → **+ New** → **Database** → **Add Redis**
2. Once provisioned, go to the Redis service → **Variables** tab
3. Copy the `REDIS_URL` value (format: `redis://default:<pass>@<host>:<port>`)

**Option B — Upstash (free tier)**
1. Go to [upstash.com](https://upstash.com) → Create database → select region
2. Copy the **Redis URL** from the dashboard

Set `ENABLE_REDIS="true"` in production. Set `"false"` if you want to skip Redis locally.

---

## 3. API_BASE_URL / KUDI_API_URL / EXPO_PUBLIC_API_URL / NEXT_PUBLIC_API_URL

**Purpose**: The public URL of your deployed API — used by web, admin, and mobile clients.

- **Local dev**: `http://localhost:4000`
- **Railway production**: Copy the domain from your Railway `api` service → **Settings → Networking → Public Networking**. It looks like `https://xxxx.up.railway.app`

Set all four to the same value for each environment.

---

## 4. ADMIN_PASSWORD

**Purpose**: Password for the admin panel login UI.

Choose any strong password. In Railway, set it as a secret env var on the `admin` service.

---

## 5. PRIVY_CLIENT_ID / EXPO_PUBLIC_PRIVY_CLIENT_ID / NEXT_PUBLIC_PRIVY_APP_ID

**Purpose**: Public-facing Privy identifiers used by frontend SDKs (Expo, Next.js).

1. Go to [privy.io/dashboard](https://dashboard.privy.io)
2. Select your app → **Settings → App Settings**
3. Copy:
   - **App ID** → `PRIVY_APP_ID`, `EXPO_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_PRIVY_APP_ID`
   - **Client ID** → `PRIVY_CLIENT_ID`, `EXPO_PUBLIC_PRIVY_CLIENT_ID`

---

## 6. PRIVY_VERIFICATION_KEY_PEM / PRIVY_WALLET_OWNER_KEY_QUORUM_ID / PRIVY_AUTHORIZATION_PRIVATE_KEY_B64 / PRIVY_AUTHORIZATION_KEY_ID

**Purpose**: Secure server-to-server Privy RPC authorization (Pila NewClient pattern).

1. In Privy dashboard → **Settings → API Keys / Authorization Keys**
2. Create a new **Authorization Key** (ECDSA key pair)
3. Copy:
   - Public key (PEM) → `PRIVY_VERIFICATION_KEY_PEM`
   - Key ID → `PRIVY_AUTHORIZATION_KEY_ID`
   - Private key (base64 encoded) → `PRIVY_AUTHORIZATION_PRIVATE_KEY_B64`
4. For `PRIVY_WALLET_OWNER_KEY_QUORUM_ID`:
   - Go to **Server Wallets → Key Quorums**
   - Copy the quorum ID (starts with `wok_`)

> ⚠️ The authorization private key is shown **once** at creation. Save it immediately.

---

## 7. PAYSTACK_PUBLIC_KEY

**Purpose**: Client-side Paystack key for frontend payment initialization.

1. Go to [dashboard.paystack.com](https://dashboard.paystack.com)
2. **Settings → API Keys & Webhooks**
3. Copy the **Public Key** (starts with `pk_test_` or `pk_live_`)

---

## 8. MONNIFY_CONTRACT_CODE

**Purpose**: Identifies your Monnify merchant contract for virtual account creation.

1. Log in to [monnify.com](https://monnify.com) merchant dashboard
2. Go to **Settings → Contract Codes**
3. Copy your active contract code

---

## 9. SQUAD_PUBLIC_KEY

**Purpose**: Frontend Squad GTBank payment public key.

1. Log in to [squadco.com](https://squadco.com) dashboard
2. Go to **Settings → API Keys**
3. Copy the **Public Key**

---

## 10. KORAPAY_SECRET_KEY + KORAPAY_PUBLIC_KEY

**Purpose**: Korapay payment provider credentials.

1. Sign up / log in at [korapay.com](https://korapay.com)
2. Go to **Settings → API Keys**
3. Copy both **Secret Key** and **Public Key**

> Use sandbox keys for development, live keys for production.

---

## 11. BACHS_SECRET_KEY + BACHS_BASE_URL

**Purpose**: Bachs payment provider credentials.

1. Log in to your Bachs account at [bachs.io](https://bachs.io)
2. Go to **Developer → API Keys**
3. Copy the **Secret Key**
4. Base URL:
   - Sandbox: `https://sandbox-api.bachs.io`
   - Production: `https://api.bachs.io`

---

## 12. SMILE_IDENTITY_ENV

**Purpose**: Switches Smile Identity between sandbox and production mode.

Set to `"sandbox"` for dev/test, `"production"` for live KYC checks. No dashboard action needed.

---

## 13. MONAD_RPC_URL_FALLBACK / SOLANA_RPC_URL_FALLBACK

**Purpose**: Secondary RPC endpoints used automatically when the primary fails.

**Solana fallback options:**
- [Helius](https://helius.dev) (recommended): Sign up → create API key → `https://devnet.helius-rpc.com/?api-key=<key>`
- [QuickNode](https://quicknode.com): Create endpoint → copy HTTP URL

**Monad fallback:**
- Check [docs.monad.xyz](https://docs.monad.xyz) for alternate testnet RPC endpoints

Leave empty (`""`) if you don't need a fallback.

---

## 14. PRIVY_SOLANA_GAS_WALLET_ID + PRIVY_SOLANA_GAS_WALLET_PUBKEY

**Purpose**: Privy server wallet that pays Solana transaction fees on behalf of deposit wallets.

1. In Privy dashboard → **Server Wallets → Create Wallet** → select **Solana**
2. Copy the **Wallet ID** → `PRIVY_SOLANA_GAS_WALLET_ID`
3. Copy the **Public Key (address)** → `PRIVY_SOLANA_GAS_WALLET_PUBKEY`

> Fund this wallet with some SOL to cover transaction fees.

---

## 15. PRIVY_STELLAR_GAS_WALLET_ID + PRIVY_STELLAR_GAS_WALLET_PUBKEY

**Purpose**: Privy server wallet that pays Stellar (XLM) transaction fees.

1. In Privy dashboard → **Server Wallets → Create Wallet** → select **Stellar**
2. Copy the **Wallet ID** → `PRIVY_STELLAR_GAS_WALLET_ID`
3. Copy the **Public Key** → `PRIVY_STELLAR_GAS_WALLET_PUBKEY`

> Fund with XLM to pay base fees and reserve.

---

## 16. PRIVY_EVM_GAS_WALLET_ID / PRIVY_EVM_SETTLEMENT_LIQUIDITY_WALLET_ID / PRIVY_EVM_FEES_WALLET_ID

**Purpose**: Three dedicated EVM server wallets for different treasury roles on Monad.

Create **3 separate wallets** in Privy dashboard → **Server Wallets → Create Wallet** → select **EVM**:

| Variable | Role |
|---|---|
| `PRIVY_EVM_GAS_WALLET_ID` | Pays gas for sweep transactions |
| `PRIVY_EVM_SETTLEMENT_LIQUIDITY_WALLET_ID` | Holds AUSD liquidity for settlement |
| `PRIVY_EVM_FEES_WALLET_ID` | Collects platform fees |

Copy the **Wallet ID** for each one into the respective variable.

---

## 17. PRIVY_SPONSOR_TRANSACTIONS + PRIVY_SPONSOR_SWEEPS

**Purpose**: Feature toggles for Privy gas sponsorship.

Set to `"true"` or `"false"`. No dashboard action needed.
- `PRIVY_SPONSOR_TRANSACTIONS="true"` → Privy sponsors user tx fees
- `PRIVY_SPONSOR_SWEEPS="true"` → Privy sponsors sweep tx fees

---

## 18. CUSTODY_TRACK

**Purpose**: Selects custody mode for wallet management.

Set to one of:
- `"TRACK_A_SELF_CUSTODY"` — default, uses Privy server wallets
- `"TRACK_B_PARTNER"` — uses a VASP partner API

No external service needed; just set the string.

---

## 19. ALCHEMY_API_KEY + ALCHEMY_GAS_POLICY_ID + ALCHEMY_WALLET_ID

**Purpose**: Alchemy Account Kit for EVM gas sponsorship and smart wallets.

1. Sign up at [alchemy.com](https://alchemy.com) → create an app for **Monad** (or your EVM chain)
2. Copy the **API Key** → `ALCHEMY_API_KEY`
3. In Alchemy dashboard → **Gas Manager** → create a Gas Policy
4. Copy the **Policy ID** → `ALCHEMY_GAS_POLICY_ID`
5. `ALCHEMY_WALLET_ID` — leave empty; falls back to `PRIVY_EVM_GAS_WALLET_ID` automatically

---

## 20. SENTRY_DSN

**Purpose**: Error monitoring and performance tracing.

1. Sign up at [sentry.io](https://sentry.io) → create a **Node.js** project
2. Copy the **DSN** from **Settings → Client Keys (DSN)**
3. Paste as `SENTRY_DSN`

Leave empty (`""`) to disable Sentry.

---

## 21. MONNIFY_BASE_URL + MONNIFY_SOURCE_ACCOUNT

**Purpose**: Monnify API endpoint and the source bank account for disbursements.

| Variable | Sandbox | Production |
|---|---|---|
| `MONNIFY_BASE_URL` | `https://sandbox.monnify.com` | `https://api.monnify.com` |
| `MONNIFY_SOURCE_ACCOUNT` | Your sandbox account number from Monnify dashboard | Live account number |

---

## 22. VASP_PARTNER_API_KEY + VASP_PARTNER_API_URL

**Purpose**: Only needed when `CUSTODY_TRACK="TRACK_B_PARTNER"`. Credentials for your VASP custody partner.

Obtain from your VASP partner's developer portal. Leave empty if using Track A (Privy).

---

## 23. WALLET_ID + PRIVY_USER_WALLET_ID

**Purpose**: Optional operator overrides, rarely needed.

- `WALLET_ID` — DB row ID for custody-track lookup when `CUSTODY_TRACK` env is unset
- `PRIVY_USER_WALLET_ID` — fallback Privy wallet ID for Stellar base-transaction signing

Leave both as `""` unless you have a specific reason to override.

---

## ✅ Summary Checklist

| Variable(s) | Source |
|---|---|
| `JWT_SECRET` | `openssl rand -base64 48` |
| `REDIS_URL` | Railway Redis plugin or Upstash |
| `API_BASE_URL` / `*_API_URL` | Railway public domain |
| `ADMIN_PASSWORD` | Choose a strong password |
| `PRIVY_*` (app/client IDs) | [dashboard.privy.io](https://dashboard.privy.io) → App Settings |
| `PRIVY_VERIFICATION_KEY_PEM` etc. | Privy → Authorization Keys |
| `PRIVY_*_GAS_WALLET_*` | Privy → Server Wallets (create new) |
| `PAYSTACK_PUBLIC_KEY` | [dashboard.paystack.com](https://dashboard.paystack.com) |
| `MONNIFY_CONTRACT_CODE` | Monnify dashboard → Contract Codes |
| `SQUAD_PUBLIC_KEY` | [squadco.com](https://squadco.com) → API Keys |
| `KORAPAY_*` | [korapay.com](https://korapay.com) → API Keys |
| `BACHS_*` | [bachs.io](https://bachs.io) → API Keys |
| `SOLANA_RPC_URL_FALLBACK` | [helius.dev](https://helius.dev) (free tier) |
| `ALCHEMY_API_KEY` / `GAS_POLICY_ID` | [alchemy.com](https://alchemy.com) |
| `SENTRY_DSN` | [sentry.io](https://sentry.io) |
| `MONNIFY_SOURCE_ACCOUNT` | Monnify dashboard → bank accounts |
| `VASP_PARTNER_*` | Your VASP partner portal |
