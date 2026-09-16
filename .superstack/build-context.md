# Build Context

## Review

security_score: F
quality_score: D
ready_for_mainnet: false
latest_improvements: auth guards, fail-closed PINs, durable Withdrawal table, DB-backed withdrawal worker

Findings summary:

- In-process crypto withdrawal queue can lose or hide on-chain send jobs across API/worker processes.
- Money-moving routes are not visibly bound to authenticated users and accept body-supplied user IDs.
- PIN verification fails open when no PIN hash exists and hashes are not cryptographic.
- Balances are process-memory-first and not protected by database transactions or row locks.
- Deposit crediting and signature idempotency are not atomic.
- Active worker deposit flow does not perform sweeps, and the older sweep path is incomplete for Solana.
- Mock on-chain sends can return fake tx hashes when credentials are missing.

Latest report: FINANCIAL_FLOW_REVIEW.md
