# Go-Live Plan — BVN Verification + Virtual Accounts (Bachs · Monnify · Squad)

Status of the code: **ready** (5-phase payout/VA work merged, CI pipeline green).
Status of your environment: **only Bachs sandbox has a real key**; BVN check runs simulated in dev only.

Two knobs govern everything (they are independent):

| Knob | Where | Controls |
|---|---|---|
| `IDENTITY_PROVIDER` + its creds | `.env` | How BVN/NIN is verified |
| `ACTIVE_PAYMENT_PROVIDER` | `.env` (default `BACHS`) | Which provider issues the **virtual account** |
| Payout rail (bank transfers) | DB `ProviderConfiguration` (fallback failover order `MONNIFY → SQUAD → BACHS`) | Which provider executes **NGN payouts** |

> One VA provider is active at a time. Switching = change env + restart. A user can hold VAs from multiple providers over time (all persisted).

---

## Step 1 — Baseline (done)

- [x] Lockfile regenerated & committed (`4ebe8a2`) — CI `pnpm install --frozen-lockfile` passes
- [x] `pnpm typecheck` / `build` / `artifacts:check` / `architecture:check` / `smoke:test` all green
- [ ] Push the branch so CI re-runs green on the remote

## Step 2 — Database schema (needs a reachable DB)

`SpendTransaction.providerReference` + indexes are in `schema.prisma` and the runtime DDL, but **no DB was reachable locally** to apply them.

```bash
pnpm db:push      # schema.prisma → DB
pnpm db:sync      # runtime DDL (ensure-runtime-schema.mjs, idempotent)
```

- [ ] Run both against dev DB
- [ ] Add both to the deploy release command (Railway) so prod gets them

## Step 3 — Real BVN verification (pick ONE provider)

Today: `IDENTITY_PROVIDER` unset, NIBSS/Dojah unset, Paystack/Smile keys are placeholders →
dev/staging = fail unless `IDENTITY_SIMULATE=true` (explicit opt-in), **production = hard fail** (`KYC_VERIFICATION_FAILED`).

| Option | Env vars to fill | Notes |
|---|---|---|
| **NIBSS** (recommended for BVN) | `IDENTITY_PROVIDER=NIBSS`, `NIBSS_ORG_CODE`, `NIBSS_API_KEY` | Primary/direct BVN source |
| **Paystack BVN resolve** | `IDENTITY_PROVIDER=PAYSTACK`, real `PAYSTACK_SECRET_KEY` | Kept for BVN only — not a payout rail |
| **Smile Identity** | `IDENTITY_PROVIDER=SMILE`, `SMILE_IDENTITY_PARTNER_ID`, `SMILE_IDENTITY_API_KEY` | |
| **Dojah** | `IDENTITY_PROVIDER=DOJAH`, `DOJAH_API_KEY`, `DOJAH_APP_ID` | |

- [ ] Fill one set of creds
- [ ] Test `POST /api/v1/kyc/verify-id` with a real/test BVN → expect `verified: true` with a real name (message must NOT say "Simulated/Dev Mode")

## Step 4 — Virtual account providers (fill per provider you want)

| Provider | Required env | Current state |
|---|---|---|
| **Bachs** | `BACHS_SECRET_KEY` (+ `BACHS_BASE_URL`, default `https://sandbox-api.bachs.io`) | ✅ key set — works now (sandbox) |
| **Monnify** | `MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY`, `MONNIFY_CONTRACT_CODE` (+ optional `MONNIFY_SOURCE_ACCOUNT`) | ❌ all placeholders |
| **Squad** | `SQUAD_SECRET_KEY` (+ `SQUAD_BASE_URL`) | ❌ placeholder |

- [ ] Keep `ACTIVE_PAYMENT_PROVIDER=BACHS` for first E2E, or set `MONNIFY` / `SQUAD` once their keys are real
- [ ] Provider-side onboarding done (Bachs sandbox account active / Monnify contract live / Squad account approved) — credentials alone don't guarantee VA creation
- [ ] Remember: placeholder values (`*_here`, `your_*`, `changeme`) are treated as **unset** by design

## Step 5 — Payout rail (bank transfers) — separate from VA

Failover order is `MONNIFY → SQUAD → BACHS`; active rail restored from DB `ProviderConfiguration` at boot.

- [ ] Bachs sandbox key already covers first payout test (Bachs-only works today)
- [ ] For failover coverage: fill Monnify + Squad creds (Step 4) — placeholders are skipped/failed over
- [ ] Monnify transfers also need `MONNIFY_CONTRACT_CODE` + source account; Squad needs `SQUAD_BENEFICIARY_ACCOUNT` where applicable
- [ ] Bachs destinations: created on first payout, must reach `approved` / `is_usable` on Bachs' side (sandbox review flow)

## Step 6 — Webhooks (required in production)

Endpoints (already registered):

```
POST /api/v1/webhooks/bachs     ← payouts: payout.created | payout.paid | payout.failed, collection.succeeded
POST /api/v1/webhooks/monnify
POST /api/v1/webhooks/squad
POST /api/v1/webhooks/korapay
POST /api/v1/webhooks/privy
```

- [ ] Set `BACHS_WEBHOOK_SIGNING_SECRET` (per-endpoint secret from Bachs dashboard — NOT the API key). Production **rejects** unsigned Bachs webhooks
- [ ] Register the public HTTPS URL of each provider dashboard → webhook endpoint
- [ ] Same for Monnify (`monnifySecretKey` HMAC) and Squad (`squadSecretKey`)
- [ ] Reconciliation fallback (webhook loss): `PayoutReconcilerService` polls pending spends >10 min every 60 s in the API process — no action needed, just don't run API with zero instances

## Step 7 — Production gates (already enforced — just don't fight them)

- [ ] `NODE_ENV=production`: boot **fails** if `IDENTITY_SIMULATE=true` (zod hard error); simulated identity/VA is impossible
- [ ] Staging/QA: `IDENTITY_SIMULATE` unset or `false` — simulated KYC is explicit opt-in only, never implied by non-production
- [ ] All placeholder creds must be replaced (or the corresponding provider is treated as not configured)
- [ ] Prod-required vars present (`JWT_SECRET`, `ADMIN_API_KEY`, Privy set, treasury addresses, RPCs…) — pila fails closed at boot, error names the missing var
- [ ] Node 20 in CI/prod (engines field); `REDIS_URL` set for the worker

## Step 8 — E2E sandbox verification script

Run with dev DB + `.env` from Steps 1–4.

1. [ ] `pnpm install && pnpm db:push && pnpm db:sync && pnpm dev:api`
2. [ ] **KYC + VA (Bachs):** `POST /api/v1/kyc/verify-id` `{ idType: "BVN", idNumber, firstName, lastName, dob, email, phone }` → 200 `{ verified: true, virtualAccount: { accountNumber…, provider: "BACHS" } }`
3. [ ] **Persistence:** `GET /api/v1/users/:userId/virtual-accounts` returns the VA; row exists in `VirtualAccount` table
4. [ ] **Retry endpoint:** delete the row, then `POST /api/v1/users/:userId/virtual-accounts` (auth token of same user) → 200 with a new VA; wrong user → 403; KYC not verified → 409
5. [ ] **Wallet:** KYC'd user opens Home → NGN card shows "Generate Account" → tap → spinner → account appears (no more dead-end to `/settings/limits`)
6. [ ] **Bank resolve:** `POST /api/v1/payout/resolve-account` `{ accountNumber, bankCode }` → real name from Bachs
7. [ ] **Payout:** `POST /api/v1/payout/spend` → SpendTransaction `PENDING` with `payoutProvider: "bachs"` + `providerReference` set (use `SELECT "providerReference" FROM "SpendTransaction"` — the Phase 4 fix)
8. [ ] **Webhook settle:** forward Bachs sandbox events — `bachs listen --forward-to http://localhost:4000/api/v1/webhooks/bachs` (or signed curl) → `payout.paid` flips row to `SUCCESS`; `payout.failed` → `REVERSED` + balance credited back + notification
9. [ ] **Reconciler:** stop forwarding, force a pending payout >10 min (or temporarily lower `POLL_AGE_MS`) → within ~1 min of tick the row settles via polling
10. [ ] **Signature rejection:** curl an unsigned/forged payload to `/api/v1/webhooks/bachs` → 401/ignored, log shows verification failure
11. [ ] **Provider switch (optional):** set `ACTIVE_PAYMENT_PROVIDER=MONNIFY` with real keys, restart, retry endpoint → new Monnify VA; old Bachs VA still listed
12. [ ] Full payout reversed path verified → rerun `pnpm typecheck && pnpm --filter ./packages/* build && node --test apps/api/tests/*.test.mjs`

## Step 9 — Deploy checklist

- [ ] Push branch → CI green (install → artifacts → architecture → smoke → typecheck → build)
- [ ] Prod env vars set (Steps 3–6), **no placeholders**
- [ ] Release command includes `pnpm db:push && pnpm db:sync`
- [ ] Public API URL reachable; all webhook URLs registered and showing 200s in provider dashboards
- [ ] Post-deploy smoke: health `GET /api/v1/health`, one KYC verify, one VA get, one sandbox-amount payout

## Known deviations / notes

- **No `PayoutDestination` table** (plan deviation): Bachs destinations use a provider-internal cache + `GET /v1/payouts/destinations` — no migration needed.
- **Paystack** remains BVN-verification-only; removed as a payout rail (`PaymentProviderId.PAYSTACK` enum value kept for legacy receipts).
- `sweep-treasury` test updated: `edc0932` removed the strict `GAS_PAYMENT_MODE` throw; the test now asserts stored → env → `PRIVY_SPONSOR` default.
- Root `pnpm.overrides` pins `@types/react` to `^18.2.79` for the whole repo (wallet included) — do not re-bump it per-app without regenerating the lockfile in the same commit.
