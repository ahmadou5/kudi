# Kudi Wallet — API Wiring & Integration Plan

**Version:** 1.1 · **Date:** September 2026
**Scope:** Wire the Expo wallet app (`apps/wallet`) to the Fastify API (`apps/api`) and upgrade the stack from in-memory stubs to real, end-to-end functionality.

---

## Overview

The wallet app currently runs on **hardcoded mock data** and stub hooks. The API server already has working controllers, payment provider adapters, and chain listeners — the gap is the glue between them. This plan documents exactly what needs to be built, in what order, and using what patterns from Percel.

### Architecture Snapshot

```
apps/wallet  (Expo / React Native)
  - Privy SDK (Google, Email, Apple OAuth)
  - Zustand stores (auth.store, preferences.store)
  - @tanstack/react-query for server state
  - @kudi/sdk  -->  HTTP REST calls to api
  - Expo SecureStore for token persistence
          |
          | HTTP + WebSocket (Socket.io)
          v
apps/api  (Fastify + Node.js + TypeScript)
  - Privy OAuth verification & user sync
  - JWT session tokens · Rate limiting · Swagger docs
  - Modules: auth, balance, payout, kyc, bills, webhooks
  - LedgerService (in-memory --> PostgreSQL/Prisma)
  - RateService (hardcoded --> live P2P polling)
  - CustodyManager (@kudi/chains)
  - PaymentProviderRegistry (@kudi/payment-providers)
          |
          +------------------+------------------+
          v                  v                  v
     PostgreSQL          Redis + BullMQ     Paystack /
     (Prisma)            (apps/worker)      Monnify /
                                            Squad
```

---

## Phase 1 — Foundation & Auth with Privy (Days 1–2)

This is the unlocking phase. Authentication is powered by **Privy** (Google, Email, Apple sign-in with embedded wallets & social OAuth), with Kudi's API issuing session JWTs for API calls.

### 1.1 — Client Auth: Privy SDK Integration in Wallet (`apps/wallet`)

**Current state:** Hardcoded stub auth in `store/auth.store.ts`.

**[MODIFY] `apps/wallet/store/auth.store.ts` & Privy SDK Setup**
- Integrate `@privy-io/expo` (or Privy React Native Auth provider) with OAuth support (Google, Email, Apple).
- `loginWithPrivy(privyToken, privyUser)`: Passes Privy token and user details to API `POST /api/v1/auth/privy-authenticate`.
- Store issued Kudi JWT `accessToken` & `refreshToken` in `expo-secure-store`.
- `hydrate`: Read Kudi JWT from `expo-secure-store`, restore session, and set `sdk.setAuthToken(token)`.

---

### 1.2 — API: Privy Token Exchange & JWT Issuer

**Current state:** `auth.controller.ts` registers a user and returns wallets — no JWT issued, no Privy identity verification endpoint. `webhooks.controller.ts` has `handlePrivyWebhook` for `user.created`.

**[MODIFY] `apps/api/src/modules/auth/auth.controller.ts`**
- `authenticatePrivy`:
  1. Accept `{ privyToken, privyUserId, email, phoneNumber }`.
  2. Verify Privy token via Privy server SDK / JWKS endpoint.
  3. Look up user by `privyUserId` (or email/phone) in `ledgerService`.
  4. If user does not exist, trigger registration: create DB record, generate Solana & Monad wallets via `custodyManager`.
  5. Sign and return Kudi session JWT `{ accessToken, refreshToken, user, wallets }`.
- `refreshToken`: Accept a valid Kudi refresh token, return a fresh access token.
- `verifyPin` / `setPin`: Allow setting/verifying 4-digit transaction PIN for sensitive payouts.

**[MODIFY] `apps/api/src/modules/auth/auth.routes.ts`**
- Register `POST /api/v1/auth/privy-authenticate`
- Register `POST /api/v1/auth/refresh`
- Register `POST /api/v1/auth/pin/set` & `POST /api/v1/auth/pin/verify`
- Protect all non-auth routes with `jwtPlugin` preHandler.

**[NEW] `apps/api/src/utils/jwt.ts`**
```ts
export const signAccessToken = (server, payload) =>
  server.jwt.sign(payload, { expiresIn: '24h' });
export const signRefreshToken = (server, payload) =>
  server.jwt.sign(payload, { expiresIn: '30d' });
```

---

### 1.3 — SDK: Add Privy Auth & Token Management

**[MODIFY] `packages/sdk/src/index.ts`**
- Add `authenticatePrivy(payload)` → `POST /api/v1/auth/privy-authenticate`
- Add `refreshToken(token)` → `POST /api/v1/auth/refresh`
- Expose `setAuthToken(token)` — attaches `Authorization: Bearer <token>` to all protected HTTP requests.


---

## Phase 2 — Balance, Rate & Home Screen (Day 3)

### 2.1 — API: LedgerService → PostgreSQL

**Current state:** `LedgerService` uses in-memory `Map` objects — data lost on restart.

**[MODIFY] `apps/api/src/services/ledgerService.ts`**
- Inject `PrismaClient` (already registered via `prismaPlugin` in `server.ts`).
- Replace all `Map` reads/writes with Prisma queries:
  - `registerUser` → `prisma.user.create()`
  - `getBalance` → `prisma.user.findUnique()`
  - `setBalance` → `prisma.user.update()`
  - `recordSpend` → `prisma.transaction.create()`
  - `getTransaction` → `prisma.transaction.findUnique()`

**[NEW] `packages/database/prisma/schema.prisma`**
```prisma
model User {
  id              String           @id
  phoneNumber     String?          @unique
  email           String?          @unique
  pinHash         String?
  kycStatus       String           @default("NOT_STARTED")
  kycTier         String           @default("UNVERIFIED")
  balanceUSDC     Float            @default(0)
  solanaAddress   String?
  monadAddress    String?
  virtualAccounts VirtualAccount[]
  transactions    Transaction[]
  createdAt       DateTime         @default(now())
}

model VirtualAccount {
  id            String @id @default(cuid())
  userId        String
  user          User   @relation(fields: [userId], references: [id])
  accountNumber String
  accountName   String
  bankName      String
  bankCode      String
  currency      String @default("NGN")
  provider      String
}

model Transaction {
  id               String   @id @default(cuid())
  reference        String   @unique
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  type             String   // SPEND_BANK | SPEND_ONCHAIN | DEPOSIT_ONCHAIN | DEPOSIT_OFFCHAIN | BILL
  amountUSDC       Float
  amountNGN        Float?
  exchangeRate     Float?
  status           String   @default("PENDING")
  recipientBank    String?
  recipientAccount String?
  recipientName    String?
  chain            String?
  txHash           String?
  provider         String?
  narration        String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

---

### 2.2 — API: Live Rate Service

**Current state:** `rateService.ts` returns hardcoded `1585.5`.

**[MODIFY] `apps/api/src/services/rateService.ts`**
- Add `pollBinanceP2P()` and `pollBybitP2P()` private methods.
- Cache the rate in Redis with a 60-second TTL.
- Add `startPolling(intervalMs = 60_000)` — called in `server.ts` after startup.
- Broadcast `rate:updated` via Socket.io on each rate change.

**[MODIFY] `apps/api/src/server.ts`**
- Add Socket.io server instance.
- Call `rateService.startPolling()` after server starts.

---

### 2.3 — Wallet: Real Balance Hook

**[NEW] `apps/wallet/src/hooks/useBalance.ts`**
```ts
export function useBalance() {
  const userId = useAuthStore(s => s.user?.id);
  return useQuery({
    queryKey: ['balance', userId],
    queryFn: () => sdk.getBalance(userId!),
    refetchInterval: 30_000,
    enabled: !!userId
  });
}
```

**[MODIFY] `apps/wallet/app/(tabs)/index.tsx`**
- Replace `useKudiWallet()` with `useBalance()`.
- Pass `data.balanceUSDC` and `data.currentRateNGN` to `<BalanceCard />`.

**[MODIFY] `apps/wallet/components/BalanceCard.tsx`**
- Subscribe to `rate:updated` Socket.io event for live rate ticks.

---

## Phase 3 — Transactions & History (Day 4)

### 3.1 — API: Transaction History Endpoint

**[MODIFY] `apps/api/src/modules/balance/balance.controller.ts`**

Add `getTransactions`:
```ts
public getTransactions = async (request, reply) => {
  const { userId } = request.params;
  const { limit = 20, offset = 0, type } = request.query;
  const txs = await prisma.transaction.findMany({
    where: { userId, ...(type ? { type } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit, skip: offset
  });
  return successResponse({ transactions: txs });
};
```

**[MODIFY] `apps/api/src/modules/balance/balance.routes.ts`**
- Register `GET /api/users/:userId/transactions`

**[MODIFY] `packages/sdk/src/index.ts`**
- Add `getTransactions(userId, options?)` method.

---

### 3.2 — Wallet: Live History

**[NEW] `apps/wallet/src/hooks/useTransactions.ts`**
```ts
export function useTransactions() {
  const userId = useAuthStore(s => s.user?.id);
  return useQuery({
    queryKey: ['transactions', userId],
    queryFn: () => sdk.getTransactions(userId!),
    enabled: !!userId
  });
}
```

**[MODIFY] `apps/wallet/app/(tabs)/history.tsx`**
- Replace hardcoded `historyItems` with `useTransactions()` data.
- Add skeleton loading state.

**[MODIFY] `apps/wallet/app/(tabs)/index.tsx`**
- Replace hardcoded `recentTransactions` with first 3 items from `useTransactions()`.

---

## Phase 4 — Spend Flows (Days 5–6)

### 4.1 — Off-Chain: Bank Payout (Percel Pattern)

The API already has the full flow in `payoutController.spendToBank` — PIN verification, KYC tier limits, auto-reversal on failure, receipt generation. The wallet just needs to drive it correctly.

**[MODIFY] `apps/wallet/src/hooks/useKudiWallet.ts`**
- Remove the `catch` block that silently shows fake success.
- Return full error message from API.
- After successful spend: `queryClient.invalidateQueries(['balance', 'transactions'])`.

**[MODIFY] `apps/wallet/app/(tabs)/spend.tsx`** (bank mode)
- Wire send button to `sdk.spendToBank({ userId, pin, amountUSDC, bankCode, accountNumber, accountName })`.
- Show reference number + NGN amount from API response.
- On success: navigate to `/(tabs)/history`.

**[MODIFY] `apps/wallet/app/(tabs)/spend.tsx`** (bank picker)
- Replace hardcoded `NIGERIAN_BANKS` with `useQuery(['banks'], sdk.getSupportedBanks)`.
- Wire account number field to `sdk.resolveAccount(accountNumber, bankCode)`.

---

### 4.2 — Off-Chain: Inter-App Transfer

**[MODIFY] `apps/api/src/modules/payout/payout.controller.ts`**

Add `spendToUser`:
```ts
public spendToUser = async (request, reply) => {
  const { fromUserId, toHandle, amountUSDC, pin } = request.body;
  // 1. Resolve handle --> userId (by phoneNumber or username)
  // 2. Verify PIN
  // 3. Debit sender ledger, credit recipient ledger
  // 4. Record both-sides transaction
  // 5. Emit socket 'payment:received' to recipient room
};
```

**[MODIFY] `packages/sdk/src/index.ts`** → add `spendToUser(payload)`.

**[MODIFY] `apps/wallet/app/(tabs)/spend.tsx`** (inter-app mode)
- Wire handle field to `sdk.resolveUser(handle)`.
- Wire send button to `sdk.spendToUser(...)`.

---

### 4.3 — On-Chain: Crypto Broadcast

**[MODIFY] `apps/api/src/modules/payout/payout.controller.ts`**

Add `spendOnChain`:
```ts
public spendOnChain = async (request, reply) => {
  const { userId, pin, amountUSDC, toAddress, chain } = request.body;
  // 1. Verify PIN + balance
  // 2. Get user's custody wallet via CustodyManager
  // 3. Broadcast via @kudi/chains
  // 4. Debit ledger on confirmation + record txHash
};
```

**[MODIFY] `packages/sdk/src/index.ts`** → add `spendOnChain({ userId, pin, amountUSDC, toAddress, chain })`.

**[MODIFY] `apps/wallet/app/(tabs)/spend.tsx`** (on-chain mode)
- Wire "Confirm & Broadcast" to `sdk.spendOnChain(...)`.
- Show `txHash` with Solscan / Monad Explorer deep link on success.

---

## Phase 5 — Deposit Flows (Days 7–8)

### 5.1 — Off-Chain: Virtual Account

**[MODIFY] `apps/api/src/modules/balance/balance.controller.ts`**

Add `getVirtualAccounts`:
```ts
public getVirtualAccounts = async (request, reply) => {
  const { userId } = request.params;
  const accounts = await prisma.virtualAccount.findMany({ where: { userId } });
  return successResponse({ accounts });
};
```

**[MODIFY] `packages/sdk/src/index.ts`** → add `getVirtualAccounts(userId)`.

**[NEW] `apps/wallet/src/hooks/useVirtualAccounts.ts`**
```ts
export function useVirtualAccounts() {
  const userId = useAuthStore(s => s.user?.id);
  return useQuery({
    queryKey: ['virtualAccounts', userId],
    queryFn: () => sdk.getVirtualAccounts(userId!)
  });
}
```

**[MODIFY] `apps/wallet/app/(tabs)/deposit.tsx`** (off-chain mode)
- Replace hardcoded account arrays with `useVirtualAccounts()` data.
- If no accounts (KYC incomplete): show CTA to `/kyc`.

---

### 5.2 — On-Chain: Real QR Codes

**[MODIFY] `apps/wallet/app/(tabs)/deposit.tsx`** (on-chain mode)
- Pull `solanaAddress` / `monadAddress` from `useBalance().data.wallets`.
- Render real QR code via `react-native-qrcode-svg`.

```bash
pnpm --filter @kudi/wallet add react-native-qrcode-svg
```

---

### 5.3 — On-Chain: Deposit Detection (Worker)

**[MODIFY] `apps/worker/src/solanaListener.ts`**
- On confirmed USDC transfer to a monitored address:
  1. Look up `userId` by `toAddress`.
  2. Credit balance via `ledgerService.setBalance()`.
  3. Record with `type: 'DEPOSIT_ONCHAIN'`.
  4. Emit Socket.io `deposit:confirmed` to user's room.

**[MODIFY] `apps/wallet/app/(tabs)/deposit.tsx`**
- Listen for `deposit:confirmed`:
  ```ts
  socket.on('deposit:confirmed', ({ amount }) => {
    queryClient.invalidateQueries(['balance']);
    queryClient.invalidateQueries(['transactions']);
    Alert.alert('Deposit Confirmed!', `+$${amount} USDC received`);
  });
  ```

---

## Phase 6 — KYC Flow (Day 9)

**[NEW] `apps/wallet/app/kyc.tsx`**
- Multi-step: Full Name → ID Type (BVN / NIN) → ID Number → Submit.
- Call `sdk.verifyKYCID({ userId, idNumber, idType, firstName, lastName })`.
- On success: show provisioned virtual account → navigate to deposit.
- Store KYC tier in `auth.store` for header / profile display.

**[MODIFY] `apps/wallet/app/profile.tsx`**
- Replace hardcoded "Tier 3 Verified" pill with `useBalance().data.kycTier`.
- Replace hardcoded `$50,000` limit with live `dailyLimitNGN` from API.

---

## Phase 7 — Bills & Airtime (Day 10)

**[NEW] `apps/wallet/app/bills/airtime.tsx`**
- Network picker + phone + amount.
- Call `sdk.payBill({ userId, billType: 'AIRTIME', billerName, recipientIdentifier, amountNGN })`.

**[NEW] `apps/wallet/app/bills/electricity.tsx`**
- Meter number + DISCO selector + amount.
- Call `sdk.payBill({ userId, billType: 'ELECTRICITY', ... })`.

**[MODIFY] `apps/wallet/app/(tabs)/index.tsx`**
- Update quick actions to route to `/bills/airtime`, `/bills/data`, `/bills/electricity`.

---

## Phase 8 — Real-time & Push Notifications (Day 11)

### 8.1 — Socket.io Client

**[NEW] `apps/wallet/lib/socket.ts`**
```ts
import { io } from 'socket.io-client';
export const socket = io(API_BASE_URL, { autoConnect: false });
export const connectSocket = (userId, token) => {
  socket.auth = { token };
  socket.connect();
  socket.emit('join:room', userId);
};
export const disconnectSocket = () => socket.disconnect();
```

**[MODIFY] `apps/wallet/app/_layout.tsx`**
- Call `connectSocket(userId, token)` after hydration when authenticated.
- Call `disconnectSocket()` on logout.

```bash
pnpm --filter @kudi/wallet add socket.io-client
```

### 8.2 — Push Notifications

**[MODIFY] `apps/api/src/lib/notifications.ts`**
- Wire `expo-server-sdk` to send pushes on `deposit:confirmed` and `spend:success`.

**[NEW] `apps/wallet/src/hooks/usePushNotifications.ts`**
- Register device token on app load.
- Call `sdk.savePushToken(userId, token)`.

```bash
pnpm --filter @kudi/api add expo-server-sdk socket.io bullmq ioredis
```

---

## Phase 9 — SDK Robustness & Error Handling (Day 12)

### 9.1 — SDK Auth Interceptor

**[MODIFY] `packages/sdk/src/index.ts`**
- Wrap all `fetch` calls:
  - Attach `Authorization: Bearer <token>`.
  - On `401`: attempt token refresh, retry once.
  - On refresh failure: call `onSessionExpired` → triggers `authStore.logout()`.
  - On `5xx`: exponential backoff with 3 retries.

### 9.2 — Global Error Boundary

**[MODIFY] `apps/wallet/app/_layout.tsx`**
- Wrap navigator in React error boundary.
- Show friendly fallback screen instead of crash.

### 9.3 — Typed SDK Responses

**[NEW] `packages/sdk/src/types.ts`**
```ts
export interface ApiResponse<T> { success: boolean; data: T; message?: string; }
export interface BalanceResponse {
  balanceUSDC: string;
  currentRateNGN: number;
  kycTier: string;
  dailyLimitNGN: number;
  wallets: { chain: string; address: string }[];
}
export interface TransactionResponse { transactions: Transaction[]; total: number; }
export interface SpendResponse { reference: string; amountNGN: number; newBalanceUSDC: string; }
export interface VirtualAccountResponse { accounts: VirtualAccount[]; }
```

---

## File-by-File Summary

| File | Status | Action |
|---|---|---|
| `packages/sdk/src/index.ts` | Exists | Auth methods, token injection, typed returns |
| `packages/sdk/src/types.ts` | NEW | Typed API response interfaces |
| `packages/database/prisma/schema.prisma` | NEW | User, Transaction, VirtualAccount models |
| `apps/api/src/services/ledgerService.ts` | Exists | Replace Maps with Prisma |
| `apps/api/src/services/rateService.ts` | Exists | Live P2P polling + Redis cache |
| `apps/api/src/modules/auth/auth.controller.ts` | Exists | Privy auth verification, token exchange, JWT session issuance |
| `apps/api/src/modules/auth/auth.routes.ts` | Exists | Register Privy auth & refresh routes |
| `apps/api/src/modules/balance/balance.controller.ts` | Exists | Add getTransactions, getVirtualAccounts |
| `apps/api/src/modules/payout/payout.controller.ts` | Exists | Add spendToUser, spendOnChain |
| `apps/api/src/server.ts` | Exists | Add Socket.io, start rate polling |
| `apps/api/src/lib/notifications.ts` | Exists | Wire expo-server-sdk push delivery |
| `apps/api/src/utils/jwt.ts` | NEW | signAccessToken, signRefreshToken helpers |
| `apps/worker/src/solanaListener.ts` | Exists | Wire deposit → ledger credit + socket emit |
| `apps/worker/src/evmListener.ts` | Exists | Wire deposit → ledger credit + socket emit |
| `apps/wallet/store/auth.store.ts` | Exists | Privy login integration, SecureStore token persistence |
| `apps/wallet/src/hooks/useKudiWallet.ts` | Exists | Remove mock fallbacks, add query invalidation |
| `apps/wallet/src/hooks/useBalance.ts` | NEW | React Query balance hook (30s refresh) |
| `apps/wallet/src/hooks/useTransactions.ts` | NEW | React Query transactions hook |
| `apps/wallet/src/hooks/useVirtualAccounts.ts` | NEW | React Query virtual accounts hook |
| `apps/wallet/src/hooks/usePushNotifications.ts` | NEW | Expo push token registration |
| `apps/wallet/lib/socket.ts` | NEW | Socket.io client singleton |
| `apps/wallet/app/_layout.tsx` | Exists | Connect socket post-auth + error boundary |
| `apps/wallet/app/(auth)/welcome.tsx` | Exists | Wire Privy sign-in (Google, Email, Apple) |
| `apps/wallet/app/(tabs)/index.tsx` | Exists | Live balance + real transactions |
| `apps/wallet/app/(tabs)/history.tsx` | Exists | Live transaction history |
| `apps/wallet/app/(tabs)/deposit.tsx` | Exists | Live wallet addresses, QR codes, virtual accounts |
| `apps/wallet/app/(tabs)/spend.tsx` | Exists | Full spend wiring (bank, inter-app, on-chain) |
| `apps/wallet/app/profile.tsx` | Exists | Live KYC tier + limits from API |
| `apps/wallet/app/kyc.tsx` | NEW | BVN/NIN verification multi-step flow |
| `apps/wallet/app/bills/airtime.tsx` | NEW | Airtime purchase screen |
| `apps/wallet/app/bills/electricity.tsx` | NEW | Electricity bill screen |

---

## New Dependencies

```bash
# Wallet app
pnpm --filter @kudi/wallet add expo-secure-store react-native-qrcode-svg socket.io-client

# API
pnpm --filter @kudi/api add expo-server-sdk socket.io bullmq ioredis
```

---

## Execution Priority

```
Phase 1  -->  Auth with Privy (OAuth + JWT + SecureStore)  nothing else works without a real session
Phase 2  -->  Balance + Live Rate                            live data on the home screen
Phase 3  -->  Transaction history                            real activity feed
Phase 4  -->  Spend flows                                    core product value
Phase 5  -->  Deposit flows                                  on-chain + virtual accounts
Phase 6  -->  KYC flow                                       gates spend limits and virtual accounts
Phase 7  -->  Bills (airtime, electricity)                   quick actions
Phase 8  -->  Real-time + push notifications                 Socket.io + Expo push
Phase 9  -->  Error handling + SDK robustness                production hardening
```

---

## Key Conventions (from Percel Architecture)

1. **Zustand for client state, React Query for server state** — same split as Percel; never mix them.
2. **Auto-reversal on payout failure** — already in `payout.controller.ts`; preserve it unconditionally.
3. **Single SDK client** — all API calls through `@kudi/sdk`'s `KudiSDK` instance; no raw `fetch` inside components.
4. **SecureStore** — tokens always in `expo-secure-store`; never AsyncStorage, never in-memory only.
5. **Query invalidation** — after every mutating action (spend, deposit, KYC), invalidate relevant queries so the UI reflects the new state immediately.
6. **Webhook HMAC verification** — all provider webhooks must be HMAC-verified; already in `webhooks.controller.ts`.
7. **Provider failover** — payout calls go through `paymentRegistry.initiateTransferWithFailover()`; never call a provider directly.
