# ADR 0004: Centralized Runtime Config

Date: 2026-09-16

## Status

Accepted

## Context

Environment variables were read across apps and packages, with some production-sensitive defaults. Scattered environment access makes deployments fragile and can allow missing secrets to pass startup.

## Decision

Runtime configuration is parsed through `@kudi/config` using typed schemas for API, worker, admin, and wallet-public environments. Shared packages receive config through constructors or factory inputs rather than reading `process.env` internally.

## Consequences

Missing or unsafe production configuration fails early. Runtime-specific values are easier to audit, and frontend bundles are protected from importing server-only configuration.
