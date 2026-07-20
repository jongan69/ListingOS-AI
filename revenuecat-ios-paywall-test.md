# RevenueCat iOS Paywall Verification Notes

Date: 2026-07-20
Owner: ListingOS iOS Lead Verification

## Scope
- Verify iOS app bundle/capability mapping for production RevenueCat path.
- Validate launch mode and native purchasing prerequisites.
- Run an internal iOS build with production-mode RC config.
- Perform Sandbox Apple ID purchase + restore and prove app/user correlation in Worker webhook traces.

## 1) Config verification

### iOS app identity
- `app.json`: iOS bundle identifier is `com.jongan69.listingos`.
- `app.config.js`: entitlements include `aps-environment` and switch based on `LISTINGOS_APS_ENVIRONMENT`.
- No explicit App Store in-app-purchase entitlement is declared in app config; entitlement/capability is expected to come from App Store Connect + Apple build credentials for the App ID.

### RevenueCat key mode and offerings
- `src/config/app.ts` reads:
  - `EXPO_PUBLIC_REVENUECAT_MODE`
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` (default `default`)
- `src/config/billing.ts` products mapped:
  - `listingos_starter_monthly`
  - `listingos_starter_annual`
  - `listingos_pro_monthly`
  - `listingos_pro_annual`
  - `listingos_studio_monthly`
  - `listingos_studio_annual`
- Entitlements mapped in code: `starter`, `pro`, `studio`.

### EAS CI vars
- Updated `eas.json` production env to include:
  - `EXPO_PUBLIC_REVENUECAT_MODE=production`
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_your_ios_production_public_sdk_key`
  - `EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default`

## 2) Build execution (this run)

### Build command
- Command run:
  - `cd /Users/jonathangan/Documents/ListingOS-AI && npx eas-cli@latest build -p ios --profile production --non-interactive --no-wait`
- Result:
  - Build started: `7907efeb-b4d7-40d4-98be-165f90e9bff1`
  - Logs URL: `https://expo.dev/accounts/jongan69/projects/listingos/builds/7907efeb-b4d7-40d4-98be-165f90e9bff1`
  - Initial status at start: `in queue`
  - Follow-up status: `in progress`
  - Distribution shown by build: `store`

### Internal preview attempt
- Attempted command:
  - `EXPO_PUBLIC_REVENUECAT_MODE=production EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_your_ios_production_public_sdk_key EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default npx eas-cli@latest build -p ios --profile preview --non-interactive --no-wait`
- Failure reason:
  - Non-interactive build could not set up credentials for iOS **internal distribution**.
  - Message: `Failed to set up credentials. You're in non-interactive mode. EAS CLI couldn't find any credentials suitable for internal distribution.`

## 3) Required next steps for purchase proof (not yet executed in this run)

1. Install a native iOS artifact from build `7907efeb-b4d7-40d4-98be-165f90e9bff1`.
2. Sign in with Sandbox Apple ID on test device.
3. Open Billing/Paywall path and trigger purchase flow.
4. Capture logcat-style JS/native logs and confirm:
   - RevenueCat starts in configured mode on iOS.
   - `appUserId` is non-null in catalog load.
5. Execute restore flow.
6. Query webhook traces by appUserId and compare with app logs:
   - `curl -H "Authorization: Bearer <INTERNAL_ANALYTICS_TOKEN>" "https://seller-ai-platform.jonathang132298.workers.dev/api/internal/revenuecat/webhook-traces?appUserId=<appUserId>&limit=50"`
7. Confirm at least one `billing.revenuecat_webhook` trace exists for the same `appUserId` recorded by the app session.

## 4) Status / evidence claims
- ✅ Bundle ID and RC product IDs are present in source config as expected.
- ✅ EAS production profile now includes production RC public key/offering wiring.
- ⚠️ iOS native build has been queued/started but **purchase, restore, and webhook-correlation proof are still pending** because physical device execution has not been completed yet.
