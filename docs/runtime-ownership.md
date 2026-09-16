# Runtime Ownership

Date: 2026-09-16

## Process Roles

`apps/api` owns HTTP request/response traffic, authentication, webhooks, admin/public API routes, and realtime Socket.IO connections. It must not start recurring financial processors or polling loops during server startup.

`apps/worker` owns recurring and background work, including rate polling, chain deposit polling, webhook processing, and crypto withdrawal processing. Deploy exactly one logical worker owner for these jobs unless the processor has explicit database-backed locking and idempotency.

## Rule for Future Changes

When adding a new scheduled job, queue consumer, polling loop, or retry processor, place it in `apps/worker` by default. If a job must run in `apps/api`, document the exception here and include the idempotency or locking mechanism that makes it safe.

## Current Background Jobs

- Rate polling: `apps/worker/src/index.ts`
- Chain deposit polling: `apps/worker/src/index.ts`
- Crypto withdrawal processing: `apps/worker/src/index.ts`

## Liveness

The worker updates `WorkerHeartbeat` with id `kudi-background-worker` every 30 seconds. Deployment monitoring should alert if `lastSeen` is stale for more than the expected polling window.
