# Sweep + Deposit Remediation Plan (trackable)

Source audit: `SWEEP_DEPOSIT_SECURITY_AUDIT.md`. Owner split across two parallel agents plus integrator. Check a box only when the acceptance check passes and `pnpm run typecheck` is green for touched packages.

## R1 — Verification & confirmation integrity [agent: chain-security] ✅ DONE
- [x] `verifyDepositTransaction` never returns `confirmed: true` on RPC/parse failure (return `confirmed: false`, no synthesized amount).
- [x] Solana deposits credit only at `finalized` (or explicit threshold); `confirmationThreshold` is honored, not hardcoded `confirmed: true`.
- [x] EVM deposits credit only when `confirmations >= threshold`; unconfirmed logs are skipped/logged, never credited.
- [x] Both credit paths (`DepositService`, `ChainDepositProcessor.processDepositEvent`) gate on the above.
- Accept: `rg -n "confirmed: true" packages/chains/src` shows zero in verification paths; threshold constants defined once per chain. ✅ verified 2026-09-25 (also fixed `partnerCustody.ts` fallback at integration).
- [x] Post-deploy fix 2026-09-25: chain agent accidentally deleted `"method": "getTransaction"` (left only the comment) → every Solana tx fetch sent a method-less request → RPC 501 → listener heard NOTHING since deploy (2 real +10 USDC deposits missed, proven on-chain). Restored; verified end-to-end (both missed deposits detected, finalized). Also: batched `getSignatureStatuses` (1 call/wallet/poll + retries, was per-signature with no retry — fail-closed into deafness under 429s) and fixed the misleading "No transactions found" log (now distinguishes all-processed vs RPC-partially-failed).

## R2 — Secrets & admin auth [agent: platform-hardening] ✅ CODE DONE / USER ACTION PENDING
- [x] `.env*` gitignored; no secret values in tracked files/docs.
- [x] `requireAdmin` dev-key bypass (`kudi_admin_secret_dev`) removed; admin fund endpoints require real admin auth, rate-limited, audit-logged. (Also removed the same fallback in admin proxy `[...slug]/route.ts` at integration.)
- [x] `git log --all --oneline -- .env` reviewed → empty (never committed).
- [ ] USER ACTION: rotate Privy app secret, Neon DB password, Redis credentials, Resend key (defense-in-depth — `.env` exists in working tree with live-looking values).
- Accept: `git status --porcelain` shows no `.env`; `rg -n "kudi_admin_secret_dev" apps/api/src apps/admin/src` is empty. ✅ verified 2026-09-25.

## R3 — Gas-mode persistence & wiring incl. `undefined` bug [agent: chain-security] ✅ DONE (decision recorded)
- [x] `setSweepConfig` never persists `gasPaymentMode: undefined` (required-or-preserved; invalid values rejected with 400).
- [x] Single shared `resolveGasPaymentMode()` used by API sweep, worker sweep, and withdrawals (DB value wins; env only as fallback; validated union type). Withdrawal processor wired at integration.
- [x] Every `sendCrypto` call site passes the resolved mode (worker `attemptSweep` included). ✅ verified 2026-09-25 — all 3 call sites pass `gasPaymentMode`.
- [x] `TREASURY_FEE_PAYER` decision: REJECTED LOUDLY on Solana inside `sendCrypto` (2nd signer unavailable via Privy single-wallet signing) — no silent downgrade. Genuine treasury-pays needs treasury-as-signer + funding/monitoring → open decision for you, not auto-built.
- Accept: set mode with and without `gasPaymentMode` → re-read preserves prior value, never `undefined`; `rg -n "sendCrypto\("` call sites all pass a resolved mode.

## R4 — Sweep safety & liability [agent: chain-security] ✅ DONE (breaker is alert-level)
- [x] Pre-sweep on-chain balance check; sweep `min(detected, available - reserve)`; simulate before broadcast; record actual swept amount.
- [x] Un-swept exposure helper (`computeUnbackedExposure`) wired into sweep health + existing reconciliation alerts. NOTE: this is alert-level, not a hard spend block — a hard un-swept spend cap is still open if you want it.
- [x] Post-deploy fix 2026-09-25: treasury native-gas drip (`dripNativeGas` + `sendCryptoWithGasRetry`). Deposit wallets start with 0 SOL/MON; on signer-insufficient-balance the treasury funds the signer (treasury signs its own transfer — single signer) and the sweep retries once. Also retries once on stale-blockhash simulation failure. Fixes `AUSD_TOKEN_ADDRESS` placeholder in `.env` (was invalid hex → every Monad balance read RPC-errored to 0) and the 18-decimal misread of 6-decimal AUSD in `getWalletBalance` (explicit `tokenDecimals` param + known-token map; RPC failures now throw instead of masquerading as zero).
- Accept: sweep of a partially-drained wallet settles the actual amount (or fails loudly) without corrupting the ledger; exposure metric wired to existing reconciliation alerts.

## R5 — Credit integrity, ownership, cursors [agent: chain-security code + integrator decision] ⚠️ MOSTLY DONE — 1 item open
- [x] API credit path is one DB transaction (credit + `Deposit` insert + `ProcessedSignature` insert in one prisma transaction; remove fire-and-forget `.catch` swallow; in-memory sets are cache-only).
- [x] Amount parsing centralized and validated (reject NaN/negative/dust-inconsistent); Phase A keeps `Float` columns. Full BigInt minor-unit migration is a separate follow-up (needs migration + backfill — not in this pass).
- [x] Single sweep owner documented; worker retry policy unified (one status set, one cap, one backoff); orphan deposits (missing wallet row) go to dead-letter, never stuck silent.
- [x] Post-deploy fix 2026-09-25: worker `processSweepRetries` failed every cycle with `FOR UPDATE cannot be applied to the nullable side of an outer join` (LEFT JOIN + FOR UPDATE). Reworked to select-then-claim via `UPDATE ... WHERE status IN (...) RETURNING` — atomic, no join locking. All other FOR UPDATE sites audited (single-table, safe).
- [ ] Scanner cursor persistence per chain/wallet with full pagination — NOT DONE (needs restructuring; current in-memory cursors + narrow Solana window remain the residual risk).
- Accept: restart mid-poll causes no double credit and no missed deposit in a bursty-wallet test; retry policy constants defined once.

## R6 — Config validation, RPC failover, log redaction [agent: platform-hardening] ✅ DONE (1 follow-up noted)
- [x] Startup validation fails closed on missing/invalid treasury addresses, mint/token contracts, chain IDs (no placeholder addresses like `KudiTreasury...` / `0x...AUSD` reaching tx builders). Placeholder fallbacks also removed from admin UI (shows "not set" instead).
- [x] Secondary RPC configured with failover for Solana + Monad reads (`*_RPC_URL_FALLBACK` + `fetchJsonWithRpcFallback`).
- [x] Logs/notifications redact `privyWalletId`, secrets, push tokens. Follow-up (not done): mask `privyWalletId` in `AdminController.getDeposits` → admin UI for non-need-to-know roles.
- Accept: boot with unset treasury env fails fast with a clear error; `rg -ni "kuditreasury|0x\.\.\.AUSD" packages/chains/src` shows no active fallback.

## Execution (completed 2026-09-25 — nothing committed, redeploy required)
1. `chain-security` + `platform-hardening` agents: done. Follow-up multi-agent pass: drip hardening (Agent A), single sweep owner (Agent B), treasury admin surface (Agent C) — all done, all lints green (17/17 packages).
2. Drip farming defenses shipped: `GasDrip` ledger table (schema + runtime-sync + Neon table created), `checkDripEligibility` (dust floor 1.0 USDC → 1 drip/wallet/day → 0.5/day global cap → live treasury floor 0.5) + `recordDrip`, structured `classifySweepFailure` (GAS drips, TOKEN/BLOCKHASH/OTHER never drip; Privy "Signer had insufficient balance" verified GAS), validated env tuning. API sweep now broadcasts clamped `sweepAmount` (was detected amount — confirmed bug, fixed).
3. Single owner: `API_SWEEP_WORKER_ENABLED` default FALSE — worker `ChainDepositProcessor` is sole claimer; `SweepWorkerService` kept for reads only.
4. Admin surface: `GET /api/admin/drips` (parsed cause chips + 24h totals), `GET /api/admin/treasury` (per-chain native + float + drips-remaining + low-runway flag), real audit rows in settings, `TREASURY_FEE_PAYER` rejected from admin modes, effective-mode receipt on save, Treasury & runway strip + drip ledger table + server health panel + fixed float-model banners (keyed wallets never show float copy), admin proxy now forwards query strings.
5. User actions still open: secret rotation (R2), BigInt migration + persisted scan cursors (R5), Privy dashboard sponsorship check (the EVM 03:27 failure class), hard un-swept spend cap (R4 alert-level only).
6. REDEPLOY Railway (api + worker + admin) — production still runs pre-fix builds; none of this takes effect until then. Post-deploy canary: watch for `💧 Dripped` lines and the 8 requeued sweeps settling.
