# Metropolis (Kudi) — Full App Functionality Audit & Capability Matrix

**Date:** September 2026  
**Project:** Metropolis / Kudi Financial Protocol  
**Repository Architecture:** Monorepo (5 Applications, 12 Shared Packages)

---

## 📊 Executive Summary

Metropolis (Kudi) is a borderless crypto-to-fiat payment protocol enabling users to hold stablecoin balances (Solana **USDC** & Monad **AUSD**) and instantly spend them to **any Nigerian bank account in NGN** or utilize value-added financial services (Virtual Cards, Utility Bills, Airtime).

All primary core functions—spanning the mobile wallet interface, administrative operations desk, fastify ledger backend, FX rate polling worker, and payment provider failover rails—are **fully implemented and functional** in the codebase.

---

## 📱 1. Mobile Wallet Application (`apps/wallet`)

The mobile app is built with **Expo / React Native**, featuring a sleek Light Silver & Dark Obsidian theme system, technical monospace typography (`Share Tech`), and modal-driven navigation.

| Feature Area | Functionality Achieved | Status | Core File Reference |
|---|---|---|---|
| **Authentication & Security** | Privy embedded wallet login, transaction PIN setup/verification, auth-lock screen with biometric unlock support | ✅ COMPLETED | [`app/(auth)/login.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/(auth)/login.tsx), [`app/auth-lock.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/auth-lock.tsx) |
| **Balance & Wallet Card** | Dual currency display (USDC/AUSD float balance + live spendable NGN conversion), quick action bar (Spend, Deposit, Bills, Cards) | ✅ COMPLETED | [`app/(tabs)/index.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/(tabs)/index.tsx) |
| **Fiat Payout (Spend)** | Dynamic Nigerian bank selector, account resolution, live FX rate conversion preview, transaction PIN gating, instant NGN payout trigger | ✅ COMPLETED | [`app/(tabs)/spend.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/(tabs)/spend.tsx) |
| **Crypto Deposits** | On-chain deposit QR scanner, wallet address copy, Monad (AUSD) & Solana (USDC) chain toggle, deposit status tracker | ✅ COMPLETED | [`app/(tabs)/deposit.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/(tabs)/deposit.tsx), [`app/qr-scanner.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/qr-scanner.tsx) |
| **Virtual Cards** | USD and NGN virtual debit card issuance, card freeze/unfreeze toggle, card top-up, card transaction history | ✅ COMPLETED | [`app/(tabs)/card.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/(tabs)/card.tsx) |
| **Utility Bills & Airtime** | Airtime and mobile data purchase across major telcos (MTN, Airtel, Glo, 9mobile), electricity bill payment forms | ✅ COMPLETED | [`app/bills/airtime.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/bills/airtime.tsx) |
| **Transaction History** | Filterable transaction timeline (Spend, Deposit, Card, Bills), status indicators, detailed receipt screen | ✅ COMPLETED | [`app/(tabs)/history.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/(tabs)/history.tsx) |
| **Transaction Details** | Interactive progress tracker (Requested → Processing → Completed/Failed), reference copying (`expo-clipboard`), block explorer links (Monad Testnet & Solana Devnet) | ✅ COMPLETED | [`app/transaction-details.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/transaction-details.tsx) |
| **KYC Compliance Desk** | Tiered verification flow (Tier 1 BVN/NIN vs Tier 2 ID upload), document camera capture, liveness check status | ✅ COMPLETED | [`app/kyc.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/kyc.tsx) |
| **Real-Time Alerts** | Socket.io connection for instant transaction status updates, push broadcast notifications list | ✅ COMPLETED | [`app/notifications.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/notifications.tsx) |
| **User Profile & Settings** | Security preferences, PIN update, app lock timer settings, wallet address list, active currency unit settings | ✅ COMPLETED | [`app/profile.tsx`](file:///home/ahmadou/metropolis/apps/wallet/app/profile.tsx) |

---

## 💻 2. Admin & Ops Console (`apps/admin`)

The ops console is built with **Next.js App Router**, cookie-based session authentication, route middleware protection, ⌘K command search modal, and responsive sidebar navigation.

| Feature Area | Functionality Achieved | Status | Core File Reference |
|---|---|---|---|
| **Auth & Security** | Admin setup/login flow (`/login`), session cookie token verification, middleware route protection | ✅ COMPLETED | [`src/app/login/page.tsx`](file:///home/ahmadou/metropolis/apps/admin/src/app/login/page.tsx), [`src/middleware.ts`](file:///home/ahmadou/metropolis/apps/admin/src/middleware.ts) |
| **Operations Dashboard** | Real-time metrics (24h volume, total users, payout success rate, system health), interactive volume chart, recent spend transactions feed | ✅ COMPLETED | [`src/app/(dashboard)/dashboard/page.tsx`](file:///home/ahmadou/metropolis/apps/admin/src/app/(dashboard)/dashboard/page.tsx) |
| **FX Rate Oracle Control** | Live Binance/Bybit P2P rate feed monitor, manual rate override form, spread margin adjustment controls | ✅ COMPLETED | [`src/app/(dashboard)/rates/page.tsx`](file:///home/ahmadou/metropolis/apps/admin/src/app/(dashboard)/rates/page.tsx) |
| **Payout Rails & Failover** | Active provider selector (Paystack, Monnify, Squad), automatic failover sequence preview, provider API keys & sandbox toggles | ✅ COMPLETED | [`src/app/(dashboard)/wallet/page.tsx`](file:///home/ahmadou/metropolis/apps/admin/src/app/(dashboard)/wallet/page.tsx) |
| **Chain & Custody Monitor** | Active chain listeners toggle (Monad EVM, Solana), RPC endpoint configuration, Custody Track indicator (Track A vs Track B) | ✅ COMPLETED | [`src/app/(dashboard)/chains/page.tsx`](file:///home/ahmadou/metropolis/apps/admin/src/app/(dashboard)/chains/page.tsx) |
| **KYC Compliance Desk** | Verification queue table, user document inspection modal, manual approve/reject actions, tier limit management | ✅ COMPLETED | [`src/app/(dashboard)/kyc/page.tsx`](file:///home/ahmadou/metropolis/apps/admin/src/app/(dashboard)/kyc/page.tsx) |
| **Transactions & Deposits** | Master ledger tables for spend payouts and on-chain crypto deposits with state filters and details panel | ✅ COMPLETED | [`src/app/(dashboard)/transactions/page.tsx`](file:///home/ahmadou/metropolis/apps/admin/src/app/(dashboard)/transactions/page.tsx), [`src/app/(dashboard)/deposits/page.tsx`](file:///home/ahmadou/metropolis/apps/admin/src/app/(dashboard)/deposits/page.tsx) |
| **Reconciliation & Audit** | Automated SEC/CBN regulatory audit report generator, CSV export download endpoint | ✅ COMPLETED | [`src/app/(dashboard)/settings/page.tsx`](file:///home/ahmadou/metropolis/apps/admin/src/app/(dashboard)/settings/page.tsx) |
| **Broadcast Alerts** | System notification composer to send push alerts to mobile wallet users | ✅ COMPLETED | [`src/app/(dashboard)/notifications/page.tsx`](file:///home/ahmadou/metropolis/apps/admin/src/app/(dashboard)/notifications/page.tsx) |

---

## ⚡ 3. Fastify REST API Backend (`apps/api`)

High-performance **Fastify backend** enforcing financial ledger invariants, security PIN checks, and multi-provider payout routing.

| Endpoint / Engine | Functionality Achieved | Status | Implementation File |
|---|---|---|---|
| `/api/v1/auth/*` | User registration, JWT authentication, transaction PIN setting & verification | ✅ COMPLETED | [`src/modules/auth/index.ts`](file:///home/ahmadou/metropolis/apps/api/src/modules/auth/index.ts) |
| `/api/v1/balance/*` | Live balance calculation (`USDC_balance × FX_rate = NGN_spendable`), double-spend lock | ✅ COMPLETED | [`src/modules/balance/index.ts`](file:///home/ahmadou/metropolis/apps/api/src/modules/balance/index.ts) |
| `/api/v1/payout/*` | Bank account resolution, payout preview, multi-provider failover (`Paystack → Monnify → Squad`), auto-reversal on transfer failure | ✅ COMPLETED | [`src/modules/payout/index.ts`](file:///home/ahmadou/metropolis/apps/api/src/modules/payout/index.ts) |
| `/api/v1/kyc/*` | Smile Identity verification webhook & direct BVN/NIN query, tier limit caps (Tier 1: ₦50k/day, Tier 2: ₦5M/day) | ✅ COMPLETED | [`src/modules/kyc/index.ts`](file:///home/ahmadou/metropolis/apps/api/src/modules/kyc/index.ts) |
| `/api/v1/deposits/*` | On-chain deposit callback processing and ledger credit logic | ✅ COMPLETED | [`src/modules/deposits/index.ts`](file:///home/ahmadou/metropolis/apps/api/src/modules/deposits/index.ts) |
| `/api/v1/bills/*` & `/cards/*` | Virtual card creation, card balance funding, airtime & utility bill payments | ✅ COMPLETED | [`src/modules/bills/index.ts`](file:///home/ahmadou/metropolis/apps/api/src/modules/bills/index.ts) |
| `/api/v1/webhooks/*` | Inbound webhooks from Paystack, Monnify, Squad, and Smile Identity | ✅ COMPLETED | [`src/modules/webhooks/index.ts`](file:///home/ahmadou/metropolis/apps/api/src/modules/webhooks/index.ts) |
| `/api/v1/admin/*` | Rate override API, payout provider switcher, CSV audit export generator | ✅ COMPLETED | [`src/modules/admin/index.ts`](file:///home/ahmadou/metropolis/apps/api/src/modules/admin/index.ts) |

---

## 🔄 4. Background Worker & FX Oracle (`apps/worker`)

Asynchronous worker process handling rate engine polling and blockchain transaction monitoring.

| Worker Service | Functionality Achieved | Status | Implementation File |
|---|---|---|---|
| **FX Rate Poller Engine** | Real-time P2P FX rate scraper (Binance & Bybit), spread calculation, rate caching in Redis/PostgreSQL | ✅ COMPLETED | [`src/rateEngine.ts`](file:///home/ahmadou/metropolis/apps/worker/src/rateEngine.ts) |
| **EVM Chain Deposit Listener** | RPC polling loop for Monad Testnet detecting AUSD token transfer events and crediting user ledger | ✅ COMPLETED | [`src/chainDepositProcessor.ts`](file:///home/ahmadou/metropolis/apps/worker/src/chainDepositProcessor.ts) |
| **Solana Chain Deposit Listener** | RPC polling loop for Solana Devnet/Mainnet detecting SPL-Token USDC transfer events | ✅ COMPLETED | [`src/chainDepositProcessor.ts`](file:///home/ahmadou/metropolis/apps/worker/src/chainDepositProcessor.ts) |

---

## 🌐 5. Web Landing Application (`apps/web`)

Next.js public marketing site and interactive web calculator.

| Feature Area | Functionality Achieved | Status | Implementation File |
|---|---|---|---|
| **Hero & Live FX Converter** | Interactive widget simulating stablecoin to NGN conversions in real time using live rate API | ✅ COMPLETED | [`src/app/page.tsx`](file:///home/ahmadou/metropolis/apps/web/src/app/page.tsx) |
| **Design System Integration** | `@kudi/ui` glassmorphism card components, theme switcher, `Smooch Sans` display font | ✅ COMPLETED | [`src/app/layout.tsx`](file:///home/ahmadou/metropolis/apps/web/src/app/layout.tsx) |

---

## 📦 6. Shared Workspace Packages (`packages/*`)

| Package Name | Purpose & Functionality | Key Exports / Modules |
|---|---|---|
| **`@kudi/database`** | Prisma ORM PostgreSQL schema & database client | `User`, `Wallet`, `LedgerEntry`, `Spend`, `Deposit`, `ChainConfig`, `ProviderConfig`, `RateFeed`, `AuditLog` |
| **`@kudi/chains`** | Multi-chain custody abstraction & RPC listeners | `GeneralizedEVMListener`, `SolanaListener`, `SelfCustodyProvider` (Privy), `PartnerCustodyProvider`, `CustodyManager` |
| **`@kudi/payment-providers`** | Fiat payout adapters & failover manager | `PaystackProvider`, `MonnifyProvider`, `SquadProvider`, `PaymentProviderRegistry` |
| **`@kudi/kyc`** | Identity & compliance provider | `SmileIdentityKYCProvider` (BVN, NIN, Selfie Liveness) |
| **`@kudi/receipts`** | Digital transaction receipt generator | `ReceiptGenerator` (HTML receipt creation) |
| **`@kudi/cards`** | Value-added services provider | `VirtualCardProvider` (USD/NGN card issuing), `BillPaymentProvider` (Airtime/Bills) |
| **`@kudi/sdk`** | TypeScript API SDK | `KudiSDK` (Unified client for API consumption) |
| **`@kudi/ui`** | Monorepo design system | `Card`, `Button`, `Input`, `Badge`, `ThemeToggle`, `Typography` (`Heading`, `Mono`) |
| **`@kudi/types`** | Shared domain interfaces | TypeScript types for Custody, Payment Rails, Chains, KYC, Rates, and Ledger |

---

## 🎯 Summary of System Capabilities

1. **End-to-End Payout Flow**: User deposits AUSD (Monad) or USDC (Solana) → System credits USDC float ledger → User enters Nigerian bank account & PIN → System checks live rate, locks balance, resolves bank name → System executes transfer via **Paystack (or failover to Monnify / Squad)** → NGN arrives instantly in recipient bank account.
2. **Resilient Infrastructure**: Triple-redundant payout failover (`Paystack → Monnify → Squad`), fallback rate oracle, and double-spend float concurrency locking.
3. **Complete Ops Gating**: Full admin governance over rates, payout rails, chain listeners, KYC approvals, and regulatory audit CSV exports.
