# RevenueCat Product Sync Playbook (iOS + Google Play + Web)

**Date:** 2026-07-20
**Scope:** ListingOS product IDs, entitlements, offerings, and checkout wiring
**Status:** Review-ready

## 1) Mission

Create one stable billing contract across iOS, Google Play, and web checkout so plan-to-entitlement behavior is identical everywhere, and prevent entitlement drift between Native and web purchases.

---

## 2) Source of truth contract (must not diverge)

Use this contract from now on:

- Entitlements: `starter`, `pro`, `studio`
- App plans: `free`, `starter`, `pro`, `studio`
- Package families:
  - `starter` family → entitlement `starter`
  - `pro` family → entitlement `pro`
  - `studio` family → entitlement `studio`

The following files currently define or consume this contract in code:

- `src/shared/contracts.ts`
- `src/config/billing.ts`
- `src/lib/revenuecat.ts`
- `src/config/app.ts`
- `src/screens/dashboard-screen.tsx`
- `src/components/billing-card.tsx`

---

## 3) Problem diagnosis from current snapshot

- App Store Connect rows show `Could not check` in RevenueCat:
  - likely temporary store credential/sync/readiness issue, not necessarily wrong IDs.
- Google Play rows show `Not found` for `:monthly`/`:annual` variants:
  - usually identifier mismatch (RC expects exact Google Play product ID format).
- Web purchases use RevenueCat Billing links:
  - those IDs are separate from native IAP IDs and are correct when used only for web checkout URLs.

Use this rule: **store product IDs and web checkout links are related but not interchangeable**.

---

## 4) What to configure in RevenueCat (execution order)

### Step A — iOS products

1. In App Store Connect, confirm products exist with exactly these IDs:
   - `listingos_starter_monthly`
   - `listingos_starter_annual`
   - `listingos_pro_monthly`
   - `listingos_pro_annual`
   - `listingos_studio_monthly`
   - `listingos_studio_annual`
2. In RevenueCat, open the App Store integration and re-sync products.
3. Map each product to entitlement:
   - Starter products → `starter`
   - Pro products → `pro`
   - Studio products → `studio`
4. Validate that RC offering rows now load and are resolvable.

### Step B — Google Play products (recommended low-risk path)

1. Keep current Play IDs in the store (for now), including colon variants if present.
2. In RevenueCat Play integration, add exact Play IDs as they exist in Google Play (do not rename IDs in this step).
3. Map every play product family to the same entitlements above.
4. Validate sync; if `Not found` remains, verify Play app has published in the target track and package name exactly matches RC app.

### Step C — Web checkout (RevenueCat Billing)

1. Keep web purchase links in environment config:
   - `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS`
2. Keep those links matched by plan key, not by native StoreKit IDs.
3. Ensure web checkout uses the Billing checkout path only and does not call native purchase APIs directly.
4. Validate web payment state with one test account and confirm entitlement status updates in app.

---

## 5) Exact implementation pattern in this repo

### Environment variables

- Store runtime config
  - Production key: `EXPO_PUBLIC_REVENUECAT_PROD_API_KEY`
  - Test key: `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`
- Web checkout links:
  - `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS`

### Offering and package mapping

- Offering expected by app: `default`
- Product families and entitlements enforced by:
  - `src/config/billing.ts` (plan-to-product mapping)
  - `src/lib/revenuecat.ts` (SDK + entitlement reads)
- Do not hardcode web link IDs to native package IDs.

---

## 6) How to read dashboard status

- `Could not check`
  - RC cannot verify against the store yet.
  - Usually transient store connection, credentials, or permission issue.
- `Not found`
  - RC expected product ID does not exist in that store as configured.
  - Most often mismatch in exact product ID format or package environment.
- `1 Entitlement`
  - Expected for one-to-one mapping (starter/pro/studio each to one entitlement).

---

## 7) Acceptance criteria (must pass before merge)

1. RC shows all native products resolving without unresolved errors.
2. Entitlement mapping remains exact-by-family with no cross-over.
3. Offering fetch on app returns expected packages for `starter/pro/studio`.
4. Web checkout links are non-empty and at least one plan can complete checkout end-to-end.
5. Post-checkout entitlement check returns `active` for the correct entitlement.
6. No `store` or `platform`-specific hardcoding bypasses shared `contract.ts`/`contracts` boundary.

---

## 8) Validation runbook (ops-safe)

- iOS and Android:
  - open paywall → attempt one free trial/start purchase simulation → verify entitlement flag in app.
- Web:
  - click paywall card → complete test purchase flow → return to app → verify plan state persists.
- Worker:
  - confirm any entitlement sync/read endpoints return the correct active entitlement state.
- Dashboard:
  - re-check RC status after sync and refresh.

---

## 9) Known caveats and mitigations

- Native and web purchases are distinct backends:
  - keep keys/envs separated by platform/runtime.
- Google Play identifiers commonly include suffix patterns:
  - do not force them to iOS format unless store migration is intentional.
- App Store `Could not check` can hide as deployment delay:
  - re-enter credentials/sync and retry before changing IDs.

---

## 10) Rollback

If entitlement behavior breaks:

1. Remove or disable impacted web checkout link entries in `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS`.
2. In RevenueCat, temporarily detach risky mappings for the impacted family.
3. Verify app defaults to free mode.
4. Re-apply one family at a time and re-test before progressing.

---

## 11) Repo locations to align before cleanup starts

- `src/config/billing.ts`
- `src/config/app.ts`
- `src/lib/revenuecat.ts`
- `src/screens/dashboard-screen.tsx`
- `src/components/billing-card.tsx`
- `eas.json`
- `.env`
- `docs/MONETIZATION.md`
- `docs/README.md`

After you review this, I will start the repo consolidation pass and align docs/code references to this contract in one focused pass.
