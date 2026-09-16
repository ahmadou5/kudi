# ADR 0001: Worker Owns Background Jobs

Date: 2026-09-16

## Status

Accepted

## Context

The API and worker previously had overlapping startup paths for polling and recurring financial processors. Duplicate process ownership can double-credit deposits, run withdrawal retries twice, or produce inconsistent operational alerts.

## Decision

`apps/worker` is the only runtime that starts recurring financial jobs: rate polling, chain deposit polling, webhook processing, and crypto withdrawal processing. `apps/api` owns HTTP traffic, authentication, webhooks, admin/public routes, and realtime events.

## Consequences

API deployments can scale independently without multiplying background work. Worker liveness is tracked through `WorkerHeartbeat`, and deployments must ensure exactly one logical worker owner unless a specific processor has its own locking and idempotency model.
