# Monorepo Architecture Review

Date: 2026-09-16

## Execution Rule

This document is the source of truth for the architecture improvement work. Any agent or developer who completes, partially completes, blocks, or intentionally skips an item must update the matching checklist item in this file in the same change.

Use these markers:

- `[ ]` Not started
- `[~]` In progress or partially complete
- `[x]` Done
- `[!]` Blocked or needs a decision
- `[-]` Intentionally skipped

When marking an item `[x]`, add a short note with the date and the main file or decision that completed it.

## Executive Summary

This monorepo has a solid starting shape: applications live under `apps/*`, reusable capabilities live under `packages/*`, and shared package dependencies are already expressed through pnpm workspaces. The design is understandable and close to a sensible platform split for a fintech/crypto wallet product.

There are clear doors for improvement. The biggest risks are operational rather than cosmetic: the API and worker both run background financial processors, environment configuration is scattered across apps and packages, and build dependency ordering is duplicated manually even though Turbo can already model it. The wallet app also has two competing source layouts, which increases maintenance cost and makes ownership blurry.

The recommended direction is to tighten service ownership, make package boundaries explicit, centralize configuration validation, and let the monorepo tooling enforce the architecture.

## Current Architecture

### Applications

- `apps/api`: Fastify API server, Socket.IO, HTTP modules, controllers, service layer, webhooks, and realtime gateway work.
- `apps/worker`: background process for rate polling, chain deposit polling, webhook work, and crypto withdrawal processing.
- `apps/wallet`: Expo mobile wallet app.
- `apps/web`: Next.js public web app.
- `apps/admin`: Next.js admin dashboard and API proxy routes.

### Shared Packages

- `packages/types`: shared domain interfaces and enums.
- `packages/database`: Prisma schema/client export.
- `packages/chains`: Solana/EVM custody, deposit, listener, and withdrawal helpers.
- `packages/payment-providers`: payout provider abstraction and concrete providers.
- `packages/sdk`: frontend/admin API client.
- `packages/ui`: React web UI primitives.
- `packages/kyc`: KYC abstraction.
- `packages/cards`: card abstraction.
- `packages/receipts`: receipt generation.

## What Is Working Well

- The repo already uses a recognizable monorepo layout with `apps/*` and `packages/*`.
- Business capabilities are partly extracted into packages instead of being entirely trapped in app code.
- The API has a modular route/controller shape under `apps/api/src/modules`.
- Provider abstractions exist for custody and payout rails, which is the right architectural instinct for this domain.
- Turbo, pnpm workspaces, TypeScript, and tsup are already in place, so the tooling foundation is usable.

## Main Improvement Opportunities

### 1. Single Ownership for Background Jobs

**Finding:** `apps/api/src/server.ts` starts rate polling, deposit polling, and crypto withdrawal processing. `apps/worker/src/index.ts` also starts rate polling, deposit polling, and crypto withdrawal processing.

**Why it matters:** In production, this can cause duplicate processing, inconsistent balances, repeated withdrawals, duplicate notifications, and hard-to-debug race conditions. For a money-moving system, this is the highest-priority architecture issue.

**Recommendation:** Make `apps/worker` the only process that runs polling and queue consumers. Keep `apps/api` responsible for request/response, authentication, webhooks, and realtime emission. If the API needs to trigger work, write a durable job row or enqueue a message; the worker consumes it.

### 2. Centralized Runtime Configuration

**Finding:** Environment variables are read directly across `apps/api`, `apps/worker`, `packages/chains`, `packages/payment-providers`, `packages/kyc`, and frontend code. Several values have production-sensitive fallbacks, including JWT secret fallback and public/default blockchain addresses.

**Why it matters:** Scattered env access makes deployment fragile. It is easy to start a service with missing secrets, accidentally use devnet/testnet defaults, or expose values to the wrong runtime.

**Recommendation:** Add a `packages/config` package using Zod schemas. Export typed config per runtime:

- `apiConfig`
- `workerConfig`
- `walletPublicConfig`
- `adminConfig`

Packages should accept configuration via constructors or factory functions instead of reading `process.env` internally.

### 3. Build Graph Should Be Owned by Turbo, Not Scripts

**Finding:** Apps manually run `build:deps` scripts before building. Turbo already has `dependsOn: ["^build"]`, so this duplicates the dependency graph in every app.

**Why it matters:** Manual dependency scripts drift as packages are added or removed. They also make builds slower and harder to reason about.

**Recommendation:** Remove app-level `build:deps` scripts and rely on workspace dependencies plus Turbo. Add package `exports` fields and consistent build outputs so each package is a clean build unit.

### 4. Wallet App Has Competing Source Layouts

**Finding:** `apps/wallet` has code in both root-level Expo Router folders (`app`, `components`, `lib`, `store`, `constants`) and `src/*`. Some files in `src` re-export or import back into root folders.

**Why it matters:** Two source roots make navigation and ownership harder. It also increases the chance of duplicated components, stale screens, and circular dependencies.

**Recommendation:** Standardize Expo Router around root `app/` for routes and choose one supporting structure. A practical layout:

- `app/` for route files only.
- `src/components/` for reusable components.
- `src/features/` for domain screens/flows.
- `src/lib/` for clients and platform helpers.
- `src/store/` for app state.
- `src/theme/` for palette, spacing, typography.

Then migrate root-level support folders into `src` and update imports.

### 5. Package Boundaries Need Clearer Runtime Separation

**Finding:** Some packages mix pure domain contracts with runtime behavior. For example, `packages/chains` contains listener logic, custody providers, queue helpers, environment access, and test scripts. `packages/types` contains broad domain types, while API-specific response shapes appear to live elsewhere.

**Why it matters:** Packages become harder to reuse safely when they silently depend on Node runtime, env vars, network clients, or blockchain SDKs. Frontend bundles can accidentally pull server-only code.

**Recommendation:** Separate package roles:

- `@kudi/types`: pure serializable domain contracts only.
- `@kudi/config`: typed runtime config.
- `@kudi/chains-core`: chain types, address validation, pure helpers.
- `@kudi/chains-node`: listeners, custody providers, signing/broadcasting, RPC clients.
- `@kudi/api-contracts`: request/response schemas shared by API and SDK.

This can be done incrementally; no need to split everything at once.

### 6. API Contracts Are Not Enforced End-to-End

**Finding:** `packages/sdk` manually constructs endpoint URLs and returns `res.json()` without typed response validation. It also contains duplicated `KudiClientConfig` declarations and endpoint strings can drift from API routes.

**Why it matters:** Client and server can silently diverge. Runtime API errors become UI bugs instead of build-time or test-time failures.

**Recommendation:** Introduce shared API schemas in `@kudi/api-contracts` using Zod. Controllers validate request and response bodies with those schemas. The SDK consumes the same schemas and exposes typed methods.

### 7. Generated Artifacts and Local State Are Present in the Tree

**Finding:** `.next`, `.turbo`, `dist`, `.expo`, and package-level `node_modules` appear throughout the repo tree.

**Why it matters:** If these are tracked or routinely present, they make architecture reviews noisy, slow search, and increase the chance of stale generated code affecting local debugging.

**Recommendation:** Ensure `.gitignore` excludes all generated artifacts across apps and packages:

- `node_modules/`
- `dist/`
- `.next/`
- `.turbo/`
- `.expo/`
- Expo generated route types where appropriate

Then remove tracked generated files if any are currently committed.

### 8. Cross-Cutting Financial Logic Needs Stronger Idempotency Boundaries

**Finding:** The architecture has ledger, deposit, sweep, payout, bills, and crypto withdrawal services, but recurring workers and webhook handlers appear to call business flows directly. The current shape does not make idempotency and transaction boundaries obvious from the package structure.

**Why it matters:** Deposits, withdrawals, and payouts must tolerate retries, duplicate webhooks, process crashes, and provider delays.

**Recommendation:** Treat the ledger as the source of truth and wrap every money-moving operation around explicit idempotency keys:

- Deposit credit idempotency: chain + tx hash + log index.
- Payout idempotency: internal reference.
- Withdrawal idempotency: withdrawal reference + chain.
- Webhook idempotency: provider + provider event ID/reference.

Document these guarantees in code and enforce them at the database constraint level.

## Recommended Target Architecture

```text
apps/
  api/                 HTTP API, auth, webhooks, realtime gateway
  worker/              all polling, queue consumers, scheduled jobs
  wallet/              Expo mobile app
  web/                 public web app
  admin/               admin dashboard

packages/
  api-contracts/       Zod request/response schemas and route contracts
  config/              typed environment parsing per runtime
  database/            Prisma schema, client, migrations
  domain/              pure domain services and business rules
  chains-core/         pure chain helpers and validation
  chains-node/         RPC listeners, custody providers, signing/broadcasting
  payment-providers/   Paystack/Monnify/Squad adapters
  kyc/                 KYC provider adapters
  sdk/                 typed API client generated from contracts
  types/               shared serializable domain types
  ui/                  web-only UI primitives
```

The exact package names can vary. The important move is separating pure/shared code from Node-only infrastructure and making process ownership explicit.

## Phased Improvement Plan

### Phase 1: Reduce Operational Risk

- [x] Move all recurring processors out of `apps/api/src/server.ts`. Done 2026-09-16 in `apps/api/src/server.ts`.
- [~] Keep rate polling, deposit polling, and crypto withdrawal processing only in `apps/worker`. Code ownership updated 2026-09-16; deployment topology still needs confirmation.
- [x] Add database-level idempotency constraints for deposits, payouts, withdrawals, and webhooks. Done 2026-09-16 with `ProcessedSignature`, `ProcessedWebhook`, `SpendTransaction.reference`, `LedgerEntry(type, referenceId)`, and `VirtualAccount(provider, accountNumber)` constraints.
- [x] Add a small health endpoint or heartbeat table for worker liveness. Done 2026-09-16 with `WorkerHeartbeat` and worker updates in `apps/worker/src/index.ts`.
- [x] Remove permissive production fallbacks for secrets such as `JWT_SECRET`. Done 2026-09-16 in `apps/api/src/plugins/jwt.ts`.

### Phase 2: Centralize Config and Contracts

- [x] Create `packages/config` with Zod schemas for API, worker, admin, and wallet public env. Done 2026-09-16 in `packages/config`.
- [x] Replace direct `process.env` reads inside shared packages with constructor-injected config. Done 2026-09-16 by passing API config into custody and payment provider packages; remaining package env reads are limited to `@kudi/config` and standalone test scripts.
- [x] Create `packages/api-contracts` for shared request/response schemas. Done 2026-09-16 with route constants, Zod request schemas, and generic API response parsing.
- [x] Update `packages/sdk` to use typed contracts and consistent error handling. Done 2026-09-16 by consuming `@kudi/api-contracts` route constants/types and validating JSON responses.
- [x] Remove duplicated SDK declarations and centralize endpoint paths. Done 2026-09-16 by removing the duplicate `KudiClientConfig` declaration and routing SDK/API paths through `apiRoutes`.

### Phase 3: Clean Monorepo Tooling

- [x] Remove app-level `build:deps` scripts. Done 2026-09-16 in app `package.json` files.
- [x] Rely on Turbo `dependsOn: ["^build"]` and package dependency declarations. Done 2026-09-16 with app build scripts simplified and existing `turbo.json` build graph retained.
- [x] Add `exports` fields to every package. Done 2026-09-16 in package `package.json` manifests.
- [x] Standardize TypeScript versions across workspaces where possible. Done 2026-09-16 by aligning `apps/wallet` with the repo-wide `typescript@^5.3.3` and validating wallet typecheck.
- [x] Add root scripts for `typecheck`, `test`, and `lint` that run through Turbo. Done 2026-09-16 in root `package.json`.
- [x] Ensure `.gitignore` excludes generated artifacts and no generated artifacts are tracked. Done 2026-09-16 with `.turbo` ignore coverage, `artifacts:check`, and untracked Turbo daemon files.

### Phase 4: Normalize App and Package Boundaries

- [x] Consolidate `apps/wallet` into one source layout. Done 2026-09-16 by moving support folders under `apps/wallet/src` and validating wallet typecheck.
- [x] Move wallet support code into `src/*`, keeping `app/*` route-only. Done 2026-09-16 with `src/components`, `src/constants`, `src/lib`, and `src/store`.
- [x] Split server-only chain runtime code away from pure chain helpers. Done 2026-09-16 with pure `@kudi/chains-core` address helpers and Node-only listeners/providers retained in `@kudi/chains`.
- [x] Keep `@kudi/ui` web-only unless there is a deliberate cross-platform design system. Done 2026-09-16 with `scripts/check-boundaries.mjs` blocking wallet imports from `@kudi/ui`.
- [x] Add dependency-boundary lint rules so frontend apps cannot import Node-only packages. Done 2026-09-16 with `scripts/check-boundaries.mjs` and root `architecture:check`.

### Phase 5: Add Architecture Guardrails

- [x] Add a short `docs/architecture.md` with process ownership and package dependency rules. Done 2026-09-16 with `docs/runtime-ownership.md` and `docs/architecture.md`.
- [x] Add ADRs for major decisions: worker ownership, ledger idempotency, provider abstraction, config strategy. Done 2026-09-16 in `docs/adrs`.
- [x] Add smoke tests for API startup, worker startup, SDK/API contract compatibility, and critical ledger flows. Done 2026-09-16 with `scripts/smoke-architecture.mjs`; full ledger integration tests remain a future hardening task.
- [x] Add CI checks for generated artifacts, type checking, linting, and package build graph correctness. Done 2026-09-16 with `.github/workflows/ci.yml`.

## Suggested First PR

The first improvement PR should be small and risk-focused:

- [x] Remove `rateService.startPolling`, `depositService.startPolling`, and `setInterval(() => processCryptoWithdrawals(...))` from `apps/api/src/server.ts`. Done 2026-09-16.
- [!] Confirm `apps/worker` is deployed as the only background processor. Code ownership is ready; requires deployment/platform confirmation.
- [x] Add a production startup guard that fails if `JWT_SECRET` is missing. Done 2026-09-16 in `apps/api/src/plugins/jwt.ts`.
- [x] Add a short `docs/runtime-ownership.md` explaining that API serves traffic and worker owns recurring jobs. Done 2026-09-16.

This gives the project the largest architecture safety win without forcing a broad refactor.

