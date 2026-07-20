# Android Billing Readiness Smoke Runbook (Production + Test Key Paths)

## Scope
- Verify RevenueCat Android config for production readiness.
- Confirm Android manifest/runtime settings required for billing and launch/background behavior.
- Validate purchase, entitlement unlock, and restore on a real Android device.
- Capture app logs, screenshots/videos, and Worker webhook proof for judge-safe evidence.

## Branch and artifact context
- Branch: `codex/android-billing-production-readiness`
- App package: `com.jongan69.listingos`
- RevenueCat keys in play:
  - Production: `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` (`goog_...`) + `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` (`appl_...`)
  - Test: `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` (`test_...`)
  - Offering: `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` (default `default` unless QA offering is approved)

## 1) Manifest/config proof

### Required checks
```bash
# Confirm launch mode + Billing permission in built manifest
rg -n 'android:launchMode="singleTop"|com\.android\.vending\.BILLING' android/app/src/main/AndroidManifest.xml
```
Expected output (line fragments):
- `android:launchMode="singleTop"` on `MainActivity`
- `com.android.vending.BILLING`

### Source-of-truth files
- `[plugins/with-listingos-billing-manifest.js](/Users/jonathangan/Documents/ListingOS-AI/plugins/with-listingos-billing-manifest.js)`
- `[android/app/src/main/AndroidManifest.xml](/Users/jonathangan/Documents/ListingOS-AI/android/app/src/main/AndroidManifest.xml)`
- `[app.config.js](/Users/jonathangan/Documents/ListingOS-AI/app.config.js)`
- `[eas.json](/Users/jonathangan/Documents/ListingOS-AI/eas.json)`

## 2) EAS profile checks

### Production profile
```bash
cat eas.json | sed -n '40,90p'
```
Expected vars:
- `EXPO_PUBLIC_REVENUECAT_MODE=production`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...`
- `EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default` (or approved QA offering)

### Test profile (sanity)
```bash
cat eas.json | sed -n '1,35p'
```
Expected vars:
- `EXPO_PUBLIC_REVENUECAT_MODE=test`
- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_...`
- `EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default`

## 3) Local build + internal track (requested)

```bash
# production release build
npx eas build --platform android --profile production

# when complete, submit/install from internal track
# keep track of artifact URL, versionCode, and Play package name
```

Use the generated Play-internal artifact and install on test device:
```bash
# if you have device + adb
adb devices
adb install -r <downloaded-debug-apk>  # only if APK is available
```

If only AAB is available, install from Google Play internal track on the test device.

## 4) Device log capture (must be recorded)

Use one dedicated terminal for logcat:
```bash
mkdir -p /tmp/listingos-android-billing
adb logcat -v time | tee /tmp/listingos-android-billing/rc-billing-$(date +%Y%m%d-%H%M%S).log
```

Optional narrower filter:
```bash
adb logcat -v time ReactNativeJS:V Purchases:V BillingClient:V
```

Required evidence lines to capture:
- key source chosen from build config
- offerings load with non-empty packages before purchase
- entitlements active list after purchase / restore
- no immediate cancellation on app return from Google Play flow

From `[src/lib/revenuecat.ts](/Users/jonathangan/Documents/ListingOS-AI/src/lib/revenuecat.ts)` the app logs:
- `[RevenueCat] mode=...`
- `[RevenueCat] customerInfo entitlements ...`

## 5) Purchase + entitlement + restore flow

1. Open app as a valid seller account and verify session loads.
2. Open paywall.
3. Confirm logcat shows:
   - `keySource=EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
   - `prefix=goog_...`
   - `activeEntitlements` is currently `none` before purchase (expected for free path).
4. Select a package (offering/default).
5. Start purchase and complete Google Play auth/consent.
6. On return, verify:
   - no immediate app crash/restart
   - paywall state transitions to unlocked
   - log shows `activeEntitlements=pro` (or package-entitlement map) without app restart
7. Trigger Restore Purchases.
8. Verify entitlement remains unlocked after restore and billing query updates on app side.

## 6) Backend webhook evidence

After successful purchase, confirm event chain:
```bash
curl -sS 'https://seller-ai-platform.jonathang132298.workers.dev/api/internal/revenuecat/webhook-traces?limit=20'
```
Expected fields in at least one event:
- `seller_account_id` set for the right account
- `app_user_id: seller:{sellerAccountId}` in trace payload
- event type includes transition (`subscription_activated`, `purchase_completed`, or equivalent transition event)
- `event_name` under `billing.revenuecat_webhook*`

## 7) Evidence artifacts to save
- RC logcat export: `/tmp/listingos-android-billing/*.log`
- Screenshot/video showing:
  - paywall package list visible
  - post-purchase entitlement state (plan badge / unlocked indicator)
  - restore success confirmation
- Backend webhook trace capture (command output JSON)

## Blocker list and fixes
1. `app.config` / manifest miss `com.android.vending.BILLING`
   - Fix: ensure `./plugins/with-listingos-billing-manifest` is in plugin list and rebuild prebuild/bundle.
2. Android key uses non-`goog_` value in production profile
   - Fix: set EAS production env var `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` to a valid `goog_...` public key.
3. Key format mismatch thrown by app at startup
   - Fix: confirm that production profile is not using `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` and that app mode matches intended profile.
4. Purchase screen has no packages (`packages=[]`)
   - Fix: verify `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` targets an offering that contains mapped packages for app user and Android app in RevenueCat.
5. Restore returns no entitlements
   - Fix: run backend webhook trace + confirm same `appUserId` and entitlement transitions before concluding client bug.
6. Play auth returns instantly after tap (no launch path)
   - Fix: verify `android:launchMode="singleTop"` for `.MainActivity`, confirm no custom intent/foreground activity clearing, retest in release build.

## Rollback
If a hard auth failure appears (for example revoked app-level service account, key rejection, or repeated backend 401 on webhook events):
1. Revert EAS production key env update to last known-good set.
2. Disable production keys in that profile (or use a known-good QA key set) and rebuild.
3. Validate with `EXPO_PUBLIC_REVENUECAT_MODE=test` in dev for non-production smoke only.
4. Only re-enable production Android key after one passing restore/purchase trace.

## Validation command snippets
```bash
git status --short
npm run check
npm run export:android
```

Attach output snippets under this section after execution.
