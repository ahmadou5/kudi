# ADR 0002: Ledger Idempotency Boundaries

Date: 2026-09-16

## Status

Accepted

## Context

Deposits, payouts, withdrawals, and provider webhooks can be retried by chains, providers, queues, or operators. Money-moving flows need database-backed duplicate protection rather than relying on process memory.

## Decision

The ledger is the source of truth for balance-affecting events. Every money-moving flow must carry a stable idempotency key and persist duplicate protection at the database layer:

- Deposits: chain plus transaction signature/hash and log index where available.
- Payouts: internal spend reference.
- Withdrawals: withdrawal reference plus chain.
- Webhooks: provider plus provider event ID or reference.

## Consequences

Processors may retry safely after crashes or provider delays. New ledger-affecting features must define their idempotency key before implementation is considered complete.
