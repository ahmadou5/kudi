# Kudi — Project Development Plan

**Version:** 0.1 (Draft) · **Date:** September 2026

---

## 1. Overview & Goal

Ship an MVP where a user can deposit USDC (or AUSD on Monad), watch it land as a spendable balance, and send Naira to any Nigerian bank. The plan below is built around **two explicit tracks**, not one fixed design:

- **Track A — Hackathon/Demo (Phases 0–2 below):** self-custodied deposit wallets, built fast, no VASP partner dependency. Targets the Monad Metropolis hackathon.
- **Track B — Production (Phase 3 below):** the compliant path for real user funds — either a licensed VASP partner takes over custody, or Kudi itself becomes fully licensed. This is the track you use after MVP, per your plan to move to production-grade once the hackathon build proves out.

The key architectural decision that makes this workable is building custody and payments as swappable components from day one (see §3 Tech Stack and SRS §1.6) — so Track A → Track B is a configuration and licensing change, not a rewrite.

This version targets the **Monad Metropolis** hackathon (Consumer Products & Payments track), plus three bounties: **Best Cross-Border Payments App on Monad** (Agora Payments Bounty), the **Privy Bounty**, and a fourth referenced as "Best Mera-Powered UX on Monad" — that last name needs verifying against the official tracks page before submission. That's why Solana and Monad are both first-class deposit chains here, and why Privy (wallet/auth) and Agora/AUSD (cross-border leg) show up throughout the plan below, rather than this being a Solana-only build.

---

## 2. Scope Phasing

### Phase 0 — Foundation (Track A, no user-facing code yet)
- Build the `CustodyProvider` interface with `SelfCustodyProvider` (Track A) as the only implementation for now — but design the interface so `PartnerCustodyProvider` (Track B) can be dropped in later without touching ledger/deposit logic
- Decide the custody approach for hackathon scope: Privy server wallets vs. an internal KMS for Solana + EVM deposit wallet generation — read SRS §1.6 before committing, since this is the compliance tradeoff, not just a technical one
- Confirm AVASP positioning (or the Track B alternative) with a lawyer/compliance consultant — not urgent for the hackathon demo itself, but needed before Phase 3 starts
- Confirm the crypto→NGN conversion path for self-custodied balances (VASP partner, Agora directly, DEX + off-ramp, or another route) — needed before the cross-border bounty claim is credible
- Repo scaffold (Turborepo, shared packages including `chains/` and `payment-providers/`, CI skeleton)
- Rate engine spike: pull Binance + Bybit P2P data for a week, log spread/volatility to size your rate buffer realistically
- Privy integration spike: confirm server-side wallet creation/custody works cleanly across Solana and EVM, and that embedded login covers both
- Payment provider spike: get Paystack, Monnify, and Squad sandbox credentials; confirm all three expose comparable transfer + account-resolution calls so one interface can wrap them

### Phase 1 — MVP (Track A, hackathon submission scope)
- Wallet app only (web/admin can trail — mobile is where spend happens)
- Self-custodied deposit wallets live for Solana and at least Monad (EVM), generated via Privy
- Chain config system working: Monad enabled by default, architecture proven to support adding another EVM chain via admin config alone
- Multi-provider payout live: Paystack as default, Monnify and Squad integrated behind the same interface, switchable from admin (even if the switch UI itself lands in Phase 2's admin console)
- Unified ledger (float model), rate engine, spend-to-bank via the active provider
- KYC via Smile Identity, PIN + biometric
- Minimal admin: user list, transaction list, manual KYC review, and a basic provider-switch control — enough to operate safely, not the full console yet

### Phase 2 — Web + Admin + Hardening (Track A)
- Next.js web app (account view, auth entry, marketing)
- Full admin console (reconciliation view, rate override, flagging, payment provider management UI, EVM chain config UI)
- Provider failover ordering and per-provider health/status display
- Notifications, receipts/export
- Daily/tier-based transaction limits enforced properly
- **This is the hackathon submission target.** Everything after this point is post-MVP, production-track work.

### Phase 3 — Production Migration (Track B — after MVP, before real money)
This is the track you use once the hackathon build proves out and you're ready to move past demo scope. It's a distinct phase, not an afterthought, because it involves legal/licensing work as much as engineering:

- **Decide the Track B path:** partner-issued custody (revert to Busha/Quidax, AVASP ~₦300M tier) vs. full VASP licensing to keep self-custody at scale (~₦2B tier) — see SRS §1.6 licensing table. This is a business/legal decision, not something to default into
- **Legal/compliance sign-off** on the chosen path before any real user deposit is accepted
- **Implement `PartnerCustodyProvider`** (if partner path chosen) behind the same `CustodyProvider` interface built in Phase 0 — deposit/ledger logic shouldn't need to change
- **Migration plan for any funds already sitting in Track A self-custodied wallets** — either sunset self-custody for new users only while existing demo balances stay as-is, or actively migrate balances to partner-issued addresses; decide before Track A sees any real (non-demo) deposit
- Security audit of whichever custody path is chosen, given real funds are now at stake
- Additional stablecoins and/or additional EVM chains via the config system (no new listener code expected)
- Bill payments, virtual cards (Spenda-style) — only once core flow is proven and compliant
- Additional payout providers beyond Paystack/Monnify/Squad if you outgrow their limits at volume

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | Turborepo | Same as Percel — one build/lint/CI setup across all apps |
| Mobile (wallet) | Expo / React Native | Same as Percel — reuse patterns (PIN, biometrics, theme system) directly |
| Web + Admin | Next.js | New for this project; both apps share the same framework and component patterns |
| Backend API | Fastify + Node.js + TypeScript | Same as Percel |
| Background jobs | Redis + BullMQ | Same as Percel — deposit listener, rate polling, and payout processing all run as queued jobs, not inline requests |
| Database | PostgreSQL via Supabase/Prisma | Same as Percel |
| Realtime | Socket.io | Balance/transaction status updates pushed live, same as Percel's pattern |
| Deposit wallet custody | Privy server wallets (or equivalent KMS) | Self-custodied — generates/holds wallet keys directly, no VASP dependency for hackathon scope. **Compliance note:** shifts custody in-house; see SRS §1.6 before production |
| Cross-chain wallet/auth | Privy | Embedded wallets + login across Solana and EVM chains — targets the Privy bounty |
| Cross-border stablecoin path | Agora / AUSD | Monad-side deposit and cross-chain leg — targets the Cross-Border Payments bounty; NGN conversion route still TBC |
| NGN payout | Paystack, Monnify, Squad (multi-provider) | Interchangeable behind one internal interface; active provider switchable from the admin dashboard, no redeploy needed |
| KYC | Smile Identity | Already integrated in Percel |
| Chain support | Solana (dedicated) + admin-configurable EVM chains | Solana Listener is dedicated (non-EVM); one generalized EVM Listener runs against whichever chains are enabled via admin config (RPC URL, token contract, chain ID) |
| Rate sources | Binance P2P + Bybit P2P (polled) | No official CBN/USDC-NGN feed exists — P2P is what actually reflects moveable liquidity |
| Production-path custody (optional) | Busha or Quidax API | Available fallback if the team reverts to a VASP-issued-address model post-hackathon — not used by v1's default flow |

---

## 4. Monorepo / Project Structure

Same shape as Percel's Turborepo setup, extended with the two new web surfaces:

```
kudi/
├── apps/
│   ├── wallet/          # Expo — mobile wallet (iOS/Android), primary spend surface
│   ├── web/             # Next.js — marketing site + account overview
│   ├── admin/           # Next.js — internal ops/compliance console
│   ├── api/              # Fastify/Node/TS — REST API, auth, ledger logic
│   └── worker/            # BullMQ processors: Solana listener, generalized EVM listener (config-driven), rate engine, payout router (multi-provider)
├── packages/
│   ├── database/          # Prisma schema + client (shared by api + worker)
│   ├── types/               # Shared TypeScript types (ledger, transaction, user, chain config, payment provider config)
│   ├── chains/                # Per-chain adapters (Solana, generic EVM) — RPC clients, confirmation logic, address/key handling via Privy
│   ├── payment-providers/       # Paystack/Monnify/Squad adapters behind one shared interface (resolve account, transfer, status)
│   ├── sdk/                   # Typed client used by web, admin, and wallet to call the API
│   ├── ui/                      # Shared UI primitives where web/admin overlap
│   └── config/                    # Shared eslint/tsconfig/tailwind config
├── .agent/                          # Task prompts, bug tickets, feature specs — same coordination pattern as Percel
├── turbo.json
└── package.json
```

`apps/worker` is its own deployable so the chain listener and payout processor can scale and restart independently from the request-serving API — deposit monitoring and payout retries shouldn't be coupled to API uptime.

---

## 5. Team & Workflow

Solo build, so the workflow is really about staying coordinated across sessions rather than across people:

- Keep using the `.agent/` markdown pattern from Percel — task prompts, bug tickets, and feature specs as files, so context carries between sessions instead of living only in chat history
- One `.agent/` entry per feature in Section 3 of the SRS keeps the FR numbering (FR-2.x, FR-5.x, etc.) traceable straight into actual tickets

---

## 6. Milestones (relative — no fixed calendar dates, since this depends on hours available alongside Percel and your other projects)

| Milestone | Depends on |
|---|---|
| M1 — Custody & payment provider abstractions built (`CustodyProvider`, payment provider interface); Track A implementations wired up | Phase 0 |
| M2 — Repo scaffolded, ledger schema designed | Phase 0 |
| M3 — Deposit → ledger credit working end-to-end (testnet, self-custodied wallets, Solana + Monad) | M1, M2 |
| M4 — Rate engine live with real P2P polling | M2 |
| M5 — Spend-to-bank working end-to-end (sandbox, at least one payment provider) | M3, M4 |
| M6 — KYC gating live, PIN/biometric done | M3 |
| M7 — Internal MVP complete (wallet app only, Track A) | M5, M6 |
| M8 — Web + full admin console, all three payment providers switchable, EVM chain config live — **hackathon submission ready** | M7 |
| M9 — Track B path decided (partner custody vs. full VASP licensing) + legal sign-off | M8 |
| M10 — `PartnerCustodyProvider` implemented and swapped in (if partner path chosen) or licensing secured (if self-custody path chosen) | M9 |
| M11 — Security audit passed, real-money launch approved | M10 |

---

## 7. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Self-custody shifts Kudi into the custodian/VASP bracket (₦2B tier), not AVASP (₦300M) | High — could invalidate the original licensing assumption entirely | Treat self-custody as hackathon/demo scope only (SRS §1.6); get explicit legal sign-off before any real-money deposit is accepted |
| Self-custodied wallet key compromise | Critical — direct loss of user funds, not just data exposure | Keys held only in Privy server wallets or a dedicated KMS, never in app code or plain config; treat this as the highest-priority security item in the whole system |
| VASP partner API is limited or slow to integrate (if reverted to later) | High — blocks production launch | Evaluate both Busha and Quidax hands-on if/when the team reverts to that model |
| P2P rate sources are unofficial and could change/rate-limit access | Medium | Poll conservatively, cache last-known-good rate, alert on staleness |
| Regulatory environment keeps tightening (as it did in Jan 2026) | Medium-High | Design ledger/audit trail to be compliance-friendly from day one, not bolted on later |
| Payout provider failure after ledger debit | High if mishandled | FR-5.4 already requires auto-reversal on failure — treat this as a Phase 1 must, not a nice-to-have |
| FX/liquidity mismatch between crypto received and NGN paid out | Medium | Reconciliation view (FR-8.5) from Phase 1, even if manual at first |
| Crypto→NGN conversion path for self-custodied balances is unconfirmed | High — undercuts the cross-border bounty claim and blocks real payouts if unresolved | Resolve in Phase 0 alongside the custody decision; document the actual route before submission |
| Bounty name/eligibility ("Best Mera-Powered UX") unverified | Low-Medium — could misalign the submission | Confirm exact track/bounty wording on the official Monad hackathon page before final submission |
| Provider precedence/failover logic has a bug that sends a payout through the wrong provider | Medium | Log every provider-switch and every routed transaction with which provider handled it; test failover paths explicitly, not just the happy path |

---

## 8. Testing & QA
- Ledger logic: unit tests around concurrency (double-spend prevention) — this is the one area where a bug directly costs money
- Rate engine: test against stale/conflicting source data, not just the happy path
- Payout: sandbox Paystack testing for both success and failure/reversal paths
- End-to-end: testnet crypto deposit → spendable balance → sandbox payout, run repeatedly before any mainnet/production wiring

## 9. Deployment & Infra
- `apps/api` and `apps/worker` as separate deployables (independent scaling/restarts)
- Managed Postgres (Supabase, consistent with Percel) + managed Redis
- Secrets manager for VASP partner keys, Paystack keys, Smile Identity keys — never in app config committed to the repo