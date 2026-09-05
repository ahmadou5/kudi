# Software Requirements Specification

**Project:** Kudi
**Version:** 0.1 (Draft)
**Date:** September 2026
**Author:** Ahmadou

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for Kudi — a wallet that lets a user deposit crypto (USDC) and spend it directly as Naira to any Nigerian bank account, with spendable balance capped by their crypto holdings at the live exchange rate.

### 1.2 Scope
**In scope (v1):**
- Crypto deposit — USDC on Solana, and AUSD (or other tokens) on Monad and other configurable EVM chains
- Self-custodied deposit wallet generation for Solana and EVM chains (see §1.6 Custody Model) — no dependency on Busha/Quidax for address issuance
- Embedded wallet creation/login via Privy for both chains
- Internal ledger tracking balance in USDC-equivalent (float model, not pre-converted), unified across chains
- Live rate engine (crypto → NGN)
- Multi-provider NGN payout — Paystack, Monnify, and Squad, with the active provider switchable from the admin dashboard
- Admin-configurable EVM chain support — new chains added via config (RPC URL, token contract, enable/disable), not new code
- KYC/onboarding
- Admin console for ops, compliance, provider management, and reconciliation

**Out of scope (v1) — candidates for v2+:**
- Bill payments (airtime, electricity, etc.)
- Virtual USD/NGN cards
- Non-Nigerian banks / cross-border payout beyond the Agora/AUSD path
- Production-grade custody infrastructure (see §1.6 — v1 custody is hackathon/demo scope)

### 1.6 Build Tracks: Hackathon vs. Production
Kudi is being built in two explicit tracks rather than one fixed design. This section governs how every custody-related requirement below should be read.

**Track A — Hackathon/Demo (current, targets Monad Metropolis):**
- Deposit wallets (Solana + EVM) are self-custodied — generated and held by Kudi via Privy server wallets or an internal KMS, with no VASP partner in the loop
- Purpose: work standalone without waiting on a partner integration, and qualify for the Privy and Cross-Border Payments bounties
- Suitable for: testnet, demo funds, judged evaluation — **not** suitable for real user deposits at any volume, because it puts Kudi in the custodian/VASP bracket without the licensing to match (see below)

**Track B — Production (post-MVP, before real money):**
- Custody reverts to a licensed VASP partner (Busha/Quidax) issuing and holding deposit addresses — the original v0.1 design — **or** Kudi pursues full VASP licensing to legally continue self-custody at the heavier tier
- Purpose: the actual compliant path once the product moves past demo/hackathon use
- Which of the two production options (partner-issued vs. fully licensed self-custody) is chosen is a business/legal decision, not an engineering one — see Open Questions §6

**The architectural point:** custody should be built as a swappable component from the start — a `CustodyProvider` interface with two implementations, `SelfCustodyProvider` (Track A, Privy/KMS-based) and `PartnerCustodyProvider` (Track B, Busha/Quidax-based) — the same pattern already used for payment providers (§3.5). This means switching from Track A to Track B later is a configuration and licensing decision, not a rewrite of the deposit/ledger logic. FR-2.1 below reflects this.

Whichever provider is active, private keys or partner API credentials must sit behind a secrets manager/KMS with the same rigor as any other credential in §3.9 (Security). Under Track A specifically, a key compromise means direct loss of user funds rather than just API credential exposure — treat that as the highest-priority security item in the system while Track A is active.

**Licensing tiers at a glance:**
| Track | Custody model | SEC tier |
|---|---|---|
| A — Hackathon/Demo | Self-custody (Privy/KMS) | Not currently licensed for real funds — demo/testnet only |
| B1 — Production (partner) | VASP partner issues/holds addresses | AVASP (~₦300M) |
| B2 — Production (licensed self-custody) | Kudi holds keys, fully licensed | Full VASP/exchange (~₦2B) |

### 1.5 Hackathon Context
This v1 scope is written to target the **Monad Metropolis** hackathon. Kudi is being submitted for:
- **Consumer Products & Payments** track
- **Best Cross-Border Payments App on Monad** (Agora Payments Bounty)
- **Privy Bounty**
- A fourth bounty referenced by the team as "Best Mera-Powered UX on Monad" — name unconfirmed against the official tracks page as of this draft; verify exact title before final submission

This is why the system, as of this version, is deliberately multi-chain (Solana + Monad, extensible to other EVM chains) rather than Solana-only, and why Track A uses self-custodied wallets (§1.6) rather than a VASP partner: the Monad-side deposit path, Privy-based wallet auth, and the Agora/AUSD cross-border leg all exist specifically to qualify for the bounties above and to work standalone during the hackathon window.

### 1.3 Definitions & Acronyms
| Term | Meaning |
|---|---|
| VASP | Virtual Asset Service Provider — SEC-licensed entity permitted to custody/convert crypto |
| AVASP | Ancillary VASP — lighter SEC license tier for services that don't custody funds directly |
| KYC / AML | Know Your Customer / Anti-Money Laundering |
| NGN | Nigerian Naira |
| USDC | USD Coin (stablecoin, used on Solana in this system) |
| P2P rate | Peer-to-peer exchange rate (e.g., Binance/Bybit P2P), used instead of official CBN rate |
| Ledger | Internal, append-only record of every balance-affecting event |
| Monad | EVM-compatible high-throughput L1; second deposit chain added for hackathon scope |
| AUSD | Agora's stablecoin, used on Monad in this system |
| Agora | Cross-border stablecoin infrastructure partner; basis for the Cross-Border Payments bounty |
| Privy | Embedded wallet + login provider used across both Solana and Monad; also used for server-side wallet custody in this version |
| Monnify | NGN payment provider (payout rail alternative to Paystack) |
| Squad | NGN payment provider (payout rail alternative to Paystack) |
| EVM | Ethereum Virtual Machine — the chain family Monad and most other configurable chains belong to |
| Self-custody | Kudi generating/holding deposit wallet keys directly, rather than a VASP partner doing so |

### 1.4 References
- Nigeria Investments and Securities Act (ISA) 2025
- SEC Nigeria VASP/AVASP minimum capital circular (January 2026)
- Busha / Quidax API documentation (partner TBD — see Section 6 open questions)
- Paystack Transfers API documentation
- Smile Identity KYC documentation
- Monad Metropolis hackathon tracks/bounties page (hackathon.monad.xyz/tracks)
- Privy documentation (embedded wallets, Solana + Monad support)
- Agora / AUSD documentation (cross-border stablecoin path)

---

## 2. Overall Description

### 2.1 Product Perspective
Kudi is **not a custodian**. It's a UX, ledger, and payout layer that sits on top of an already-SEC-licensed VASP partner (Busha or Quidax), who holds the actual crypto and performs custody/conversion on our behalf via their API. This is a deliberate architectural constraint, not just a technical choice — it's what keeps the project in the lighter AVASP capital tier (~₦300M) instead of the exchange/custodian tier (~₦2B). Every downstream requirement below assumes this boundary.

**As of this version, that boundary is deliberately not enforced for the hackathon build.** Deposit wallets for Solana and EVM chains (Monad and others) are now generated and held by Kudi itself rather than issued by Busha/Quidax — see §1.6 Custody Model for the full tradeoff and what needs to be decided before production. The AVASP-tier assumption above still describes the intended production posture; it does not describe v1 as currently scoped.

NGN payout is now provider-agnostic: the system integrates Paystack, Monnify, and Squad, with the active provider selectable (and switchable at runtime) from the admin dashboard rather than hardcoded to one partner. This is separate from the custody question above — it only affects how NGN leaves the system, not how crypto enters it.

### 2.2 Product Functions (high level)
1. User deposits USDC into a personal deposit address
2. Deposit is confirmed on-chain and credited to an internal USDC balance
3. User requests to spend some or all of that balance to any Nigerian bank account
4. System converts at the live P2P-derived rate, capped by available balance, and pays out instantly
5. Admin/ops can monitor users, transactions, KYC, and rate health

### 2.3 User Classes
| User class | Description |
|---|---|
| End User | Deposits crypto, spends to bank, views history |
| Admin / Ops | Monitors transactions, manages users, handles failures |
| Compliance Reviewer | Reviews flagged KYC/transactions, handles reporting |

### 2.4 Operating Environment
- **Mobile (primary):** iOS & Android via Expo/React Native — this is where spend transactions happen
- **Web (secondary):** Next.js — marketing/landing, account overview, may add full spend flow later
- **Admin:** Next.js — internal, desktop-first

### 2.5 Design & Implementation Constraints
- Custody of deposit wallet keys is self-managed by Kudi in v1 (Privy server wallets or equivalent KMS) — not routed through a VASP partner; see §1.6 for the compliance implication
- USDC on Solana and AUSD (or other tokens) on Monad and other admin-configured EVM chains at launch
- NGN payouts to Nigerian banks only at launch, routed through whichever of Paystack/Monnify/Squad is active
- KYC must be completed before any deposit becomes spendable, regardless of chain
- Rate used per transaction must be recorded for audit purposes, regardless of chain

### 2.6 Assumptions & Dependencies
- Privy exposes server-side wallet creation that Kudi can use for both deposit custody and user-facing login, across Solana and EVM chains
- Each configured EVM chain has a reachable RPC endpoint and, where applicable, a known token contract address
- Paystack, Monnify, and Squad all expose comparable transfer + account-resolution APIs, so the payout layer can treat them as interchangeable behind one interface
- Busha/Quidax remain an available production path (see §1.6) but are not a hard dependency for v1
- Smile Identity is used for KYC (already integrated in Percel)
- Solana and each configured EVM chain's network uptime affects on-chain settlement
- Binance/Bybit P2P rate data remains accessible (no official API — see Risk Register in the dev plan)

---

## 3. System Features (Functional Requirements)

Priority key: **Must** = required for MVP · **Should** = important, can trail MVP by a bit · **Could** = later

### 3.1 User Onboarding & KYC
- **FR-1.1 (Must):** User registers with phone number and email
- **FR-1.2 (Must):** User completes KYC (BVN/NIN + selfie liveness) via Smile Identity before any deposit becomes spendable
- **FR-1.3 (Must):** System stores KYC status (pending / verified / rejected) and tier
- **FR-1.4 (Should):** Tiered KYC — partial verification unlocks lower limits, full verification unlocks full limits
- **FR-1.5 (Must):** User sets a transaction PIN; biometric unlock optional

### 3.2 Wallet / Deposit
- **FR-2.1 (Must):** Deposit wallet generation sits behind a `CustodyProvider` interface with two implementations: `SelfCustodyProvider` (Track A — Privy server wallets/KMS, no VASP dependency) and `PartnerCustodyProvider` (Track B — Busha/Quidax-issued addresses). v1 ships with `SelfCustodyProvider` active; switching tracks later is a config change, not a rewrite (see §1.6)
- **FR-2.2 (Must):** System listens for deposit confirmation directly via chain RPC (per-chain listener) and credits the ledger after the required number of confirmations
- **FR-2.3 (Must):** USDC (Solana) and AUSD (Monad) supported at launch; additional EVM chains/tokens addable via admin config without a new deploy
- **FR-2.4 (Should):** Minimum deposit enforced per chain/token to avoid dust/uneconomical transactions
- **FR-2.5 (Could):** Additional non-EVM chains beyond Solana in v2
- **FR-2.6 (Must):** User's wallet (all chains) is created/managed via Privy; the user is never required to hold or import a separate external wallet, in either track
- **FR-2.7 (Must):** Chain support is config-driven — a single generalized EVM Listener worker runs against whichever chains are enabled in the admin dashboard, rather than one hardcoded worker per chain; Solana remains a dedicated listener since it isn't EVM-compatible
- **FR-2.8 (Must):** Admin can add, enable, disable, or edit an EVM chain's config (name, RPC URL, token contract address, chain ID, confirmation threshold) from the dashboard
- **FR-2.9 (Should):** Before Track B launch, document and implement the actual crypto→NGN conversion path for whichever custody provider is active — for Track A this is currently unresolved (see §6)
- **FR-2.10 (Must):** Admin dashboard shows which `CustodyProvider` is currently active (Track A/Self-custody or Track B/Partner) as a visible operational flag, not just a config value buried in code

### 3.3 Balance & Ledger
- **FR-3.1 (Must):** Balance is stored in USDC — never pre-converted to NGN (float model)
- **FR-3.2 (Must):** Every credit/debit is an immutable, append-only ledger entry (timestamp, type, amount, resulting balance)
- **FR-3.3 (Must):** Spendable NGN = `balance_USDC × current_rate`, recalculated at the moment of each spend request
- **FR-3.4 (Must):** Concurrent spend requests cannot double-spend the same balance (row-level locking or optimistic concurrency control)

### 3.4 Live Rate Engine
- **FR-4.1 (Must):** System polls Binance P2P and Bybit P2P USDC/USDT↔NGN rates on a fixed interval
- **FR-4.2 (Must):** System computes a blended, spread-adjusted rate (protects margin against volatility and payout cost)
- **FR-4.3 (Should):** Admin can view current rate feed health and manually override/pause if sources disagree or go stale
- **FR-4.4 (Must):** The exact rate used is recorded against each transaction for audit purposes

### 3.5 Spend to Bank (Payout)
- **FR-5.1 (Must):** User enters recipient bank + account number; system resolves account name via the active payout provider before confirming
- **FR-5.2 (Must):** User enters an amount (NGN or crypto); system shows live conversion and any fee before confirming
- **FR-5.3 (Must):** System verifies spendable balance ≥ requested amount before allowing confirmation
- **FR-5.4 (Must):** On confirm: debit ledger → initiate transfer via the active provider. If the transfer fails, the ledger entry is reversed
- **FR-5.5 (Must):** Payout supports any bank in the active provider's supported bank list
- **FR-5.6 (Should):** Daily/per-transaction limits enforced by KYC tier and AML policy
- **FR-5.7 (Must):** Payout providers (Paystack, Monnify, Squad) sit behind a single internal interface (resolve account name, initiate transfer, check transfer status) so the ledger/payout logic doesn't need to know which provider is active
- **FR-5.8 (Must):** Admin can view and switch the active payout provider from the dashboard without a redeploy
- **FR-5.9 (Should):** Admin can set a provider priority/failover order, so a failed transfer can optionally retry against a different provider rather than just reversing
- **FR-5.10 (Must):** Each provider's credentials are stored separately in the secrets manager; switching providers never exposes one provider's credentials through another's flow

### 3.6 Transaction History
- **FR-6.1 (Must):** User can view full history (deposits, spends, fees, statuses)
- **FR-6.2 (Should):** Per-transaction receipt/export (mirrors the receipt pattern already built in Percel)

### 3.7 Notifications
- **FR-7.1 (Must):** Push/SMS/email on: deposit credited, spend completed, spend failed

### 3.8 Admin Console
- **FR-8.1 (Must):** View all users, KYC status, and balances
- **FR-8.2 (Must):** Search/filter all transactions; flag suspicious activity
- **FR-8.3 (Must):** Manually review/approve KYC edge cases
- **FR-8.4 (Should):** View rate engine history/status and override
- **FR-8.5 (Should):** Reconciliation view — crypto received (across all enabled chains) vs NGN paid out (via the active provider), to catch mismatches early
- **FR-8.6 (Must):** Payment provider management — view Paystack/Monnify/Squad status, switch the active provider, set failover order, update provider credentials
- **FR-8.7 (Must):** Chain management — add/enable/disable an EVM chain (RPC URL, token contract, chain ID, confirmation threshold); view Solana and per-chain listener health
- **FR-8.8 (Should):** Wallet/custody visibility — view aggregate balances held per chain in self-custodied wallets, as a operational safety check (not a substitute for the compliance decision in §1.6)

### 3.9 Security
- **FR-9.1 (Must):** Transaction PIN required for every spend
- **FR-9.2 (Should):** Biometric app unlock (reuse Percel's existing pattern)
- **FR-9.3 (Must):** All partner API keys/secrets, and all self-custodied wallet private keys, held in a secrets manager/KMS, never shipped client-side
- **FR-9.4 (Must):** Spend attempts are rate-limited to prevent abuse
- **FR-9.5 (Must):** Admin actions that change payout provider or chain config are logged (who, when, old value, new value) — these are high-impact operational changes

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Deposit → spendable: within 1–2 minutes of on-chain confirmation. Spend confirm → bank credit: target under 2 minutes, bounded by Paystack/NIBSS processing |
| Security | Encryption in transit and at rest; no crypto private keys touch our infrastructure (partner-held); secrets manager for all API credentials |
| Compliance | No spend before KYC verified; full audit trail on every ledger entry and rate used; transaction limits enforced by tier; data retention per SEC/CBN AML requirements |
| Availability | Backend API and payout path should degrade gracefully if the rate feed or VASP partner API is briefly unavailable (queue and retry rather than fail silently) |
| Scalability | Ledger and worker design should tolerate growth without a rearchitecture (this is why deposits/rates/payouts are separate queued jobs, not inline request handling) |
| Usability | Spend flow should be completable in under 3 taps once KYC is done, matching the simplicity of the apps this is modeled on |

---

## 5. External Interface Requirements

### 5.1 User Interfaces
- **Wallet app (Expo):** balance, deposit address/QR, spend flow, history, PIN/biometric
- **Web app (Next.js):** landing/marketing, account overview, auth entry point
- **Admin app (Next.js):** user/transaction search, KYC review queue, rate monitor, reconciliation

### 5.2 API / External Interfaces
| Interface | Purpose |
|---|---|
| Privy | Embedded wallet creation/login and server-side wallet custody, Solana + EVM |
| Solana RPC | Deposit address monitoring / on-chain confirmation |
| EVM chain RPC(s) | Deposit monitoring for Monad and any admin-enabled EVM chain |
| Agora / AUSD | Cross-chain stablecoin path (Monad leg); NGN conversion route TBC |
| Paystack Transfers API | NGN payout to any Nigerian bank; account name resolution (one of three interchangeable providers) |
| Monnify API | NGN payout to any Nigerian bank; account name resolution (one of three interchangeable providers) |
| Squad API | NGN payout to any Nigerian bank; account name resolution (one of three interchangeable providers) |
| Smile Identity API | BVN/NIN verification, selfie liveness |
| Binance/Bybit P2P data | Rate engine inputs |
| Busha or Quidax API | Optional production-path custody/conversion partner — not used by v1's self-custody flow (see §1.6) |

### 5.3 Reporting Interfaces
- Admin-side CSV/export for reconciliation and compliance reporting

---

## 6. Open Questions (resolve before/during Phase 0)
1. Busha vs Quidax — which partner's API and commercial terms actually fit better?
2. ~~Final legal/product name~~ — resolved: **Kudi**
3. Which KYC tier limits map to which NGN transaction caps?
4. Does the web app get a full spend flow in v1, or account-view-only?
5. Which Track B path does the team actually intend — partner-issued custody (AVASP, ~₦300M) or full VASP licensing to keep self-custody at scale (~₦2B)? This decision shapes how much of Track A's code is throwaway vs. permanent
6. Who performs crypto→NGN conversion for Track A (self-custodied) balances once a real payout is triggered — is there a swap/off-ramp step, and via whom? Separate from wallet generation itself, and currently unresolved
7. Confirm the exact name of the fourth targeted bounty (referred to internally as "Best Mera-Powered UX on Monad") against the official tracks page
8. Provider precedence — if Monnify and Squad are both enabled alongside Paystack, what determines the default active provider, and should failover be automatic or admin-triggered?
9. Which specific EVM chains (beyond Monad) does the team actually intend to enable via the chain-config system, or is that capability purely for hackathon flexibility right now?
10. Target timeline for the Track A → Track B transition — is this "right after the hackathon" or "once real user volume justifies the licensing cost"?