# Kudi — SRS Compliance Audit

**Audited against:** `docs/Project/KUDI_SRS.md` (v0.1 Draft)
**Date:** October 2026
**Method:** Code-level audit of apps/api, apps/worker, apps/wallet, apps/admin, packages/*

---

## Executive Summary

| Status | Count | % |
|---|---|---|
| ✅ IMPLEMENTED | 12 | 26% |
| 🟡 PARTIAL | 31 | 67% |
| ❌ NOT IMPLEMENTED | 3 | 7% |
| **Total requirements audited** | **46** | |

The core money path (deposit → ledger → spend → payout → reversal) is **structurally sound**: append-only ledger, row-level locking against double-spends, multi-provider payout with failover, and a swappable `CustodyProvider` interface all exist and work. The largest gaps are in the **admin console** (many UI shells with no backend), the **rate engine** (not actually polling Binance/Bybit P2P), **KYC completeness** (no selfie liveness, tier always jumps to Tier 2), and **notification coverage** (spend-completed push never fires).

---

## Priority List

Ordered by SRS priority (Must → Should → Could), then by implementation gap severity within each tier.

### P0 — Must (MVP blockers / high-severity gaps)

| # | Req | Status | Gap | Where |
|---|---|---|---|---|
| 1 | **FR-1.2** KYC via Smile Identity + selfie liveness | 🟡 Partial | No selfie/liveness capture anywhere; Smile is one of several fallback providers, not exclusive; simulated KYC requires explicit `IDENTITY_SIMULATE=true` (blocked in production at config load). Liveness code was deleted with `packages/kyc`. Deposit is gated indirectly via ₦0 unverified limit, not an explicit KYC check. | `identityVerification.ts:132-141`, `kyc.controller.ts:11-50`, `dailyLimits.ts:4` |
| 2 | **FR-1.3** KYC status storage (pending/verified/rejected) | 🟡 Partial | Schema has full enum (`NOT_STARTED/PENDING/VERIFIED/REJECTED`) but only `VERIFIED` is ever written. `PENDING` and `REJECTED` are never set by any code path. Wallet UI displays these states but backend never produces them. | `schema.prisma:10-21`, `kyc.controller.ts:50` |
| 3 | **FR-1.4** Tiered KYC (partial → lower limits) | 🟡 Partial | Per-tier limits exist (`UNVERIFIED: ₦0, TIER_1: ₦50k, TIER_2: ₦5M`), but verification always hardcodes `TIER_2`. `TIER_1` is never assigned. No partial-verification path. | `dailyLimits.ts:3-7`, `kyc.controller.ts:49-50` |
| 4 | **FR-4.1** Poll Binance P2P + Bybit P2P rates | 🟡 Partial | Polling interval exists (30s BullMQ job), but sources are `open.er-api.com`, CoinGecko, `exchangerate-api.com` — **no Binance or Bybit P2P API is called anywhere**. Admin "Binance/Bybit" figures are static demo values. | `ratePollerProcessor.ts:4-44`, `rateService.ts:106-146`, `admin-data.ts:544-545` |
| 5 | **FR-4.2** Blended, spread-adjusted rate | 🟡 Partial | Spread is applied (`0.99` multiplier), but "blending" is first-success provider selection, not a two-source weighted average. `askRate` is fabricated as `rawRate + 2`. | `ratePollerProcessor.ts:46-76` |
| 6 | **FR-2.4** Minimum deposit per chain/token | 🟡 Partial | Min deposit is hardcoded UI text only (`minDeposit: '0.10'`). No server-side enforcement — dust (even 1 base unit) can be credited. `parseDepositAmount` only rejects `NaN`, `<= 0`, and over-max. | `deposit.tsx:45,87,95`, `selfCustody.ts:77-81` |
| 7 | **FR-5.1** Account name resolution before confirm | 🟡 Partial | Backend resolves via active provider, but the client hook fabricates demo names on error (`'Demo Account (GTBank)'`), and the server **trusts client-supplied `accountName`** without re-resolving. | `useKudiWallet.ts:117-127`, `payout.controller.ts:45` |
| 8 | **FR-5.7** Single internal payout provider interface | 🟡 Partial | Interface + registry + failover exist, but `PaystackProvider` is **never registered** in the registry — `setActiveProvider('paystack')` throws. Admin UI offers Paystack as a rail. `checkTransferStatus` is defined but never called. | `payment-providers/src/index.ts:2,33-37` |
| 9 | **FR-9.1** Transaction PIN required for every spend | 🟡 Partial | PIN enforced on bank payout, inter-app transfer, on-chain send, and cashout. **Bill payments (airtime/electricity) bypass PIN entirely** — no server- or client-side check. | `payout.controller.ts:54-56` vs `bills.controller.ts:16-54` |
| 10 | **FR-3.4** No double-spend (row-level locking) | ✅ Implemented | `FOR UPDATE` row locking inside `prisma.$transaction` on all debit/credit paths. | `ledgerService.ts:725-746` |
| 11 | **FR-2.1** CustodyProvider interface (Self + Partner) | ✅ Implemented | `CustodyProvider` interface, `SelfCustodyProvider`, `PartnerCustodyProvider`, and `CustodyManager` all present and wired. Track A active. | `types/src/index.ts:22-34`, `selfCustody.ts:352`, `partnerCustody.ts:3-45`, `custodyManager.ts:26-69` |
| 12 | **FR-2.2** Chain RPC deposit listeners | ✅ Implemented | Solana listener (finalized commitment) + generalized EVM listener (`eth_getLogs` Transfer-topic) with confirmation thresholds. Atomic credit with idempotency. | `solanaListener.ts:234-382`, `evmListener.ts:35-178`, `depositService.ts:73-179` |
| 13 | **FR-5.4** Debit → transfer → reverse on failure | ✅ Implemented | Synchronous reversal on immediate failure + async reversal via webhooks. | `payout.controller.ts:163-181`, `webhooks.controller.ts:168-171` |
| 14 | **FR-3.1** Balance stored in USDC (float model) | ✅ Implemented | `BalanceAccount.availableUSDC`, `LedgerEntry.amountUSDC`. NGN computed at read time only. | `schema.prisma:135-163` |
| 15 | **FR-3.2** Immutable append-only ledger | ✅ Implemented | Insert-only with `ON CONFLICT DO NOTHING`, unique `(type, referenceId)`. No normal-path updates. | `ledgerService.ts:68-111` |
| 16 | **FR-3.3** Spendable NGN = balance × live rate | ✅ Implemented | Rate fetched at spend time, persisted on transaction record. | `payout.controller.ts:58-61`, `dailyLimits.ts:18-20` |

### P1 — Should (important, can trail MVP)

| # | Req | Status | Gap | Where |
|---|---|---|---|---|
| 17 | **FR-1.1** Register with phone + email | 🟡 Partial | API accepts both (both optional). Wallet sign-up collects **email only** — no phone input in auth flow. | `auth.controller.ts:176-206`, `welcome.tsx:138-146` |
| 18 | **FR-2.3** USDC + AUSD at launch; admin-addable chains | 🟡 Partial | Launch tokens wired. `ChainConfiguration` DB model exists but is **never referenced in code**. No admin CRUD. | `schema.prisma:209-220` |
| 19 | **FR-2.7** Config-driven chain support | 🟡 Partial | Generalized EVM + Solana listeners exist. Chains are env-hardcoded at boot, not runtime-config-driven. No DB load / hot-reload. | `worker/src/index.ts:16-38`, `depositService.ts:23-35` |
| 20 | **FR-2.8** Admin chain CRUD | 🟡 Partial | UI shell has Activate/Deactivate button but it's **local state only** — no API call. No add/edit form. No `/admin/chains` backend route. | `chains/page.tsx:33-39` |
| 21 | **FR-2.10** Admin shows active CustodyProvider | 🟡 Partial | API returns `custodyTrack`. Admin UI labels are **hardcoded "Track A"** in 5+ places, not live-bound. | `admin.controller.ts:146`, `dashboard/page.tsx:299`, `sidebar.tsx:165` |
| 22 | **FR-4.3** Admin rate health + override | 🟡 Partial | Override endpoint works but is **process-memory only** (lost on restart, not applied to worker). Rate-health page calls unregistered `/api/v1/admin/rates` → shows hardcoded demo data. No pause control. | `rateService.ts:26-33,67-73`, `rates/page.tsx:111-131` |
| 23 | **FR-4.4** Rate recorded per transaction | 🟡 Partial | Recorded for bank payouts and cashout. **Not recorded for on-chain sends.** Admin list shows live rate, not historical. | `ledgerService.ts:1508-1521`, `admin.controller.ts:1048-1049` |
| 24 | **FR-5.2** Live conversion + fee before confirm | 🟡 Partial | Crypto flows show rate/fee. NGN payout review sheet shows **no rate or conversion**. Client fee is hardcoded ₦20 that the payout endpoint doesn't actually charge. | `send/ngn.tsx:33,568-587`, `Step3Review.tsx:75-81` |
| 25 | **FR-5.5** Any bank in provider's list | 🟡 Partial | Paystack list is live. Monnify/Squad/Bachs return hardcoded 16-bank lists. Wallet payout flows ignore provider list and use a static 41-bank constant. | `paystack.ts:127-135`, `monnify.ts:127+`, `send/ngn.tsx:19,94` |
| 26 | **FR-5.6** Daily/per-transaction limits by tier | 🟡 Partial | Daily limits enforced atomically. **No per-transaction limit enforcement** — UI advertises caps that don't exist. Tier-1 daily limit mismatches UI (₦50k vs ₦500k). | `dailyLimits.ts:3-23`, `limits.tsx:30,37,44` |
| 27 | **FR-5.8** Admin switch active provider | 🟡 Partial | Switch works and persists + audit-logged. But switching **to Paystack fails** (unregistered). Rails stats (balance, latency, success rate) are hardcoded mocks. | `admin.controller.ts:544-625` |
| 28 | **FR-5.9** Admin failover order | 🟡 Partial | Failover retry loop exists but order is a **code constant** `[MONNIFY, SQUAD, BACHS]`. `setFailoverOrder()` never called. Admin UI toggle is local-state only. | `payment-providers/src/index.ts:27-31,71-73`, `settings/page.tsx:217-235` |
| 29 | **FR-5.10** Provider credentials stored separately | 🟡 Partial | Per-provider env vars exist and are never client-exposed. But **no secrets manager/KMS** — flat process env only. | `config/src/index.ts:63-70`, `.env.example:60-74` |
| 30 | **FR-6.1** Full transaction history | 🟡 Partial | History feed merges deposits, payouts, on-chain sends with status mapping. **Fees are absent** from user-facing history. | `ledgerService.ts:1115-1263`, `transactionMapper.ts` |
| 31 | **FR-6.2** Receipt/export | 🟡 Partial | Receipt generator exists. Endpoint uses **in-memory state** (404s after restart). Admin CSV export returns hardcoded demo row. Wallet has no export/share. | `payout.controller.ts:536-558`, `admin.controller.ts:1052-1063` |
| 32 | **FR-7.1** Push/SMS/email notifications | 🟡 Partial | Deposit-credited push works. **Spend-completed push never fires** (event defined, never invoked). Spend-failed has in-app only. **No transactional email. No SMS.** | `notifications.ts:7,35-40`, `ledgerService.ts:1026-1032` |
| 33 | **FR-8.1** Admin view users/KYC/balances | 🟡 Partial | Real data joined across User + BalanceAccount. Hard-capped `LIMIT 100`, no pagination. Search/filter is client-side only. | `admin.controller.ts:963-1008` |
| 34 | **FR-8.2** Admin search/filter transactions; flag suspicious | 🟡 Partial | UI filters exist (client-side on 100 rows). Backend has no query params. **No suspicious-activity flagging code exists.** | `admin.controller.ts:1046-1050`, `transactions/page.tsx:38-51` |
| 35 | **FR-8.3** Admin KYC review/approve | 🟡 Partial | UI shell mutates **local React state only** — no API call. No `/admin/kyc` backend route. Queue always falls back to demo/empty. | `kyc/page.tsx:23-29` |
| 36 | **FR-8.4** Admin rate history + override | 🟡 Partial | Override works but is **unaudited**. `RateFeedLog` written by worker but no history endpoint or UI. Spread button is cosmetic. | `admin.controller.ts:134-141` |
| 37 | **FR-8.5** Reconciliation view | 🟡 Partial | `ReconciliationSnapshot` model + sweep-health totals exist. CSV export is **hardcoded demo data**. No dedicated crypto-vs-NGN reconciliation screen. | `schema.prisma:316-332`, `admin.controller.ts:1052-1063` |
| 38 | **FR-8.6** Payment provider management | 🟡 Partial | Switch active works. Rails stats are mock. No failover-order API. **No credential-update endpoint or UI.** | `admin.controller.ts:544-625` |
| 39 | **FR-8.7** Chain management + listener health | 🟡 Partial | UI shell only — toggle is local state. No `/admin/chains` route. Listener health returns hardcoded `'HEALTHY'`. `WorkerHeartbeat` model unused. | `chains/page.tsx:33-39`, `admin.controller.ts:355-361` |
| 40 | **FR-8.8** Wallet/custody visibility | 🟡 Partial | Per-chain treasury balances are real (on-chain query). No per-chain aggregate of all custody wallets. Admin "wallet" page is payout-rail management, not custody. | `admin.controller.ts:470-542` |
| 41 | **FR-9.3** Secrets in KMS, never client-side | 🟡 Partial | Secrets are server-side env-only. Never shipped client-side (verified). **No actual KMS/secrets manager.** | `.env.example:50,60-74` |
| 42 | **FR-9.4** Spend rate-limited | 🟡 Partial | Global 100 req/min applies. Spend routes have **no dedicated per-user limit** — only generic global budget + PIN + daily tier limits. | `rateLimit.ts:6-9`, `payout.routes.ts:11-20` |
| 43 | **FR-9.5** Admin high-impact actions logged | 🟡 Partial | `AdminAuditLog` + `recordAdminAudit` exist. Provider switch logs new value but **omits old value**. Chain config changes not logged (not changeable via API). Rate override not logged. | `admin.controller.ts:21-43,607-615` |

### P2 — Could (later / v2)

| # | Req | Status | Gap |
|---|---|---|---|
| 44 | **FR-2.5** Additional non-EVM chains | ❌ Not implemented | Out of v1 scope per SRS. |

### Non-Functional Requirements

| # | Category | Status | Notes |
|---|---|---|---|
| 45 | **NFR** Performance (deposit→spendable 1–2 min) | ✅ Likely met | Listeners poll every 10s; confirmation gates are chain-appropriate. Not benchmarked. |
| 46 | **NFR** Security (encryption, no client keys) | 🟡 Partial | TLS + env secrets + no client-side keys. No KMS. Track A self-custody means key compromise = direct fund loss (SRS flags this as highest-priority risk). |
| 47 | **NFR** Compliance (KYC gate, audit trail) | ✅ Implemented | UNVERIFIED ₦0 limit hard-blocks all spends. Full ledger models. Caveat: gate keys off `kycTier`, not direct `kycStatus === 'VERIFIED'` check. |
| 48 | **NFR** Availability (graceful degradation) | ✅ Implemented | 3-provider rate fallback + stale-cache serving. Worker retries every 30s. Spends not queued when rate is stale (proceed at last-known). |
| 49 | **NFR** Scalability (queued jobs) | ✅ Implemented | Deposits, rates, payouts are separate BullMQ workers, not inline. |
| 50 | **NFR** Usability (< 3 taps spend) | ❌ Not met | 4-stage flow. Best case (saved recipient + biometric): ~4 taps. Cold path: 6–7 taps. |

---

## Scorecard by SRS Section

| Section | Implemented | Partial | Not Implemented | Notes |
|---|---|---|---|---|
| 3.1 Onboarding & KYC | 1 | 4 | 0 | Liveness + tiering incomplete |
| 3.2 Wallet / Deposit | 4 | 5 | 0 | Core custody + listeners solid; admin chain CRUD is shell |
| 3.3 Balance & Ledger | 4 | 0 | 0 | Strongest section — fully implemented |
| 3.4 Rate Engine | 0 | 4 | 0 | Sources wrong; blending fake; override not persisted |
| 3.5 Spend to Bank | 2 | 8 | 0 | Provider abstraction exists; Paystack unregistered |
| 3.6 Transaction History | 0 | 2 | 0 | Fees missing from history; receipt uses in-memory state |
| 3.7 Notifications | 0 | 1 | 0 | Deposit push works; spend-completed never fires |
| 3.8 Admin Console | 0 | 8 | 0 | Most pages are UI shells over demo/fallback data |
| 3.9 Security | 1 | 4 | 0 | PIN gap on bills; no KMS; audit incomplete |
| 4. NFRs | 3 | 2 | 1 | <3 taps not met |

---

## Top 10 Gaps to Close (Recommended Order)

1. **Register Paystack in the payout registry** — one-line fix; admin UI already offers it, currently throws on switch. (`payment-providers/src/index.ts:33-37`)
2. **Add PIN verification to bill payments** — same `verifyPin` pattern used in `payout.controller.ts`. (`bills.controller.ts`)
3. **Wire spend-completed push notification** — `SPEND_COMPLETED` event is defined but never invoked. Call it in `confirmSpendTransaction` / webhook confirmations. (`ledgerService.ts:1038-1057`)
4. **Implement Binance/Bybit P2P rate sources** — replace `open.er-api.com` / CoinGecko with the SRS-mandated P2P sources; implement real multi-source blending. (`ratePollerProcessor.ts`)
5. **Server-side minimum deposit enforcement** — add per-chain/token min check in `parseDepositAmount` or credit path. (`depositService.ts`, `chainDepositProcessor.ts`)
6. **KYC pending/rejected states** — write `PENDING` on submission, `REJECTED` on failure; stop hardcoding `TIER_2`. Assign `TIER_1` for BVN-only, `TIER_2` for full. (`kyc.controller.ts`)
7. **Admin chain CRUD backend** — create `/api/v1/admin/chains` route (GET/POST/PATCH) backed by `ChainConfiguration` model; wire the UI toggle. (`admin.routes.ts`, `chains/page.tsx`)
8. **Admin KYC review backend** — create `/api/v1/admin/kyc` route + approve/reject endpoints; wire the existing UI. (`admin.routes.ts`, `kyc/page.tsx`)
9. **Fix admin data paths** — register `/api/v1/admin/rates`, make reconciliation CSV export real data, replace hardcoded rails stats and listener health with live queries. (`admin.routes.ts`, `admin.controller.ts`)
10. **Reconcile server-side account name** — stop trusting client-supplied `accountName`; always re-resolve on the server before confirming payout. (`payout.controller.ts:45`)

---

## Appendix: Audit Methodology

- Each requirement was checked against the codebase via file-level grep, AST inspection, and manual code reading.
- "Implemented" = working code path exists end-to-end with real persistence/API calls.
- "Partial" = some code exists but has a functional gap, is UI-only, uses demo/hardcoded data, or misses an SRS-mandated detail.
- "Not Implemented" = no relevant code found.
- Route files (`page.tsx`, `layout.tsx`) were treated as framework entry points, not implementation evidence.
- The `@/` path alias in apps/admin was resolved manually (tooling cannot resolve it).
