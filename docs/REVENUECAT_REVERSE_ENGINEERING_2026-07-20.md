# RevenueCat Reverse Engineering Report

Generated: 2026-07-20

## One-line verdict

RevenueCat integration is functioning for shipping flows in this app: native iOS/Android uses `react-native-purchases` with server-side verification, and web now uses a dedicated hosted checkout path via RevenueCat Web Purchase Links. The app does not attempt native RevenueCat SDK purchases on web.

## What is actually running today

### 1) Client configuration and key resolution
- `src/config/app.ts` drives all RevenueCat key selection with `EXPO_PUBLIC_REVENUECAT_MODE` and public key env vars.
- `appConfig.revenueCatMode` defaults to `production` unless explicitly set to `test`.
- Local development uses Test Store with `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`.
- Release builds use platform keys when configured and still preserve `EXPO_PUBLIC_REVENUECAT_PROD_API_KEY` as a temporary shared fallback only.
- `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS` is now the dedicated web gate, parsed as an allowlist of hosted checkout URLs.

### 2) Native runtime path
- `src/lib/revenuecat.ts` initializes the SDK only for `Platform.OS === "ios" || Platform.OS === "android"`.
- `configureRevenueCat` then resolves native key selection, validates key shape, imports `react-native-purchases`, and loads `customerInfo` + offerings.
- On native app build with missing/invalid keys, the client emits clear configuration errors and stays in a metered-observation-safe state.
- Native paywall buttons remain bound to package IDs and offer products.

### 3) Web runtime path
- `src/lib/revenuecat.ts` now returns a non-native web state when `Platform.OS === "web"`.
- The web state is `configured: true` only when at least one `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS` value is present and valid.
- On web with valid links, the paywall renders hosted checkout buttons and opens the configured checkout URL with `Linking.openURL`.
- On web without links, the paywall shows a setup notice and disables purchase actions.
- This is intended behavior: no `react-native-purchases` calls are made from web.

### 4) Purchase / restore flows
- Native: `purchaseRevenueCatPackage` / `restoreRevenueCatPurchases` use `react-native-purchases` and sync to Worker on success.
- Web: `PaywallPanel` calls `startWebRevenueCatCheckout(plan, term, url)`; checkout continues in RevenueCat web billing flow; sync must be confirmed from server-side channels.
- A web refresh action is intentionally surfaced to force a re-fetch of `/api/billing/summary` after checkout.

### 5) Billing trust on server
- `/api/billing/sync` uses `resolveClientBillingSync`.
- In `enforce` mode, trusted source requires `revenuecat_rest`, `revenuecat_webhook`, or `manual`.
- If `REVENUECAT_SECRET_API_KEY` is missing and no trusted source exists, sync falls back to `source=fallback`, `subscriptionStatus=free`.
- This means web-hosted checkout purchases still rely on webhook/REST confidence for entitlement elevation, as designed.

## Why web can look "broken" to developers

1. `react-native-purchases` does not run on web in this app; no SDK-style purchase UI exists there.
2. If web checkout links are not set, the app correctly shows a setup notice and disables paid actions.
3. If links are set but entitlement is not yet verified in Worker, `/api/billing/summary` may remain free until verification sync completes.

## Concrete breakpoints to check

- `src/lib/revenuecat.ts` web gate and fallback behavior (`nativeSupported`, `webSupported`, `buildWebRevenueCatState`).
- `src/components/billing-card.tsx` paywall web branch and per-plan term link checks.
- `src/screens/dashboard-screen.tsx` web checkout open/refresh handlers (`startWebRevenueCatCheckout`, `refreshWebBillingStatus`).
- `worker/index.ts` billing enforcement and trusted sources (`isTrustedBillingSource`, `resolveClientBillingSync`).
- `eas.json` and `.env` for `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS` values.

## Current risk status by surface

- **Native mobile purchase path:** depends on valid production platform SDK keys, real store products, and current offering mapping.
- **Web purchase path:** implemented via hosted links; entitlements still require server verification path (webhook or REST) to be active.
- **Server enforcement:** depends on billing secrets/webhook in enforce mode.

## Recommended immediate actions

1. Ensure `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS` has valid hosted URLs in all active profiles (local `.env`, EAS development/preview/production if web flow is needed for demo).
2. Verify Worker has `REVENUECAT_SECRET_API_KEY`/webhook auth so `billing_revenuecat_webhook` + `revenuecat_rest` can elevate entitlements from `fallback`.
3. Keep app-store purchase copies region-accurate (external web checkout must respect product/legal boundaries).
4. After each env/profile change, validate:
   - startup logs show the expected mode/key source on native,
   - web paywall shows enabled hosted checkout buttons,
   - `GET /api/billing/summary` reflects `active` plan after a verified checkout.

