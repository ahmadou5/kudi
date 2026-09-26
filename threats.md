# Threats Analysis: Metropolis (Kudi) Financial Protocol

**Date:** 2026-09-16
**Repository:** /home/ahmadou/metropolis
**Scope:** All applications, shared packages, and infrastructure

---

## 🛡️ Executive Summary

This document catalogs all identified security threats, vulnerabilities, and risk vectors in the Metropolis (Kudi) monorepo. The system handles user deposits, on-chain sends, bank payouts, virtual cards, and utility bills — making it a **high-value target** for financial theft, fraud, and data exposure.

**Production readiness score: D- / not production-ready** (per Financial Flow Review)

The greatest risks are operational (duplicate processing, race conditions, missing idempotency) rather than cosmetic, but several critical security vulnerabilities also exist.

---

## 🔐 Authentication & Authorization

| # | Threat | Severity | File/Location | Description |
|---|--------|----------|---------------|-------------|
| 1 | **Hardcoded admin password fallback** | Critical | `apps/api/src/modules/auth/auth.controller.ts:438-439`<br>`apps/admin/src/app/api/auth/login/route.ts:17,51` | `process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY || 'admin123'` — If env vars are missing, default `'admin123'` is used. Same pattern in admin login route. |
| 2 | **JWT_SECRET with dev fallback in production** | Critical | `apps/api/src/plugins/jwt.ts:8` | `secret: apiConfig.JWT_SECRET || 'kudi-local-dev-jwt-secret'` — Production may silently fall back to development secret if `JWT_SECRET` is not set. |
| 3 | **PIN verification passes when no hash exists** | High | `apps/api/src/utils/hash.ts:5-7` | `verifyPin` returns `true` if hash is missing (`!hash => true`). A user with no PIN set can bypass PIN gated spends/sends. |
| 4 | **Admin route missing auth pre-handlers** | High | `apps/api/src/modules/payout/payout.routes.ts:5-19`<br>`apps/api/src/modules/deposits/deposits.routes.ts:4-10` | Some payout and deposit routes registered **without** `{ preHandler: requireAuth }` or `{ preHandler: requireAdmin }`. |
| 5 | **Body userId trusted without JWT verification** | High | `apps/api/src/modules/payout/payout.controller.ts:40-48,120-126,174-181` | `spendToBank`, `spendToUser`, `spendOnChain` accept `userId` from request body. Without proper auth guards, anyone can forge requests. |
| 6 | **Squad secret key exposed in env** | Medium | `.env:51`<br>`apps/api/src/lib/squad.ts:14` | `SQUAD_SECRET_KEY="squad_secret_key_here"` — Secret committed to .env file, exposed in version control if not properly gitignored. |
| 7 | **Monnify secret key exposed in env** | Medium | `.env:48`<br>`apps/api/src/lib/monnify.ts:34` | `MONNIFY_SECRET_KEY="monnify_secret_key_here"` — Same risk as above. |
| 8 | **Paystack secret key exposed in env** | Medium | `.env:44`<br>`apps/api/src/lib/paystack.ts:24` | `PAYSTACK_SECRET_KEY="sk_test_paystack_secret_key_here"` — Same risk. |
| 9 | **Korapay secret key exposed in env** | Medium | `.env:54`<br>`apps/api/src/identityVerification.ts:132` | `KORAPAY_SECRET_KEY="korapay_secret_key_here"` — Same risk. |
| 10 | **Privy app secret exposed in env** | Medium | `.env:36` | `PRIVY_APP_SECRET="privy_app_secret_..."` — Embedded wallet private key material. |
| 11 | **Admin API key with weak default** | Medium | `.env:17`<br>`apps/api/src/plugins/jwt.ts:333` | `ADMIN_API_KEY="kudi_admin_secret_dev"` and fallback `process.env.ADMIN_API_KEY || ''` in auth controller. |
| 12 | **Missing rate limiting on financial routes** | Medium | Throughout `apps/api/src/modules/` | No visible rate limiting on payout, deposit, withdrawal, or webhook endpoints. Enables brute-force and abuse. |

---

## 💰 Financial Transaction Security

| # | Threat | Severity | File/Location | Description |
|---|--------|----------|---------------|-------------|
| 13 | **In-memory withdrawal queue — worker cannot see API jobs** | Critical | `packages/chains/src/cryptoWithdrawalQueue.ts:20-45`<br>`apps/worker/src/processors/cryptoWithdrawalProcessor.ts:12-20` | API uses in-process `Map` queue for handoff. In production, API and worker are separate processes; worker will **not see** jobs enqueued in API memory. User can be debited with no chain transaction. |
| 14 | **On-chain send returns mock tx hash without credentials** | Critical | `packages/chains/src/selfCustody.ts:383-392` | `sendCrypto` returns mock hash when credentials/treasury wallet ID are missing. Production misconfiguration could appear successful while no transaction was broadcast. |
| 15 | **Sweep implementation incomplete for Solana** | Critical | `apps/api/src/services/sweepService.ts:217-238` | Solana sweep builds **placeholder JSON string** instead of serialized SPL token transfer. May not actually work on-chain. |
| 16 | **Deposit debug/rescan routes were public** | High | `apps/api/src/modules/deposits/deposits.routes.ts:4-10` | *(Recently fixed — routes now require admin auth)* `/api/v1/deposits/rescan` could trigger expensive scans or inspect arbitrary on-chain balances. |
| 17 | **Daily limit bypass via transaction splitting** | High | `apps/api/src/modules/payout/payout.controller.ts:55-67` | `spendToBank` compares **single transaction amount** to daily limit. User can split large spends across multiple transactions to bypass limits. |
| 18 | **Non-atomic balance mutations in process memory** | High | `apps/api/src/modules/payout/payout.controller.ts:70-80,145-150,205-230` | Bank spend, user-to-user transfer, and on-chain send read/write memory balance without DB row locking. Concurrent requests can double-spend. |
| 19 | **PIN fails closed when missing — but legacy hashes verify** | Medium | `apps/api/src/utils/hash.ts:5-7` | `verifyPin` returns `true` if hash is missing **OR** if legacy `hashed_` prefix matches. Migration from plain hashes to PBKDF2 is incomplete. |
| 20 | **Webhook idempotency not enforced** | Medium | `apps/api/src/modules/webhooks/webhooks.controller.ts:73-335` | Multiple provider webhooks (Paystack, Monnify, Squad, KoraPay) use `transaction_reference` as idempotency key but no unique DB constraint prevents duplicate processing. |
| 21 | **Treasury addresses with dev defaults in admin controller** | Medium | `apps/api/src/modules/admin/admin.controller.ts:137-138,352-353` | `process.env.KUDI_TREASURY_SOLANA_ADDRESS || 'KudiTreasurySolanaDevnet11111111111111111111'` — Devnet default exposed if env missing in production. |
| 22 | **EVM treasury address with dev default** | Medium | `apps/api/src/modules/admin/admin.controller.ts:353` | `process.env.KUDI_MONAD_TREASURY_ADDRESS || ''` — Empty fallback could cause silent failures. |
| 23 | **Crypto withdrawal — worker processes its own process-local singleton** | High | `apps/worker/src/processors/cryptoWithdrawalProcessor.ts:12-20` | Worker claims its own process-local singleton but does not broadcast or update DB status. If multiple worker instances run, they race. |
| 24 | **Deposit credit marks signature before ledger credit** | Medium | `apps/worker/src/processors/chainDepositProcessor.ts:129-186` | Worker checks processed signature, then creates `ProcessedSignature`, then creates `LedgerEntry` — **separate operations, not one transaction**. Crash after signature but before ledger credit can permanently skip deposit. |
| 25 | **Worker deposit flow does not sweep funds to treasury** | High | `apps/worker/src/processors/chainDepositProcessor.ts:168-225` | Worker credits user ledger but does **not call sweep** to move funds from deposit wallet to treasury. Ledger credits user while treasury does not receive matching assets. |
| 26 | **Solana sweep builds placeholder not real transaction** | Critical | `apps/api/src/services/sweepService.ts:217-238` | Builds serialized JSON that may not be valid on-chain SPL transfer. User funds credited without actual treasury backing. |
| 27 | **Server-custody sweep not validated on live chain** | High | `FINANCIAL_FLOW_REVIEW.md:619-625` | Worker attempts server-custody EVM/Monad and Solana sweeps but **no live-chain validation** before marking `SWEPT`. Funds may be lost or stuck. |
| 28 | **Mock chain sends enabled in production** | High | `packages/chains/src/selfCustody.ts:383-392` | `ALLOW_MOCK_CHAIN_SENDS=true` must be explicitly set outside production. Without it, production should fail — but enforcement may be incomplete. |
| 29 | **Float exposure for non-server-custody deposits** | Medium | `FINANCIAL_FLOW_REVIEW.md:638-645` | Deposits where Kudi does not control the wallet are marked `FLOAT_EXPOSURE` but spendable balance may still be available to user. Product semantics unclear. |
| 30 | **No treasury/liability reconciliation** | High | `FINANCIAL_FLOW_REVIEW.md:57-58` | No comparison of total user liabilities vs treasury assets. System cannot detect under-backing until auditor review. |

---

## 🌐 Infrastructure & Network

| # | Threat | Severity | File/Location | Description |
|---|--------|----------|---------------|-------------|
| 31 | **Hardcoded database URL in test scripts** | Critical | `packages/database/test-db.js` (removed but history shows `postgresql://...` hard-coded) | Database credentials committed to code. If any copy remains, secrets exposed in version control. |
| 32 | **Sentry DSN empty/originating from env** | Medium | `.env:76` `SENTRY_DSN=""` | If Sentry DSN is populated with production DSN in env, errors from client may leak to Sentry. |
| 33 | **Redis URL exposed in env** | Medium | `.env:28` `REDIS_URL="redis://..."` | Redis connection string contains authentication. If leaked, attacker can connect to Redis. |
| 34 | **Cloudinary credentials in api lib** | Medium | `apps/api/src/lib/cloudinary.ts:25-27` | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` from `process.env`. |
| 35 | **Identity verification API keys in env** | Medium | `.env:60-61`<br>`apps/api/src/lib/identityVerification.ts:73-100` | `SMILE_IDENTITY_PARTNER_ID`, `SMILE_IDENTITY_API_KEY`, `DOJAH_API_KEY`, `DOJAH_APP_ID` — All exposed in environment. |
| 36 | **Gas sponsorship without signing authority** | Medium | `FINANCIAL_FLOW_REVIEW.md:72-74` | Privy sponsorship pays gas but does **not** give backend signing authority over user-controlled wallets. User/embedded wallets must still be swept through user-signed flow. |
| 37 | **No CI checks for secret leakage** | Medium | Check `.github/workflows/` | No evident GitHub Actions step that scans committed files for API keys/secrets (e.g., `detect-secrets`, `git-secrets`, `trufflehog`). |
| 38 | **.env file at repo root tracked or readable** | High | `.env` at root | Contains all secrets (DB URL, API keys, JWT secrets). If `.env` is not in `.gitignore` or is committed, **all credentials exposed**. |

---

## ⛓️ Race Conditions & Concurrency

| # | Threat | Severity | File/Location | Description |
|---|--------|----------|---------------|-------------|
| 39 | **Duplicate processing from API + worker both starting processors** | Critical | `ARCHITECTURE_REVIEW.md:59-65`<br>`ARCHITECTURE_REVIEW.md:193-194` | `apps/api/src/server.ts` starts rate polling, deposit polling, crypto withdrawals. `apps/worker/src/index.ts` also starts **same** processors. In production, **duplicate processing**, inconsistent balances, repeated withdrawals, race conditions. |
| 40 | **Concurrent spend double-spend without row locking** | High | `apps/api/src/modules/payout/payout.controller.ts:70-80` | Bank spend reads memory balance, writes memory debit. No DB row lock. Concurrent requests can exceed available balance. |
| 41 | **Worker crash after signature marker but before ledger credit** | Medium | `apps/worker/src/processors/chainDepositProcessor.ts:129-186` | If worker crashes after writing `ProcessedSignature` but before `LedgerEntry` + `BalanceAccount` credit, deposit is **permanently skipped**. No retry from API. |
| 42 | **Multiple worker instances racing on same withdrawal** | High | `apps/worker/src/processors/cryptoWithdrawalProcessor.ts:61-152` | Uses `FOR UPDATE SKIP LOCKED` but if multiple worker processes claim same row, only one succeeds. Other instance's broadcast may conflict. No outbox/durable coordination. |
| 43 | **Webhook handler not idempotent** | Medium | `apps/api/src/modules/webhooks/webhooks.controller.ts` | Same webhook from provider (e.g., Paystack retry) can trigger duplicate ledger credit if no unique constraint on `(type, referenceId)`. |
| 44 | **Spend limit not reversal-aware** | Medium | `FINANCIAL_FLOW_REVIEW.md:294-296` | Daily spend limits consumed on provider-failed bank payouts are **not released**. User permanently loses limit capacity. |

---

## 📦 Dependency & Supply Chain Risks

| # | Threat | Severity | File/Location | Description |
|---|--------|----------|---------------|-------------|
| 45 | **Outdated dependency versions** | Medium | `package.json`, `pnpm-lock.yaml` | No evident `npm audit` or `renovate` configuration. Dependencies may contain known vulnerabilities. |
| 46 | **`@kudi/ui` frontend package potentially imported in Node context** | Medium | `packages/ui/` | If frontend UI package is imported in server-side code (API/routes), it may bundle client-only dependencies. Boundary enforcement via `scripts/check-boundaries.mjs` exists but may have gaps. |
| 47 | **No SBOM or dependency provenance** | Low | N/A | No Software Bill of Materials generated. Hard to track vulnerable transitive dependencies. |

---

## 📋 Summary of Critical vs High vs Medium Risks

| Severity | Count | Primary Concerns |
|----------|-------|------------------|
| **Critical** | 7 | In-memory withdrawal queue (user debited, no tx); Hardcoded admin123 fallback; JWT_SECRET dev fallback; Hardcoded DB URLs; Solana sweep placeholder; Duplicate API+worker processors; Mock chain sends in prod |
| **High** | 12 | Non-atomic balance mutations; Daily limit bypass; Worker deposit no sweep; PIN verification issues; Concurrent double-spend; Multiple worker instances; Webhook idempotency; No treasury reconciliation; Solana sweep incomplete; Admin route auth gaps; Float exposure |
| **Medium** | 20 | Secret exposure in env; Missing rate limiting; Outdated deps; Cloudinary creds; Identity API keys; Gas sponsorship limits; No SBOM; Privy app secret; Admin API key weak default; |

---

## ✅ Recent Fixes (as of 2026-09-16)

The following threats have been partially or fully mitigated in this codebase session:

1. ✅ **Removed `CryptoWithdrawalQueue`** — durable DB-backed `Withdrawal` table now used instead
2. ✅ **Admin deposit/rescan routes now require auth** — `{ preHandler: requireAdmin }` added
3. ✅ **PIN hash migration** — new PINs use salted PBKDF2; `verifyPin` fails closed when no hash
4. ✅ **Auth guards on payout/deposit/KYC/admin routes** — JWT-derived actor, not body-supplied userId
5. ✅ **Removed permissive production fallbacks for `JWT_SECRET`** — production startup guard added
6. ✅ **Added `ProcessedSignature`, `ProcessedWebhook`, `LedgerEntry`, `VirtualAccount` idempotency constraints**
7. ✅ **Added `WorkerHeartbeat`** for liveness monitoring
8. ✅ **Added `ReconciliationSnapshot`** model for liability vs asset tracking
9. ✅ **Added `OperatorAlert`** with unique `(type, reference)` to avoid polling spam
10. ✅ **Added `AdminAuditLog`** for administrative action tracking
11. ✅ **Removed obsolete `build:deps` scripts** — Turbo dependency graph now owned
12. ✅ **Standardized source layouts** — wallet app consolidated under `src/*`
13. ✅ **Added dependency-boundary lint rules** — `scripts/check-boundaries.mjs` blocks wallet imports from `@kudi/ui`
14. ✅ **Added CI checks** — `.github/workflows/ci.yml` covers typecheck, lint, architecture check, smoke tests, artifact checks

---

## 🛠️ Recommended Immediate Actions

1. **Rotate all secrets** — Assume any secret in `.env` or git history is compromised. Generate new keys for: JWT, Paystack, Monnify, Squad, KoraPay, Privy, Sentry, Cloudinary, SMILE/DOJAH APIs.
2. **Enforce `JWT_SECRET` required in production** — Remove `|| 'kudi-local-dev-jwt-secret'` fallback; make app crash on startup if missing.
3. **Remove `admin123` default** — Make `ADMIN_PASSWORD` and `ADMIN_API_KEY` required environment variables with production validation.
4. **Flush mock chain sends in production** — Ensure `ALLOW_MOCK_CHAIN_SENDS` is never `true` in prod; add runtime enforcement.
5. **Implement sweep confirmation** — Solana sweep must build real SPL token transfer and await on-chain confirmation before marking deposits `SWEPT`.
6. **Add treasury reconciliation job** — Daily snapshot comparing total user liabilities (BalanceAccount + pending withdrawals + pending deposits) vs actual treasury balances on-chain.
7. **Enforce idempotency at DB level** — Unique constraints on `(type, referenceId)` for `ProcessedSignature`, `ProcessedWebhook`, `LedgerEntry`.
8. **Add rate limiting** — Middleware on all financial routes (`payout`, `deposit`, `withdrawal`, `webhook`).
9. **Audit `.gitignore`** — Ensure `.env`, `node_modules/`, `dist/`, `.next/`, `.turbo/`, `*.tsbuildinfo` are all ignored.
10. **Run `npm audit` or `pnpm audit`** — Fix any high/critical vulnerability findings.

---

## 📚 Related Documents

- `ARCHITECTURE_REVIEW.md` — Architecture improvement checklist and recommendations
- `FINANCIAL_FLOW_REVIEW.md` — Detailed financial flow analysis and production readiness scoring
- `FUNCTIONALITY_AUDIT.md` — Capability matrix and feature completeness
- `KUDI_IMPLEMENTATION_STATUS.md` — Current implementation status per feature
- `ENVIRONMENT_VARIABLES.md` — Environment variable specification and validation