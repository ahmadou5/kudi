# Architecture Rules

Date: 2026-09-16

This document captures the monorepo ownership rules that should guide new code. It complements `docs/runtime-ownership.md`, which is the source of truth for process ownership between the API and worker.

## Application Ownership

- `apps/api` owns HTTP request/response traffic, authentication, webhooks, admin/public API routes, and realtime Socket.IO emission.
- `apps/worker` owns recurring work, polling loops, queue consumers, retries, and scheduled financial processors.
- `apps/wallet` owns the Expo mobile wallet experience.
- `apps/admin` owns the operations dashboard and admin-facing API proxy routes.
- `apps/web` owns the public web surface.

## Package Boundaries

- `@kudi/types` is pure serializable domain types only. It must not import runtime clients, environment config, database code, or app code.
- `@kudi/api-contracts` owns shared API route constants, request/response schemas, and SDK/API contract types.
- `@kudi/config` is the only package that should read runtime environment variables directly.
- `@kudi/database` owns Prisma schema/client exports and database generation scripts.
- `@kudi/chains` owns chain listeners, custody providers, address validation, and chain transaction helpers. App runtimes must inject config instead of relying on package-level env reads.
- `@kudi/payment-providers`, `@kudi/kyc`, `@kudi/cards`, and `@kudi/receipts` own provider/domain adapters and should receive secrets or runtime options through constructors or factory functions.
- `@kudi/sdk` owns client-facing API methods and should consume `@kudi/api-contracts` instead of hardcoding endpoint paths.
- `@kudi/ui` is web UI only unless the project intentionally creates a cross-platform design system.

## Dependency Direction

Apps may import packages. Packages must not import apps.

Recommended package dependency direction:

- `types` can be imported by any package or app.
- `api-contracts` may import `types`, but should stay free of app, database, and provider runtime code.
- `config` may import validation libraries, but should not import app code or business services.
- Runtime packages such as `chains`, `payment-providers`, and `kyc` may import `types`, but should not import API controllers or app modules.
- `sdk` may import `api-contracts` and `types`, but should not import server-only packages such as `database`, `chains`, or `payment-providers`.
- Frontend apps should not import Node-only packages such as `@kudi/database`, server-only chain runtime helpers, or payment provider adapters.

## Runtime Configuration

Runtime code should parse env through `@kudi/config` at the application boundary, then pass typed values into packages through constructors or factory functions. Shared packages should not silently read `process.env` in normal source paths.

Public frontend config must only use explicitly public variables, such as Expo or Next public prefixes. Secrets must stay in server runtimes.

## API Contracts

New API routes should add or reuse route constants and schemas in `@kudi/api-contracts` before the SDK consumes them. Controllers may keep compatibility aliases for legacy `/api/*` paths, but canonical paths should live under `/api/v1/*`.

The SDK should use shared route constants and schemas instead of raw endpoint strings. API and SDK changes should be validated together.

## Financial Safety Rules

The ledger is the source of truth for balances. Any money-moving flow must be idempotent under retries, duplicate webhooks, process crashes, and provider delays.

Use explicit idempotency keys:

- Deposit credit: chain + transaction hash + log index or signature.
- Payout: internal reference.
- Crypto withdrawal: withdrawal reference + chain.
- Webhook: provider + provider event ID or reference.

Database constraints should enforce these boundaries wherever possible.
