# Financial Flow Review: Deposits, On-Chain Sends, Sweeps, and Local Spend

Date: 2026-09-16

## Verdict

This system is not ready for real customer funds yet.

The product shape is correct: users get chain deposit addresses, deposits are detected by a worker, an internal USDC ledger is credited, users can spend to bank accounts, send to other users, or send on-chain, and treasury/float/sweep concepts exist. But the current implementation still has several open doors that can lose money, over-credit users, debit users without broadcasting, or allow unauthorized spends if deployed as-is.

Production readiness score:

- Deposit detection: C
- Sweep/treasury backing: D
- Local spend to bank: D
- Local user-to-user transfer: D
- On-chain send: F
- Authorization and transaction safety: F
- Overall financial safety: D- / not production-ready


## Phase Tracker

Markers:

- `[ ]` Not started
- `[~]` Partially implemented, still unsafe for production
- `[x]` Implemented and typechecked
- `[!]` Blocked or requires deployment/DB migration confirmation

| Phase | Status | Scope | Completed Evidence | Remaining Work |
|---|---:|---|---|---|
| Phase 0A | [x] | Stop-loss auth and operational route protection | `apps/api/src/utils/authGuards.ts`; guarded payout, bills, KYC, balance, profile, notifications, admin, and deposit ops routes | Confirm mobile/admin clients send JWT/admin key correctly |
| Phase 0B | [x] | PIN fail-closed and stronger new PIN hashing | `apps/api/src/utils/hash.ts`; `LedgerService.setUserPin` now hashes with salted PBKDF2 | Add PIN retry limits, lockouts, and migration job for legacy `hashed_` PINs |
| Phase 0C | [x] | Disable implicit mock chain sends | `packages/chains/src/selfCustody.ts`; mock sends require explicit `ALLOW_MOCK_CHAIN_SENDS=true` and are blocked in production | Add startup checks for chain-specific treasury wallet IDs |
| Phase 1A | [x] | Durable on-chain withdrawal handoff | `Withdrawal` model in Prisma; API persists withdrawals; worker polls DB instead of memory queue | Apply DB migration / `db:push` before deployment |
| Phase 1B | [x] | Withdrawal processing lifecycle | Worker claims rows with `FOR UPDATE SKIP LOCKED`, marks `PROCESSING`, broadcasts, confirms, retries, marks failed/confirmed, records reversal ledger entry, and requeues stale no-tx `PROCESSING` rows | Add durable notification outbox and recovery handling for stale broadcast rows with tx hashes |
| Phase 2 | [~] | Transaction-first balance architecture | `BalanceAccount` model added; debit/credit flows use DB transactions/row locks; user-facing balance/profile reads prefer `BalanceAccount`; daily spend caps now run inside atomic debits | Some legacy in-memory helpers remain; multi-step inter-app transfer should become one single transaction; migrate money columns to `Decimal` |
| Phase 3 | [x] | Atomic deposit crediting | Worker deposit processing now writes `ProcessedSignature`, `BalanceAccount`, `LedgerEntry`, and `Notification` in one DB transaction | Move push delivery to durable outbox; sweep lifecycle still belongs to Phase 4 |
| Phase 4 | [~] | Sweep and treasury backing | `Deposit` lifecycle exists; wallet custody metadata/Privy IDs are persisted; worker attempts server-custody EVM/Monad and Solana sweeps, confirms before `SWEPT`, retries failed/blocked sweeps, exposes admin sweep visibility/manual requeue, audit logs requeues, raises operator alerts, and reconciliation snapshots summarize exposure | Validate Solana sweep on devnet/mainnet with live Privy wallet; compare snapshots against real treasury balances |
| Phase 5 | [~] | Decimal money and reconciliation | `ReconciliationSnapshot` model and worker snapshot job added; daily spend limits now use first-class `SpendLimitWindow`/`SpendLimitEntry` rows and release bank payout failures | Replace money `Float` columns with `Decimal`; add admin-configurable limits; reconcile snapshots against provider/on-chain treasury balances and alert on drift |

## Finding Status Summary

| # | Finding | Status After Latest Pass | Notes |
|---:|---|---:|---|
| 1 | On-chain send jobs are in-memory | [x] | API no longer uses in-process queue for handoff; `Withdrawal` table and DB worker processor added; obsolete `CryptoWithdrawalQueue` code removed. Still needs DB migration confirmation. |
| 2 | Spend/send routes trust body user IDs | [x] | Money controllers now derive actor from JWT and routes are guarded. |
| 3 | PIN passes when missing and weak hash | [~] | Missing PIN now fails closed and new PINs are salted PBKDF2. Legacy `hashed_` PINs still verify during migration; retry lockout remains open. |
| 4 | Balance changes are memory/not atomic | [~] | Debit-side flows and deposit credits now use `BalanceAccount`; main user-facing reads prefer DB. Some legacy memory paths and `Float` money columns remain. |
| 5 | Deposit credit not transactional | [x] | Active worker deposit credit now atomically writes idempotency marker, balance credit, ledger entry, and notification row. |
| 6 | Active worker does not sweep | [~] | Worker now attempts server-custody EVM/Monad and Solana sweeps, waits for confirmation before `SWEPT`, retries due failed/blocked sweeps, and records non-server-custody paths as float exposure. |
| 7 | Sweep incomplete for Solana | [~] | Worker now calls the Solana SPL transfer builder through `SelfCustodyProvider` using the deposit wallet as signer/source and treasury as recipient. Needs live-chain validation. |
| 8 | Mock hashes on missing credentials | [x] | Closed for production by requiring explicit mock flag outside production. |
| 9 | Deposit debug/rescan public | [x] | Deposit ops routes are now admin-guarded. |
| 10 | Daily limits incomplete | [~] | Bank, inter-app, bill, and on-chain spends now enforce cumulative caps inside `debitBalanceAtomic` using `SpendLimitWindow`/`SpendLimitEntry`; bank payout provider failures release limit usage. Admin-configurable limits and broader reversal release paths remain open. |
| 11 | No treasury/liability reconciliation snapshots | [~] | Worker now records DB snapshots for balance liability, sweep exposure, and pending/broadcast withdrawals; external treasury balance comparison and alerting remain open. |

## Change Log

### 2026-09-16: Cleanup Pass

Implemented by current agent:

- Removed obsolete in-process `CryptoWithdrawalQueue` implementation from `packages/chains`.
- Removed obsolete API-side `apps/api/src/services/cryptoWithdrawalProcessor.ts`; durable withdrawal processing now lives in the worker.
- Removed the stale queue export from `packages/chains/src/index.ts`.
- Removed generated `apps/admin/tsconfig.tsbuildinfo` and added `*.tsbuildinfo` to `.gitignore`.
- Removed tracked scratch/ad-hoc scripts with hard-coded database URLs and obsolete flow assumptions.
- Removed obsolete `packages/database/test-db.js` hard-coded Neon connection test.

Verification run:

- `pnpm --filter @kudi/chains lint` passed.
- `pnpm --filter @kudi/api lint` passed.
- `pnpm --filter @kudi/database lint` passed.
- Secret-pattern scan for hard-coded DB URLs/keys returned no remaining hits.
- `pnpm typecheck` passed across 17 workspaces.
- `pnpm architecture:check` passed.
- `pnpm smoke:test` passed.
- `pnpm artifacts:check` passed.

Remaining cleanup note:

- Older API `DepositService`/`SweepService` are still referenced by admin deposit operational routes, so they were not deleted in this pass.

### 2026-09-16: Sweep Audit and Operator Alert Completion Pass

Implemented by current agent:

- Added Prisma `AdminAuditLog` for administrative action tracking.
- Added Prisma `OperatorAlert` with unique `(type, reference)` alerts to avoid polling spam.
- Manual sweep requeues now write an admin audit row with actor, target, action, and details.
- Added admin operator-alert endpoint at `/api/v1/admin/operator-alerts` and `/api/admin/operator-alerts`.
- Operator alert generation covers exhausted sweep retries and treasury exposure from the latest reconciliation snapshot.
- Admin deposits page now displays open operator alerts above the deposit table.

Verification run:

- `pnpm --filter @kudi/database lint` passed.
- `pnpm --filter @kudi/api lint` passed.
- `pnpm --filter @kudi/admin lint` passed.
- `pnpm typecheck` passed across 17 workspaces.
- `pnpm architecture:check` passed.
- `pnpm smoke:test` passed.
- `pnpm artifacts:check` passed.

Remaining from this phase:

- Validate Solana sweep with a live Privy server wallet before real funds.
- Compare reconciliation snapshots with actual treasury balances from chain/provider APIs, not only internal sweep exposure.
- Apply the Prisma migration before deployment.

### 2026-09-16: Admin Manual Sweep Requeue Pass

Implemented by current agent:

- Added admin-only POST requeue endpoint for failed/blocked unswept deposits: `/api/v1/admin/sweeps/:signature/requeue` and `/api/admin/sweeps/:signature/requeue`.
- Requeue resets the deposit to `SWEEP_PENDING`, clears the sweep error, zeroes `sweepAttemptCount`, and sets `nextSweepAttemptAt` to now.
- Added admin client helper `requeueSweep`.
- Added a `Requeue` action button on exhausted `SWEEP_FAILED`/`SWEEP_BLOCKED` deposits in the admin deposits page.

Verification run:

- `pnpm --filter @kudi/api lint` passed.
- `pnpm --filter @kudi/admin lint` passed.
- `pnpm typecheck` passed across 17 workspaces.
- `pnpm architecture:check` passed.
- `pnpm smoke:test` passed.
- `pnpm artifacts:check` passed.

Remaining from this pass:

- Add audit log records for manual requeues.
- Add automated alerts for exhausted `SWEEP_FAILED`/`SWEEP_BLOCKED` deposits and reconciliation drift.
- Validate Solana sweep with a live Privy server wallet before real funds.

### 2026-09-16: Admin Sweep Operator Visibility Pass

Implemented by current agent:

- Added admin API deposit listing backed by real `Deposit` rows at `/api/v1/admin/deposits` and `/api/admin/deposits`.
- Added admin sweep health endpoint at `/api/v1/admin/sweeps/health` and `/api/admin/sweeps/health`.
- Sweep health returns aggregate exposure by status plus exhausted failed/blocked rows.
- Updated admin deposit data types to include sweep status, retry count, next retry, tx hash, and error fields.
- Updated admin deposits page to show sweep status, retry progress, exhausted action state, and sweep error snippets.

Verification run:

- `pnpm --filter @kudi/api lint` passed.
- `pnpm --filter @kudi/admin lint` passed.
- `pnpm typecheck` passed across 17 workspaces.
- `pnpm architecture:check` passed.
- `pnpm smoke:test` passed.
- `pnpm artifacts:check` passed.

Remaining from this pass:

- Add manual requeue controls for exhausted sweep rows.
- Add automated alerts for exhausted `SWEEP_FAILED`/`SWEEP_BLOCKED` deposits and reconciliation drift.
- Validate Solana sweep with a live Privy server wallet before real funds.

### 2026-09-16: Deposit Sweep Retry Scheduling Pass

Implemented by current agent:

- Added retry metadata to Prisma `Deposit`: `sweepAttemptCount` and `nextSweepAttemptAt`.
- Added an index for due sweep work: `[sweepStatus, nextSweepAttemptAt]`.
- Updated sweep status transitions to schedule retry delays for `SWEEP_FAILED` and `SWEEP_BLOCKED`.
- Added `ChainDepositProcessor.processSweepRetries()` to claim due sweep rows with `FOR UPDATE SKIP LOCKED`.
- Worker now runs sweep retries every 60 seconds and once on startup.
- Retry attempts are capped at four worker claims so persistent failures remain visible for operators.

Verification run:

- `pnpm --filter @kudi/worker lint` passed.
- `pnpm --filter @kudi/database lint` passed.
- `pnpm typecheck` passed across 17 workspaces.
- `pnpm architecture:check` passed.
- `pnpm smoke:test` passed.
- `pnpm artifacts:check` passed.

Remaining from this pass:

- Add admin/manual controls to inspect and requeue exhausted sweep retries.
- Add alerts when deposits remain `SWEEP_FAILED` or `SWEEP_BLOCKED` after retry exhaustion.
- Validate Solana sweep with a live Privy server wallet before real funds.

### 2026-09-16: Server-Custody Solana Sweep Enablement Pass

Implemented by current agent:

- Updated `SelfCustodyProvider` to read production credentials and chain config from environment by default.
- Extended Solana `sendCrypto` support with an optional `fromAddress`, so the signing/source owner can be a server-custody deposit wallet instead of only the treasury wallet.
- Updated the Solana SPL transaction builder to derive source ATA and fee payer from the signing wallet.
- Enabled worker Solana sweeps for `SERVER_CUSTODY` wallets with a persisted Privy wallet ID.
- Worker now waits for sweep transaction confirmation before marking deposits `SWEPT`; timeout/errors become `SWEEP_FAILED`.
- Rebuilt `@kudi/chains` declarations so downstream workspace packages see the new `fromAddress` option.

Verification run:

- `pnpm --filter @kudi/chains build` passed.
- `pnpm --filter @kudi/chains lint` passed.
- `pnpm --filter @kudi/worker lint` passed.
- `pnpm typecheck` passed across 17 workspaces.
- `pnpm architecture:check` passed.
- `pnpm smoke:test` passed.
- `pnpm artifacts:check` passed.

Remaining from this pass:

- Validate the Solana sweep path against a live Privy server wallet on devnet/mainnet before real funds.
- Add retry scheduling for `SWEEP_FAILED` deposits instead of waiting for a future rescan/manual action.
- Compare `ReconciliationSnapshot` values against real Solana/EVM treasury balances and alert on drift.

### 2026-09-16: First-Class Spend Limit Accounting Pass

Implemented by current agent:

- Added Prisma `SpendLimitWindow` and `SpendLimitEntry` models.
- Updated `LedgerService.debitBalanceAtomic` to lock a per-user/day spend window before checking cumulative daily spend.
- Daily limit usage is now recorded in `SpendLimitEntry` inside the same transaction as the balance debit and ledger entry.
- Added `LedgerService.releaseSpendLimitEntry` for reversal-aware limit release.
- Bank payout provider failure now releases the original daily-limit entry before restoring balance.
- Spend sources are labeled as `BANK_PAYOUT`, `INTER_APP_TRANSFER`, `BILL_PAYMENT`, and `ONCHAIN_SEND`.

Verification run:

- `pnpm --filter @kudi/api lint` passed.
- `pnpm --filter @kudi/database lint` passed.
- `pnpm typecheck` passed across 17 workspaces.
- `pnpm architecture:check` passed.
- `pnpm smoke:test` passed.
- `pnpm artifacts:check` passed.

Remaining from this pass:

- Add admin-configurable tier limits instead of hard-coded constants.
- Release spend-limit entries for any future async reversal paths beyond bank payout provider failure.
- Migrate money columns from `Float` to `Decimal`.

### 2026-09-16: Cumulative Daily Spend Limit Pass

Implemented by current agent:

- Added shared daily limit helpers in `apps/api/src/utils/dailyLimits.ts`.
- Moved daily limit enforcement into `LedgerService.debitBalanceAtomic`, where the user balance row is locked before checking cumulative spend.
- Bank payout, inter-app transfer, bill payment, and on-chain send now pass daily-limit checks into the atomic debit path.
- Unverified users now correctly fail spend attempts against a `0` NGN limit instead of bypassing the old one-transaction check.
- Balance responses now read daily limit values from the centralized helper.

Verification run:

- `pnpm --filter @kudi/api lint` passed.
- `pnpm --filter @kudi/database lint` passed.
- `pnpm typecheck` passed across 17 workspaces.
- `pnpm architecture:check` passed.
- `pnpm smoke:test` passed.
- `pnpm artifacts:check` passed.

Remaining from this pass:

- Add first-class spend-window tables or columns instead of deriving NGN totals from ledger metadata.
- Make daily limits reversal-aware so provider-failed bank payouts do not consume a user's limit forever.
- Add admin-configurable limits rather than hard-coded tier caps.

### 2026-09-16: Reconciliation Snapshot and Stale Withdrawal Watchdog Pass

Implemented by current agent:

- Added Prisma `ReconciliationSnapshot` model for liability, sweep exposure, float exposure, unsupported sweep, and in-flight withdrawal rollups.
- Added worker reconciliation processor that snapshots `BalanceAccount`, `Deposit`, and `Withdrawal` aggregates every five minutes.
- Added a withdrawal watchdog that returns stale no-tx `PROCESSING` withdrawals to `PENDING` so worker crashes before broadcast do not strand rows forever.
- Wired both jobs into the worker startup loop and initial boot pass.

Verification run:

- `pnpm --filter @kudi/worker lint` passed.
- `pnpm --filter @kudi/database lint` passed.
- `pnpm typecheck` passed across 17 workspaces.
- `pnpm architecture:check` passed.
- `pnpm smoke:test` passed.
- `pnpm artifacts:check` passed.

Remaining from this pass:

- Add external treasury balance comparison and alerting against these snapshots.
- Add recovery/confirmation handling for stale rows that already have a tx hash.
- Migrate money columns from `Float` to `Decimal`.

### 2026-09-16: Chain-Aware Sweep Metadata and EVM Sweep Pass

Implemented by current agent:

- Added wallet custody metadata fields to Prisma `Wallet`: `privyWalletId`, `custodyType`, and raw `metadata`.
- Updated wallet persistence to store Privy wallet IDs from generated deposit wallets.
- Updated worker deposit processing to read wallet custody metadata via raw SQL.
- Added chain-aware sweep status updates for deposits.
- Server-custody EVM/Monad deposits now attempt sweep from the deposit Privy wallet to configured EVM treasury.
- Solana deposits are explicitly marked `SWEEP_UNSUPPORTED` until the SPL sweep builder is production-safe.
- Non-server-custody deposits are marked `FLOAT_EXPOSURE`.

Verification run:

- `pnpm --filter @kudi/worker lint` passed.
- `pnpm --filter @kudi/api lint` passed.
- `pnpm --filter @kudi/database lint` passed.

Remaining from this pass:

- Build production-safe Solana deposit-wallet sweep transaction path.
- Add treasury reconciliation snapshots for `SWEPT`, `SWEEP_FAILED`, `SWEEP_UNSUPPORTED`, and `FLOAT_EXPOSURE`.
- Confirm EVM treasury env naming in deployment: `KUDI_TREASURY_EVM_ADDRESS` or `KUDI_MONAD_TREASURY_ADDRESS`.

### 2026-09-16: Balance Read and Withdrawal Claim Hardening Pass

Implemented by current agent:

- Added `LedgerService.getBalanceAsync` to read `BalanceAccount` first.
- Switched balance/profile and post-withdrawal response paths to DB-first balance reads.
- Updated worker withdrawal processor to claim pending rows inside a transaction with `FOR UPDATE SKIP LOCKED`.
- Claimed withdrawals are marked `PROCESSING` before broadcast, reducing duplicate processing risk when multiple worker instances run.

Verification run:

- `pnpm --filter @kudi/worker lint` passed.

Remaining from this pass:

- Add watchdog to return stale `PROCESSING` rows to `PENDING` if a worker dies mid-broadcast before tx hash is known.
- Add notification outbox for withdrawal success/failure.

### 2026-09-16: Deposit Sweep Lifecycle Tracking Pass

Implemented by current agent:

- Added Prisma `Deposit` model with deposit credit status and sweep lifecycle fields.
- Updated active worker deposit transaction to insert/update a `Deposit` row whenever a deposit is credited.
- New deposits are marked `SWEEP_PENDING`, so treasury exposure is visible and queryable.

Verification run:

- `pnpm --filter @kudi/worker lint` passed.
- `pnpm --filter @kudi/database lint` passed.

Remaining from this phase:

- Actual sweep execution is not implemented in the active worker.
- Wallet custody metadata is not persisted, so the worker cannot yet distinguish server-custody sweepable wallets from self-custody float exposure.
- Existing Solana `SweepService` transaction builder is still incomplete and should not be used as production proof of sweep.

### 2026-09-16: Atomic Deposit Credit Pass

Implemented by current agent:

- Updated active worker deposit processing in `apps/worker/src/processors/chainDepositProcessor.ts`.
- Deposit handling now resolves the wallet owner, then transactionally inserts `ProcessedSignature`, locks/updates `BalanceAccount`, writes `LedgerEntry`, and creates `Notification`.
- Duplicate signatures now return without crediting, and the crash window between signature marker and ledger credit is closed.

Verification run:

- `pnpm --filter @kudi/worker lint` passed.

Remaining from this phase:

- Push notification delivery still happens directly after the transaction; a durable outbox is still preferred.
- Deposit sweep lifecycle remains open in Phase 4.

### 2026-09-16: BalanceAccount Debit-Side Pass

Implemented by current agent:

- Added Prisma `BalanceAccount` model with per-user asset balances, reserved balance, and versioning.
- Added `LedgerService.ensureBalanceAccount`, `debitBalanceAtomic`, and `creditBalanceAtomic`.
- Switched bank spend debit to a database transaction with row lock and provider-failure reversal.
- Switched inter-app transfer debit and recipient credit to atomic balance helpers.
- Switched on-chain withdrawal creation to debit through `BalanceAccount` before persisting the withdrawal.
- Switched bill payment debit to `BalanceAccount`.
- Updated worker withdrawal failure reversal to restore `BalanceAccount` and write reversal ledger entry in one transaction.
- Updated API rollback helper to restore through `creditBalanceAtomic`.

Verification run:

- `pnpm --filter @kudi/api lint` passed.
- `pnpm --filter @kudi/worker lint` passed.
- `pnpm --filter @kudi/database lint` passed.

Remaining from this phase:

- Deposit worker still writes ledger directly and must update `BalanceAccount` transactionally.
- Balance reads still lean on process memory after startup; they should read `BalanceAccount` directly.
- Multi-step inter-app transfer should become one single DB transaction, not debit then credit in two helper calls.
- Money columns still use `Float`; `Decimal` migration remains open.

### 2026-09-16: Stop-Loss and Durable Withdrawal Pass

Implemented by current agent:

- Added `apps/api/src/utils/authGuards.ts` with `requireAuth`, `requireSelfParam`, `requireSelfBody`, and `requireAdmin`.
- Guarded payout routes in `apps/api/src/modules/payout/payout.routes.ts`.
- Guarded deposit operational routes in `apps/api/src/modules/deposits/deposits.routes.ts`.
- Guarded balance/profile/notification routes to enforce same-user access.
- Guarded KYC and bills routes and updated controllers to derive `userId` from JWT.
- Guarded admin mutation/config/export routes with admin authorization.
- Updated payout controller to derive spend actors from JWT instead of body `userId` / `fromUserId`.
- Updated `apps/api/src/utils/hash.ts` so missing PIN hashes fail closed and new PINs use salted PBKDF2.
- Updated `LedgerService.setUserPin` to persist PBKDF2 hashes.
- Added production config checks for `ADMIN_API_KEY`, Privy credentials, and treasury address in `packages/config/src/index.ts`.
- Updated `packages/chains/src/selfCustody.ts` so implicit mock chain sends fail unless explicitly enabled outside production.
- Added Prisma `Withdrawal` model in `packages/database/prisma/schema.prisma`.
- Updated `LedgerService` to persist and read durable withdrawals.
- Updated on-chain send flow to persist DB withdrawals instead of relying on `CryptoWithdrawalQueue` handoff.
- Replaced worker withdrawal stub with a DB-backed processor in `apps/worker/src/processors/cryptoWithdrawalProcessor.ts`.

Verification run:

- `pnpm --filter @kudi/api lint` passed.
- `pnpm --filter @kudi/worker lint` passed.
- `pnpm --filter @kudi/chains lint` passed.
- `pnpm --filter @kudi/config lint` passed.
- `pnpm --filter @kudi/database lint` passed.
- `pnpm typecheck` passed across 17 workspaces.
- `pnpm architecture:check` passed.
- `pnpm smoke:test` passed.
- `pnpm artifacts:check` passed.

Deployment note:

- The database schema changed. Apply the Prisma schema update with the project migration flow before deploying the worker/API changes.
- Local verification ran on Node `22.9.0`, while the repo declares Node `20`; CI should run on Node 20.

## Intended Money Flow

The system should work like this:

1. User receives a Kudi-assigned Solana/Monad deposit address.
2. User deposits USDC/AUSD on-chain.
3. Worker detects a confirmed chain event.
4. Worker writes one idempotent ledger credit inside a database transaction.
5. If Kudi controls the deposit wallet, funds are swept to treasury. If user self-custodies, the app must not pretend those funds are fully treasury-backed unless there is a clear float/liability model.
6. User spends from internal ledger balance.
7. For local bank spend, the system atomically reserves funds, initiates payout, and settles or reverses based on provider status.
8. For on-chain send, the system atomically reserves funds, creates a durable withdrawal job, worker broadcasts from treasury, confirms on-chain, then finalizes or releases the reservation.
9. Every step has audit entries, idempotency keys, reconciliation status, and no process-memory-only financial state.


## Improvements Applied on 2026-09-16

This review has started moving from diagnosis to implementation. The following stop-loss changes are now in code:

- Money-moving payout, bill, KYC, balance, profile, notification, and operational deposit routes now have auth/admin pre-handlers.
- Payout, bill, and KYC controllers derive the actor from the authenticated JWT instead of trusting body-supplied `userId` values.
- PIN verification now fails closed when no PIN hash exists.
- New PINs are stored with salted PBKDF2 hashes instead of plain `hashed_` strings; legacy `hashed_` values remain readable during migration.
- Mock on-chain sends are disabled unless `ALLOW_MOCK_CHAIN_SENDS=true` outside production.
- Production config validation now requires admin/API and Privy/treasury credentials.
- A durable `Withdrawal` table has been added to Prisma.
- On-chain sends now persist pending withdrawal records to the database instead of handing off through an in-process API queue.
- The worker withdrawal processor now polls durable pending withdrawals, broadcasts from treasury, confirms, retries, and marks final status in the database.

Remaining high-priority work:

- Replace process-memory balances with a locked `BalanceAccount` table and transaction-first debit/credit flows.
- Wrap deposit idempotency, ledger credit, and notifications in one database transaction.
- Move sweep orchestration into the active worker deposit path and persist sweep lifecycle status.
- Replace all `Float` money columns with `Decimal` and add reconciliation snapshots.

## Critical Findings

### 1. On-chain send jobs are in-memory, so production worker will not see API-created jobs

Status: `[x]` Implemented in latest pass. The original risk is closed by durable DB withdrawals, but multi-worker row locking/leases remain a production hardening item.

Evidence:

- API debits and enqueues in `apps/api/src/modules/payout/payout.controller.ts:222` to `:240`.
- Queue is an in-process `Map` in `packages/chains/src/cryptoWithdrawalQueue.ts:20` to `:45`.
- Worker processor reads its own process-local singleton in `apps/worker/src/processors/cryptoWithdrawalProcessor.ts:12` to `:20`, but does not broadcast or update status.

Risk:

- In production, API and worker are separate processes. The worker will not see jobs enqueued in API memory.
- If API restarts after debiting the user, the pending send disappears.
- The user can be stuck debited with no chain transaction.

Fix:

- Replace `CryptoWithdrawalQueue` with a durable database-backed `Withdrawal` table or BullMQ/Redis queue.
- The API must create a `Withdrawal` row and reserve/debit balance in the same DB transaction.
- The worker must claim rows with `FOR UPDATE SKIP LOCKED`, broadcast, then mark `BROADCAST`, `CONFIRMED`, or `FAILED`.
- The worker must never depend on in-process memory for financial jobs.

### 2. Spend/send routes trust body-supplied user IDs and do not bind them to authenticated identity

Status: `[x]` Implemented in latest pass. Payout, KYC, bills, balance, profile, notification, admin, and deposit ops routes now have auth/admin guards, and money controllers derive actors from JWT.

Evidence:

- `spendToBank` accepts `userId` from request body in `apps/api/src/modules/payout/payout.controller.ts:40` to `:48`.
- `spendToUser` accepts `fromUserId` from request body in `apps/api/src/modules/payout/payout.controller.ts:120` to `:126`.
- `spendOnChain` accepts `userId` from request body in `apps/api/src/modules/payout/payout.controller.ts:174` to `:181`.
- Routes are registered without auth pre-handlers in `apps/api/src/modules/payout/payout.routes.ts:5` to `:19`.

Risk:

Any caller who knows or guesses a user ID can attempt to spend from that user. PIN currently reduces risk only if users always have real PIN hashes, which they do not.

Fix:

- Add a JWT auth pre-handler for all payout, deposit debug, balance, KYC, bills, and profile routes.
- Derive `userId` from `request.user`, not from request body.
- For admin-only routes, require admin role/claims.
- Keep body user IDs only for admin service actions, and audit them.

### 3. PIN verification passes when no PIN exists, and PIN hashing is not cryptographic

Status: `[~]` Partially implemented. Missing hashes now fail closed and new PINs are salted PBKDF2. Legacy hashes still verify during migration; attempt limits remain open.

Evidence:

- `verifyPin` returns true if `hash` is missing in `apps/api/src/utils/hash.ts:5` to `:7`.
- PIN hash is plain string prefixing in `apps/api/src/utils/hash.ts:1` to `:7`.

Risk:

A user with no PIN hash can pass spend/send PIN checks. Stored PINs are not secure if the database leaks.

Fix:

- `verifyPin` must fail when no hash exists.
- Store PIN hashes using Argon2id or bcrypt with a strong work factor.
- Add PIN attempt limits, lockout/cooldown, and audit logs.
- Require PIN setup before any money movement.

### 4. Balance changes are in process memory and not atomic database transactions

Status: `[~]` Partially implemented. Debit-side money movement now uses `BalanceAccount` transactions and row locks. Deposit credits, balance reads, and full Decimal migration remain open.

Evidence:

- Bank spend reads memory balance and writes memory debit in `apps/api/src/modules/payout/payout.controller.ts:70` to `:80`.
- User-to-user transfer debits/credits memory in `apps/api/src/modules/payout/payout.controller.ts:145` to `:150`.
- On-chain send debits via `createWithdrawal` after reading memory balance in `apps/api/src/modules/payout/payout.controller.ts:205` to `:230`.
- Ledger entries exist in Prisma, but balance is derived from latest `LedgerEntry`, and there is no locked account balance row.

Risk:

Concurrent requests can double spend. Process restarts can desync memory from the database. Failed async ledger writes may leave API memory and DB disagreeing.

Fix:

- Add a `BalanceAccount` or `WalletBalance` table with `availableUSDC`, `reservedUSDC`, and `version`.
- Use Prisma transactions for every money-moving operation.
- Lock the balance row with serializable isolation or raw SQL `SELECT ... FOR UPDATE`.
- Use `Decimal`, not `Float`, for all money amounts.

### 5. Worker deposit credit is not transactional and marks signatures before ledger credit

Status: `[x]` Implemented in latest pass. Active worker deposit credit now writes signature idempotency, `BalanceAccount`, `LedgerEntry`, and `Notification` in one transaction.

Evidence:

- Worker checks processed signature, then creates `ProcessedSignature`, then creates `LedgerEntry` in `apps/worker/src/processors/chainDepositProcessor.ts:129` to `:186`.
- These writes are separate operations, not one transaction.

Risk:

If the process crashes after marking the signature but before writing the ledger credit, the deposit can be permanently skipped. If two workers race, unique constraints may protect part of the flow, but error handling does not retry as a single atomic unit.

Fix:

- Wrap processed signature creation, ledger credit, balance update, and notification outbox write in one database transaction.
- Prefer inserting `LedgerEntry` with unique `(type, referenceId)` first or use a transaction that rolls back the signature marker if credit fails.
- Add a `Deposit` table with status `DETECTED`, `CREDITED`, `SWEEP_PENDING`, `SWEPT`, `SWEEP_FAILED`.

### 6. Active worker deposit flow does not sweep funds to treasury

Status: `[~]` Partially implemented. Active worker now records sweep lifecycle and attempts EVM/Monad server-custody sweeps. Solana sweep and reconciliation remain open.

Evidence:

- Active worker `ChainDepositProcessor` credits the DB and notifies users but does not call `SweepService` in `apps/worker/src/processors/chainDepositProcessor.ts:168` to `:225`.
- Older API `DepositService` calls `SweepService`, but API background polling was intentionally removed from startup. Its rescan route still exists at `apps/api/src/modules/deposits/deposits.routes.ts:8`.

Risk:

The internal ledger can credit users while treasury does not receive the matching assets. Bank payouts and on-chain sends may become under-backed unless there is a monitored float model.

Fix:

- Move sweep orchestration into the worker deposit pipeline.
- Persist sweep status per deposit.
- Do not mark a deposit as fully treasury-backed until sweep confirms, unless an explicit float reserve covers it.
- Create daily treasury-vs-ledger reconciliation.

### 7. Sweep implementation is incomplete for Solana and unsafe as a production guarantee

Status: `[ ]` Open.

Evidence:

- `SweepService` skips when there is no Privy wallet ID in `apps/api/src/services/sweepService.ts:72` to `:83`.
- Solana sweep builds a placeholder JSON string instead of a serialized transaction in `apps/api/src/services/sweepService.ts:217` to `:238`.

Risk:

Solana sweep may not actually work. Self-custody deposits remain at user-controlled addresses while the system still credits spendable internal balance.

Fix:

- Use the working transaction construction path from `SelfCustodyProvider.sendCrypto` or one shared sweep broadcaster.
- Persist wallet custody type: `SERVER_CUSTODY`, `EMBEDDED_USER_CUSTODY`, `PARTNER_CUSTODY`.
- Only auto-sweep server-custody wallets.
- For self-custody, decide product semantics: either require user-signed deposit-to-treasury transfer before crediting spendable balance, or treat credit as a loan/float exposure with strict limits.

### 8. On-chain send can return mock hashes in missing-credential mode

Status: `[x]` Implemented in latest pass. Production now fails instead of returning implicit mock tx hashes.

Evidence:

- `SelfCustodyProvider.sendCrypto` returns a mock tx hash when credentials or treasury wallet ID are missing in `packages/chains/src/selfCustody.ts:383` to `:392`.

Risk:

Production misconfiguration could appear successful while no transaction was broadcast.

Fix:

- Disable sandbox/mock behavior unless `NODE_ENV !== 'production'` and an explicit `ALLOW_MOCK_CHAIN_SENDS=true` flag is set.
- Production startup must fail if treasury wallet IDs, Privy credentials, chain IDs, mint/contract addresses, or treasury addresses are missing.

### 9. Deposit debug/rescan routes are public and can trigger expensive or unsafe behavior

Status: `[x]` Implemented in latest pass. Deposit operational routes now require admin authorization.

Evidence:

- Deposit routes are registered without pre-handlers in `apps/api/src/modules/deposits/deposits.routes.ts:4` to `:10`.
- `/api/v1/deposits/rescan` calls the old API-side deposit service.

Risk:

Anyone can trigger scans, inspect arbitrary on-chain balances, or query treasury status. The rescan endpoint can activate an older flow with different semantics.

Fix:

- Make rescan and treasury endpoints admin-only.
- Remove API-side deposit scanning from public routes, or make the endpoint enqueue a worker command rather than scanning directly.
- Rate-limit and audit all operational endpoints.

### 10. Daily limit logic is incomplete

Status: `[ ]` Open. Requires transaction-first balance/spend tables.

Evidence:

- `spendToBank` compares a single transaction amount to daily limit in `apps/api/src/modules/payout/payout.controller.ts:55` to `:67`.

Risk:

A user can split transactions to bypass daily limits.

Fix:

- Sum settled and pending spend for the user in the current limit window inside the same DB transaction that reserves funds.
- Apply limits across bank spend, user transfer, and on-chain send if required by compliance policy.

## What Is Working

- There is a clear split between API and worker ownership.
- Deposit listeners exist for Solana SPL token accounts and EVM ERC-20 transfers.
- `LedgerEntry` has a uniqueness constraint on `(type, referenceId)`, which is a good start.
- `ProcessedSignature` and `ProcessedWebhook` models exist.
- Address format validation exists before on-chain sends.
- On-chain send construction in `SelfCustodyProvider` is much closer to real broadcast logic than the older sweep implementation.

## Recommended Architecture

### Tables to Add

- `BalanceAccount`: one row per user and asset, with `available`, `reserved`, `version`, `updatedAt`.
- `Deposit`: chain, txHash/signature, logIndex, walletId, amount, asset, confirmations, status, sweepStatus.
- `Withdrawal`: reference, userId, asset, chain, toAddress, amount, status, txHash, attemptCount, nextAttemptAt, failureReason.
- `Payout`: reference, userId, provider, amountUSDC, amountNGN, status, providerReference, failureReason.
- `LedgerEntry`: keep append-only, but use `Decimal` and signed debit/credit direction.
- `OutboxEvent`: durable notifications, webhooks, and push events.
- `ReconciliationSnapshot`: treasury balances, total user liabilities, pending sweeps, pending payouts.

### Transaction Pattern

For every debit:

1. Authenticate request and derive user ID from JWT.
2. Validate PIN and risk policy.
3. Begin DB transaction.
4. Lock user's `BalanceAccount` row.
5. Check available balance and limits.
6. Move amount from `available` to `reserved` or write debit atomically.
7. Insert ledger entry and operation row with idempotency reference.
8. Commit.
9. Worker/provider performs external side effect.
10. Finalize operation in another transaction.

For every credit:

1. Detect chain event.
2. Begin DB transaction.
3. Insert deposit idempotency row.
4. Lock balance row.
5. Credit available balance or pending balance depending on confirmations/sweep model.
6. Insert ledger entry.
7. Insert notification outbox event.
8. Commit.

## Improvement Plan

### Phase 0: Stop Loss Before Any Real Funds

- Require auth pre-handlers on all money-moving routes.
- Change `verifyPin` to fail closed when no hash exists.
- Replace fake PIN hashing with Argon2id/bcrypt.
- Disable mock on-chain sends in production.
- Remove or admin-protect `/api/v1/deposits/rescan`.
- Add production startup guards for all treasury and provider secrets.

### Phase 1: Durable Ledger and Balance Core

- Add `BalanceAccount`, `Withdrawal`, `Deposit`, `Payout`, and `OutboxEvent` models.
- Migrate money amounts from `Float` to `Decimal`.
- Make `LedgerEntry` append-only and write it only inside DB transactions.
- Remove in-memory balance as source of truth.
- Add row locking or serializable transactions for balance mutations.

### Phase 2: Fix On-Chain Send

- Replace `CryptoWithdrawalQueue` with DB-backed withdrawals or BullMQ.
- API creates durable withdrawal and reserves funds atomically.
- Worker claims withdrawals, broadcasts, confirms, and finalizes.
- Add retry policy with `nextAttemptAt`, attempt count, and terminal failure handling.
- Store tx hash and confirmations in DB.

### Phase 3: Fix Deposit and Sweep

- Move sweep orchestration into worker deposit processing.
- Add deposit lifecycle statuses.
- Rebuild Solana sweep using real serialized SPL token transfer logic.
- Track custody model per wallet.
- Add treasury backing policy: credited spendable balance must be backed by swept funds or approved float.

### Phase 4: Reconciliation and Controls

- Build a reconciliation job: total user liabilities vs treasury assets vs pending sweeps/payouts.
- Add alerts when treasury coverage drops below threshold.
- Add admin dashboards for pending deposits, failed sweeps, pending withdrawals, payout failures, and ledger mismatches.
- Add audit logs for auth, PIN failure, payout creation, withdrawal creation, admin actions, and reconciliation overrides.

### Phase 5: Tests Required Before Production

- Concurrent spend double-spend test.
- Crash after signature marker but before ledger credit.
- Crash after debit but before withdrawal job creation.
- Worker restart while withdrawal is pending.
- Duplicate webhook and duplicate chain event tests.
- Provider payout pending/failure/reversal tests.
- Sweep success/failure/idempotency tests.
- Treasury reconciliation tests.

## Production Gate

Do not handle real customer funds until these conditions are true:

- No financial state depends on process memory.
- Every money movement is a database transaction with idempotency.
- Every debit has auth, PIN, risk checks, and durable operation status.
- On-chain sends use durable withdrawal jobs and confirmed broadcasts.
- Deposits cannot be marked processed without a corresponding ledger credit.
- Sweep/treasury backing is explicit and reconciled.
- Mock broadcasts cannot run in production.
- CI has tests covering duplicate, retry, crash, and concurrency scenarios.
