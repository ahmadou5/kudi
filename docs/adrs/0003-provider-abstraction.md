# ADR 0003: Provider Abstraction

Date: 2026-09-16

## Status

Accepted

## Context

Kudi depends on external custody, payout, KYC, card, and chain providers. Direct provider calls inside product flows make failover, testing, and migration difficult.

## Decision

External integrations are accessed through package-level provider interfaces. API and worker code depend on abstractions such as custody managers, payment provider registries, KYC providers, and chain listeners instead of embedding provider-specific request logic directly in controllers.

## Consequences

Provider changes are localized to package adapters. Product flows can select active providers through configuration, admin controls, or failover logic while keeping controller behavior stable.
