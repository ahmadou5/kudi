# Sweep + Deposit Remediation Plan (trackable)

Source audit: `SWEEP_DEPOSIT_SECURITY_AUDIT.md`. Owner split across two parallel agents plus integrator. Check a box only when the acceptance check passes and `pnpm run typecheck` is green for touched packages.

## R1 — Verification & confirmation integrity [agent: chain-security] ✅ DONE
- [x] `verifyDepositTransaction` never returns `confirmed: true` on RPC/parse failure (return `confirmed: false`, no synthesized amount).
- [x] Solana deposits credit only at `finalized` (or explicit threshold); `confirmationThreshold` is honored, not hardcoded `confirmed: true`.
- [x] EVM deposits credit only when `confirmations >= threshold`; unconfirmed logs are skipped/logged, never credited.
- [x] Both credit paths (`DepositService`, `ChainDepositProcessor.processDepositEvent`) gate on the above.
- Accept: `rg -n "confirmed: true" packages/chains/src` shows zero in verification paths; threshold constants defined once per chain. ✅ verified 2026-09-25 (also fixed `partnerCustody.ts` fallback at integration).

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
- Accept: sweep of a partially-drained wallet settles the actual amount (or fails loudly) without corrupting the ledger; exposure metric wired to existing reconciliation alerts.

## R5 — Credit integrity, ownership, cursors [agent: chain-security code + integrator decision] ⚠️ MOSTLY DONE — 1 item open
- [x] API credit path is one DB transaction (credit + `Deposit` insert + `ProcessedSignature` insert in one prisma transaction; remove fire-and-forget `.catch` swallow; in-memory sets are cache-only).
- [x] Amount parsing centralized and validated (reject NaN/negative/dust-inconsistent); Phase A keeps `Float` columns. Full BigInt minor-unit migration is a separate follow-up (needs migration + backfill — not in this pass).
- [x] Single sweep owner documented; worker retry policy unified (one status set, one cap, one backoff); orphan deposits (missing wallet row) go to dead-letter, never stuck silent.
- [ ] Scanner cursor persistence per chain/wallet with full pagination — NOT DONE (needs restructuring; current in-memory cursors + narrow Solana window remain the residual risk).
- Accept: restart mid-poll causes no double credit and no missed deposit in a bursty-wallet test; retry policy constants defined once.

## R6 — Config validation, RPC failover, log redaction [agent: platform-hardening] ✅ DONE (1 follow-up noted)
- [x] Startup validation fails closed on missing/invalid treasury addresses, mint/token contracts, chain IDs (no placeholder addresses like `KudiTreasury...` / `0x...AUSD` reaching tx builders). Placeholder fallbacks also removed from admin UI (shows "not set" instead).
- [x] Secondary RPC configured with failover for Solana + Monad reads (`*_RPC_URL_FALLBACK` + `fetchJsonWithRpcFallback`).
- [x] Logs/notifications redact `privyWalletId`, secrets, push tokens. Follow-up (not done): mask `privyWalletId` in `AdminController.getDeposits` → admin UI for non-need-to-know roles.
- Accept: boot with unset treasury env fails fast with a clear error; `rg -ni "kuditreasury|0x\.\.\.AUSD" packages/chains/src` shows no active fallback.

## Execution
1. `chain-security` agent: R1, R3, R4, R5-code. `platform-hardening` agent: R2, R6. Disjoint file scopes (see agent prompts); no commits.
2. Integrator (main): resolve overlaps, run `pnpm run typecheck`, tick boxes above only on green + acceptance checks.
3. User actions: secret rotation (R2), treasury funding/monitoring decision for treasury-pays (R3), BigInt migration scheduling (R5).
