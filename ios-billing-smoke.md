# iOS Billing Smoke Runbook (Production Mode)

Date: 2026-07-20
Branch: `main` (historical runbook snapshot)
Build/profile target: EAS `production` iOS, `EXPO_PUBLIC_REVENUECAT_MODE=production`

## Scope
- Validate and harden iOS purchase + restore behavior on a **real device**.
- Keep backend/web and Android paths unchanged.
- Keep key resolution bound to:
  - `EXPO_PUBLIC_REVENUECAT_MODE`
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` (must be `appl_...`)
  - `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` (default `default` unless dashboard QA offering is approved)
- Confirm `customerInfo.entitlements` is reflected in `revenueCatState` and UI after purchase and restore.

## Code hardening completed in this branch
- `src/lib/revenuecat.ts`
  - iOS/Android/key-source diagnostics now include masked key + source + expected prefix + offeringId in startup logs.
  - Offerings log now includes available offering IDs and selected offering package count.
  - Restore now logs start/success/failure and returns explicit error on failure.
- `src/screens/dashboard-screen.tsx`
  - Restore flow now updates local `revenueCatState` immediately after restore and uses refreshed billing sync response for toast messaging.

## Current artifact (from last run)
- Build ID: `7907efeb-b4d7-40d4-98be-165f90e9bff1`
- Status: `finished`
- Logs URL: `https://expo.dev/accounts/jongan69/projects/listingos/builds/7907efeb-b4d7-40d4-98be-165f90e9bff1`
- Application Archive URL: `https://expo.dev/artifacts/eas/SkQu8aMQGW0_APT07JLjgKN-Sp6fe-Jvx5uWg8SjgeA.ipa`

## Local required checks run on this branch
```bash
cd /Users/jonathangan/Documents/ListingOS-AI
npm run check
npm run export:android
npm run typecheck
npm run check:docs
npx expo-doctor
```

Observed outputs:
- `npm run check` failed only due pre-existing lint warning in `worker/index.ts`:
  - `/worker/index.ts:110:38 Array type using 'Array<unknown>' is forbidden. Use 'unknown[]' instead`.
- `npm run export:android` completed successfully.
- `npm run typecheck` completed successfully.
- `npm run check:docs` completed successfully.
- `npx expo-doctor` completed successfully (`20/20 checks passed`).

## iOS-specific smoke procedure (must be run on-device)
1. Install IPA from build ID above.
2. Start a dedicated console capture:
   ```bash
   log stream --style syslog --predicate 'eventMessage CONTAINS "RevenueCat" OR subsystem CONTAINS "com.apple.StoreKit"'
   ```
3. Confirm login state and Sandbox account:
   - Settings > App Store > Sandbox Account (signed in as sandbox buyer).
   - Keep a separate primary Apple ID in normal App Store for sanity.
4. Open dashboard and verify session sign-in.
5. Capture startup proof lines:
   - `[RevenueCat:ios] mode=production ... keySource=EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ... offering=default`
   - configure should show key source + masked key and not report missing/invalid key.
6. Open paywall and capture offerings line:
   - `[RevenueCat] customerInfo entitlements offerings=... offering=default count=<n> activeEntitlements=...`
7. Perform purchase:
   - Tap package, complete Sandbox Apple ID StoreKit sheet.
   - Verify return to app does not dismiss as not presented/cancel path.
   - Verify logs include `[RevenueCat] purchase.start` and `[RevenueCat] purchase.success`.
   - Verify unlocked plan appears in UI immediately from `setRevenueCatState` + local `Billing` badge/state.
8. Trigger Restore:
   - Hit restore action from Billing screen.
   - Verify logs include `[RevenueCat] restorePurchases.start` and `[RevenueCat] restorePurchases.success`.
   - Verify dashboard toast indicates active plan (not “No active paid plan”).
9. App restart retention:
   - Kill + reopen app and confirm `customerInfo entitlements` log shows same active entitlement (`pro`/`studio`) without repurchasing.
10. Capture webhook trace correlation:
    - Use appUserId logged during `configure.start`.
    - ```bash
      curl -sS -H "Authorization: Bearer $INTERNAL_ANALYTICS_TOKEN" \
        'https://seller-ai-platform.jonathang132298.workers.dev/api/internal/revenuecat/webhook-traces?appUserId=<APP_USER_ID>&limit=50'
      ```
    - Confirm trace rows include matching `appUserId`, `eventType` transition events (`subscription_activated`, `purchase_renewed`, etc.) and `sellerAccountId`.

## Timestamped evidence checklist
Fill these after the real-device pass:
- `ios-billing-smoke-<YYYYMMDD_HHMM>.log` (capture stream)
- `ios-purchase-<timestamp>.mp4` (screen recording)
- `ios-purchase-<timestamp>.png` (UI unlocked state)
- `ios-restore-<timestamp>.png`
- `ios-webhook-trace-<timestamp>.json`

Add lines in this file after execution:
- `launch_started_at`
- `rc_config_mode`
- `package_selection`
- `purchase_result`
- `restore_result`
- `post_restart_entitlement_state`
- `webhook_trace_rows_seen`

## Minimal-risk iOS edge notes
- Store account/session
  - Mixed App Store and Sandbox sessions can produce confusing no-op restores; keep dedicated Sandbox Apple ID for every test run.
- Receipt/Auth timing
  - Restore can be delayed until the StoreKit transaction queue has settled after app return; allow 2–5 seconds before asserting no entitlement.
- App environment
  - `EXPO_PUBLIC_REVENUECAT_MODE` must stay `production` with valid `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...`; test keys must not be used in production path.
- User identity mapping
  - Correlate backend traces using `appUserId` from `customerInfo` (`seller:<sellerAccountId>` pattern on configure) and `seller_account_id` in Worker traces.
- StoreKit auth state
  - If purchase opens repeatedly without confirmation, re-check Apple payment method on sandbox account and Apple Family/Ask-To-Buy settings.

## Rollback steps
1. Revert the iOS production key profile change in `eas.json` and restore the last known-good iOS key value in EAS production environment.
2. Rebuild with:
   ```bash
   npx eas build --platform ios --profile production
   ```
3. Reinstall and rerun only `EXPO_PUBLIC_REVENUECAT_MODE=test` local verification if production path remains blocked.

## Migration/contract note (required)
- Keep key selection tied to mode:
  - `EXPO_PUBLIC_REVENUECAT_MODE=production` -> use `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` on iOS
  - `...=test` -> use `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`
- Maintain platform separation to prevent key family crossover.
