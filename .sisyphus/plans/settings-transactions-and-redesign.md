# Settings: Transaction History Screen + Settings Redesign + Animations

## Goal
1. New dedicated **Transaction History** screen under Settings (`/settings/transactions`) with search, filter, and sort — separate from the tab-bar Activities screen.
2. Redesign the remaining old-style settings screens to the "active design" language: **support**, **security**, **limits** (Spending Limit), **notifications** (Push settings), and light polish on **KYC**.
3. Introduce tasteful entrance/stagger/micro animations across all these screens (reanimated 4, already installed and used by FloatingTabBar).

## Design language (source of truth)
- Header: 40×40 back button (`palette.card` + `palette.border`, radius 14) + `Typography.title1`.
- Sections: mono `groupLabel` (fontSize 11, letterSpacing 1.6, uppercase, `hexToRgba(palette.text, 0.45)`) + `groupCard` (`palette.card`, `palette.border`, radius 20, rows with `marginLeft: 66` dividers).
- Rows: 40×40 icon tiles, radius 12, tint `hexToRgba(palette.text, 0.07)`; pressed feedback `hexToRgba(palette.text, 0.05)`.
- Primary CTA: height 52–54, radius 14, `palette.text` bg / `palette.bg` text.
- No hardcoded hex colors (current offenders: `#6366F1`, `#10B981`, `#3B82F6`, `#EF4444` accents, light/dark switch tracks) — use `palette.primary/success/error/text/bg`.
- `AppModal`/`useAppModal` instead of `Alert.alert`.
- Animation principles (page-load-animations skill, adapted to Reanimated):
  - Named `TIMING` constants, storyboard comment per animated screen.
  - Entrance: `FadeInDown.delay(index * TIMING.stagger).duration(280)` — index-based, cap ~8 items.
  - Springs for toggles/pills (`withSpring`, damping ~0.8), 150ms for micro feedback.
  - Respect `useReducedMotion()` — skip entering animations when reduced.
  - Layout changes (filter/sort): `LinearTransition` on list wrapper, never `layout` on both parent+children.

## Work items

### 1. Shared animation helpers — NEW `apps/wallet/src/lib/animations.ts`
- `TIMING` const: `{ fast: 150, base: 280, stagger: 45, maxStagger: 8 }`.
- `useEnterFadeInDown(index)` hook: returns reanimated `FadeInDown` entering animation with `index * stagger` delay (capped), or `undefined` when `useReducedMotion()` is true.

### 2. Shared transaction mapper — NEW `apps/wallet/src/utils/transactionMapper.ts`
- Extract the mapping logic from `app/(tabs)/history.tsx` (lines 34–70): `TransactionItem[] + userId + rateNGN → TransactionData[]`.
- Classify: `direction` (`deposit` | `send` | `payout`), keep title/subtitle/amount/secondaryAmount/status/date/chain/tokenSymbol/metadata.
- Refactor `history.tsx` to use it (no behavior change).

### 3. NEW screen `apps/wallet/app/settings/transactions.tsx`
- Data: `useTransactions(100)` + `useKudiWallet()` (userId, rateNGN) + shared mapper. Pull-to-refresh.
- Header (standard) + subtitle count line ("N transactions").
- **Search**: pill input (Search icon, focus border 1.5 `palette.text`), matches title/subtitle/amount/ref case-insensitively.
- **Filter chips** (horizontal scroll): `All / Deposits / Sends / Payouts` — chip pill: selected = `palette.text` bg + `palette.bg` text; unselected = card + border. Animated selection.
- **Sort**: pill button opens compact bottom sheet (pattern from settings/index logout sheet): Newest first (default) / Oldest first / Amount high→low / Amount low→high, checkmark on active.
- **Results**: reuse `TransactionCard` (free tap-through to `/transaction-details` via its default navigation). Wrap in `LinearTransition`; rows `FadeInDown` staggered on mount and when filter/sort/query changes (keyed re-enter, short duration).
- States: 3 skeleton rows (`AnimatedSkeleton`), "no transactions" empty state, "no matches" empty state with **Clear search & filters** action, error + retry.
- Register in `app/settings/_layout.tsx`.

### 4. Settings hub — EDIT `apps/wallet/app/settings/index.tsx`
- ACTIVITY item href: `/(tabs)/history` → `/settings/transactions`; subtitle "Search, filter & sort".
- Light entrance stagger on identity card + groups via `useEnterFadeInDown`.

### 5. Redesign `app/settings/support.tsx`
- New header (title1 "Support"), groupLabels `CONTACT` / `FAQ`.
- WhatsApp row: keep brand green on icon tile tint only; Email row: palette-based tint (drop `#3B82F6`).
- FAQ accordion → single `groupCard` with rows; animated expand: chevron `withSpring` rotate + answer `FadeIn` with measured height (reanimated, no RN `LayoutAnimation`), one-open-at-a-time.
- Entrance stagger; footer version line uses `AppVersionFooter` component if suitable (check reuse; else keep inline with palette colors).

### 6. Redesign `app/settings/security.tsx`
- New header; groupLabel `AUTHENTICATION` + groupCard with `marginLeft: 66` dividers.
- Square icon tiles (radius 12, `hexToRgba(text, 0.07)`) — remove `isLight` hardcoded badge colors.
- Switch `trackColor`: false → `hexToRgba(palette.text, 0.15)`, true → `palette.success`; thumb white.
- Keep biometric gating logic; disabled rows get reduced opacity + explanatory subtitle.
- Entrance stagger.

### 7. Redesign `app/settings/limits.tsx`
- New header; hero current-tier card (radius 24) using `palette.primary`/`palette.success` (drop `#6366F1`/`#10B981`); ACTIVE pill = success tint.
- Upgrade button → primary CTA style (`palette.text` bg, `palette.bg` text) → `/kyc`.
- Tier breakdown: `groupLabel TIERS` + one groupCard or per-tier cards with "Your tier" success pill; entrance stagger per card.
- Regulatory note → info row with card bg + palette tints.

### 8. Redesign `app/settings/notifications.tsx`
- New header; hero status card (Active/Disabled using `palette.success`/`palette.error` tints + animated dot pulse optional).
- Grouped toggle rows (`PUSH`, `ALERT TYPES`) in groupCards with dividers.
- Replace all `Alert.alert` with `AppModal` (enable-success, blocked-with-Open-Settings action, pause, test-sent).
- Persist `transactionAlerts` + `securityAlerts` in `preferences.store.ts` (new SecureStore-backed keys + setters, hydrated on load) so they survive reloads.
- Test button → primary CTA; entrance stagger.

### 9. Light polish `app/kyc.tsx` (no logic changes)
- Header: `ChevronLeft` → `ArrowLeft`, title1 alignment matching other settings headers (all state views).
- Add entrance `FadeInDown` to verified card sections / step forms (respect reduced motion).
- Leave flows, validation, modals untouched (1026-line file — style-level only).

## Verification
- `npx tsc --noEmit` in `apps/wallet` (clean).
- Grep settings screens for leftover hardcoded hex colors (`#6366F1|#10B981|#3B82F6|#CBD5E1`) in the touched files.
- Routes: `/settings/transactions` registered + hub link works.

## Out of scope
- Backend changes (client-side search/filter/sort over the 100-tx payload the API already returns).
- Tab-bar Activities screen redesign (kept as-is; shares the mapper).
- `set-pin.tsx`, `appearance.tsx` (already current/untouched by request).
