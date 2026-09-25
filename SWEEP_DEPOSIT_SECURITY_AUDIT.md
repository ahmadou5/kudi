# Sweep + Crypto Deposit Security Audit

Date: 2026-09-25
Scope: USDC/AUSD deposit detection, ledger crediting, sweep-to-treasury, sweep retry workers, gas-payment mode selection.
Files reviewed: `apps/api/src/services/depositService.ts`, `apps/api/src/services/sweepService.ts`, `apps/api/src/services/sweepWorkerService.ts`, `apps/api/src/services/ledgerService.ts` (credit/idempotency paths), `apps/api/src/modules/deposits/*`, `apps/api/src/modules/admin/admin.controller.ts` (`getSweepConfig`/`setSweepConfig`), `apps/api/src/utils/authGuards.ts`, `apps/worker/src/processors/chainDepositProcessor.ts`, `packages/chains/src/selfCustody.ts`, `packages/chains/src/solanaListener.ts`, `packages/chains/src/evmListener.ts`, `packages/database/prisma/schema.prisma`.

## Flow summary

1. Deposit detection: API `DepositService.checkDeposits()` polls per-user wallets (in-memory user list); worker `ChainDepositProcessor.pollAllChains()` polls all `Wallet` rows in Neon.
2. Ledger credit: signature recorded as processed, ledger balance credited, `Deposit` row written (`SWEEP_PENDING` for server wallets, `SWEEP_UNSUPPORTED`/`FLOAT_EXPOSURE` for self-custody).
3. Sweep: `SweepWorkerService` (API) and `ChainDepositProcessor.processSweepRetries`/`attemptSweep` (worker) claim due rows and call Privy `wallets/:id/rpc` via `SelfCustodyProvider.sendCrypto()` to move funds to treasury.

## Your `undefined` sweep-mode bug — root cause

`setSweepConfig` (`apps/api/src/modules/admin/admin.controller.ts:228-243`) accepts `gasPaymentMode` as optional and persists `gasPaymentMode: undefined` when omitted. `JSON.stringify` drops `undefined` keys, so the stored config has no `gasPaymentMode`, and the next read falls back to `'PRIVY_SPONSOR'` while the admin response echoes `undefined`. Separately, `SelfCustodyProvider.getGasPaymentMode()` (`packages/chains/src/selfCustody.ts:57-67`) only reads env vars — it never reads the DB `sweep_config`. So even when the dashboard update succeeds, the actual signing path ignores it unless `params.gasPaymentMode` is passed (only `SweepService.sweepToTreasury` does that; the worker's `attemptSweep` does not). Fix: make `gasPaymentMode` required-or-preserved on update (never store `undefined`), validate/normalize on read, and pass the resolved DB value at every `sendCrypto` call site (or move resolution into one shared helper both API and worker use).

## Findings

### Critical

1. **Fake-deposit credit on RPC/verification failure.** `SelfCustodyProvider.verifyDepositTransaction` returns `{ confirmed: true, amount: '100.00', ... }` as a "structured fallback" when RPC lookup fails (`packages/chains/src/selfCustody.ts:386-393`). If any credit path ever trusts this, attackers can profit from RPC outages. Even where unused today, a `confirmed: true` fallback in a verification function is a loaded gun.
   - Fix: return `{ confirmed: false, ... }` on any lookup failure; never synthesize amounts; alert on fallback.

2. **Unverified events can be credited.** Solana events are emitted with hardcoded `confirmed: true` (`packages/chains/src/solanaListener.ts:243`); `confirmationThreshold` is ignored on Solana. EVM emits both confirmed and unconfirmed logs, but neither `DepositService.checkDeposits` nor `ChainDepositProcessor.processDepositEvent` checks `confirmed`/confirmations before crediting. A 1-confirmation (or reorged) transfer becomes instant spendable ledger balance.
   - Fix: enforce per-chain confirmations (`finalized` for Solana value movement, e.g. 12+ for EVM as the schema default suggests), persist `blockNumber`/slot at credit time, and only credit when threshold is met.

3. **Sweep amount is trusted, not verified.** Sweep uses the originally detected `amountUSDC` without re-reading the source token balance, checking rent-exempt minimums, or simulating. Partial prior sweeps, dust, rent, or token-account closure turn into `insufficient funds` retry loops or failed sweeps that still leave the ledger credited.
   - Fix: pre-sweep balance check, sweep `min(detected, on-chain available - reserve)`, simulate first, record actual swept amount.

4. **Credit-before-backing creates unbacked liability by design.** Ledger is credited at detection; treasury backing arrives later via sweep. With sweeps failing/blocked, users can spend NGN against crypto that never arrives. Reconciliation exists but is detective, not preventive.
   - Fix: cap spendable portion of un-swept deposits, add treasury-exposure circuit breaker, prioritize `SWEEP_FAILED` requeue alerting.

### High

5. **`TREASURY_FEE_PAYER` mode is a no-op on Solana and unwired in the worker.** `feePayerAddr` is hardcoded to `signerAddr` (`packages/chains/src/selfCustody.ts:524`) despite the `gasPaymentMode` plumbing, and the code comment itself warns a distinct treasury fee payer needs a second signer Privy won't provide. `ChainDepositProcessor.attemptSweep` never passes `gasPaymentMode` at all. So selecting treasury-pays changes nothing on Solana (and silently downgrades to user-pays on sponsorship failure).
   - Fix: either implement real treasury-pays (treasury as signer/fee payer, funded and monitored) or remove the mode; never silently fall back — fail loudly when the selected mode can't be honored.

6. **Secrets in working tree.** `.env` contains live-looking `PRIVY_APP_SECRET`, Neon `DATABASE_URL`, Redis URL, and Resend key. If this file is or was committed, rotate everything.
   - Fix: gitignore `.env*`, move to secret manager, rotate Privy secret + DB password + Redis + Resend, audit git history with `git log --all -- .env`.

7. **Admin bypass in non-production.** `requireAdmin` allows the hardcoded dev key `kudi_admin_secret_dev` whenever `NODE_ENV !== 'production'` (`apps/api/src/utils/authGuards.ts:64-67`). Combined with admin deposit rescan/treasury/sweep-config endpoints, this is a fund-operations backdoor on any dev/staging host.
   - Fix: remove dev-key bypass entirely; require explicit allow-list; rate-limit and audit-log admin fund endpoints.

8. **Precision loss in money math.** Token raw values go through `Number(BigInt)` and `Float` columns (`amountUSDC Float`, `availableUSDC Float`), with `toFixed(6)` deltas. Large balances lose precision; dust can round to zero or be credited inconsistently between listeners.
   - Fix: store integer minor units (`amountMicroUsdc BigInt`), do all math in integers, format only at display.

### Medium

9. **Two sweep engines with divergent policy.** API `SweepWorkerService` (retries `PENDING`/`FAILED`, blocks at 5, exponential 1→64 min) vs worker `ChainDepositProcessor` (retries `PENDING`/`FAILED`/`BLOCKED`, cap `< 4`, fixed 10s×attempt). Running both risks double-attempts and status flapping; the worker's inner `JOIN Wallet` also strands deposits whose wallet row is missing.
   - Fix: single owner for sweeping; if both must run, partition by chain/status and use `LEFT JOIN` + dead-letter for orphan deposits.

10. **In-memory dedupe + fire-and-forget writes.** API crediting uses in-memory `processedSignatures` plus a non-awaited `prisma.deposit.create(...).catch(...)` that swallows everything except unique-constraint text matching. A restart or DB write failure credits the user with no sweep row ever created.
    - Fix: make credit + `Deposit` insert + `ProcessedSignature` insert one DB transaction (the worker already does this correctly); treat in-memory sets as cache only.

11. **Scanner cursors are in-memory; Solana scan window is narrow.** EVM `lastScannedBlockMap` resets on restart (500-block rescan); Solana reads last 25 signatures and fetches max 8 per wallet per poll. Bursty wallets can permanently miss deposits.
    - Fix: persist cursors per chain/wallet, paginate fully, add a periodic full-reconciliation scan.

12. **Single RPC, single treasury config, placeholder addresses.** No RPC failover; missing treasury env falls back to placeholder strings (`KudiTreasurySolanaDevnet...`, `0xKudiTreasury...`, `0x...AUSD`) that build invalid transactions.
    - Fix: fail closed on missing/invalid chain config; validate addresses at startup; add secondary RPC.

13. **Sensitive operational data over-logged.** Full RPC errors, wallet IDs, amounts, and push tokens flow through logs/notifications; `privyWalletId` is exposed in admin UI. Fine for debugging, bad for prod key-targeting.
    - Fix: redact wallet IDs/secrets, structured logs with levels, restrict `privyWalletId` visibility to need-to-know roles.

## Recommended remediation order

1. Remove fake-confirm fallback; enforce confirmation thresholds before credit (#1, #2).
2. Rotate secrets; gitignore env; remove admin dev bypass (#6, #7).
3. Fix `gasPaymentMode` persistence (`undefined`) and single shared resolution used by all `sendCrypto` call sites; make treasury-pays real or remove it (#5 + your reported bug).
4. Pre-sweep balance check + simulation + actual-amount accounting (#3); un-swept spend caps (#4).
5. Transactional credit path; integer money; single sweep owner; persisted cursors (#8, #9, #10, #11).
6. Startup config validation + RPC failover + log redaction (#12, #13).

## Quick verification checklist

- `rg -n "confirmed: true" packages/chains/src` → must be zero in verification paths.
- `rg -n "ev\.confirmed|\.confirmed" apps/api/src/services/depositService.ts apps/worker/src/processors/chainDepositProcessor.ts` → every credit gated on threshold.
- `git log --all --oneline -- .env | head` → if any output, assume compromise and rotate.
- Sweep config round-trip: set mode without `gasPaymentMode`, re-read — value must be preserved, never `undefined`.
