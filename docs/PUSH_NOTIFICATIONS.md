# Push Notifications

ListingOS uses Expo push notifications for background listing updates:

- `needs_review`: draft finished but needs seller input
- `published`: eBay listing is live
- `failed`: eBay publish needs a fix

The mobile app registers an Expo push token through `POST /api/devices/push-token`. The Worker stores active tokens in D1 and sends messages through Expo's push service from queue/publish events.

## Current App Contract

- Android package: `com.jongan69.listingos`
- iOS bundle identifier: `com.jongan69.listingos`
- EAS project ID is configured in `app.json`
- Android notification channel: `publishing`

## Android FCM Setup

Android standalone, preview, and Play Store builds need Firebase Cloud Messaging config.

Current production Firebase setup:

- A dedicated ListingOS Firebase project is linked to `com.jongan69.listingos`
- Android config file: `google-services.json` at the repo root
- EAS production file variable: `GOOGLE_SERVICES_JSON`
- An FCM V1 service account is assigned through EAS credentials

1. Open Firebase Console.
2. Create or select a Firebase project for ListingOS.
3. Add an Android app with package name `com.jongan69.listingos`.
4. Download `google-services.json`.
5. Place it at the repo root as `google-services.json`.
6. Do not commit it. It is ignored by git.
7. Rebuild the native app with EAS or a local native build.

`app.config.js` automatically sets `android.googleServicesFile` when `google-services.json` exists.
On EAS cloud builds, `app.config.js` reads `process.env.GOOGLE_SERVICES_JSON` so the gitignored file can be provided by EAS as a file environment variable.
The `eas-build-post-install` hook runs `scripts/prepare-eas-firebase.js`, which copies that file env into both `google-services.json` and `android/app/google-services.json` before Gradle runs.

For EAS cloud builds, upload/manage Android credentials with:

```sh
npm run eas:credentials:android
```

The current machine already has these local, gitignored credential files:

- `google-services.json`
- `firebase-service-account-listingos-fcm.json`
- `google-play-service-account-listingos.json`

Do not commit any of those files.

## iOS Push Setup

iOS push for TestFlight/App Store builds is handled through Apple Developer credentials and EAS.

Current production Apple/EAS setup:

- Bundle identifier: `com.jongan69.listingos`
- Push Notifications capability: enabled
- APNs and App Store Connect keys are assigned through EAS credentials
- APNs entitlement mode: `development` for local/dev builds, `production` when `EAS_BUILD_PROFILE=production`

1. Confirm the Apple Developer account has accepted the latest Program License Agreement.
2. Confirm the app identifier `com.jongan69.listingos` exists or let EAS create it.
3. Run:

```sh
npm run eas:credentials:ios
```

4. Let EAS manage the APNs key/certificate unless there is a specific existing key to reuse.
5. Build through EAS for TestFlight/App Store.

`app.config.js` sets `ios.entitlements["aps-environment"]` from `EAS_BUILD_PROFILE`, and the native entitlements file uses `$(APS_ENVIRONMENT)` so the Xcode target can build with the correct APNs environment per configuration.

If a `GoogleService-Info.plist` is ever required by a Firebase-backed iOS feature, place it at the repo root. `app.config.js` will include it automatically when present.

## Verification

After installing a credentialed native build:

1. Launch the app and sign in with eBay.
2. Grant notification permission.
3. Confirm the Worker receives `POST /api/devices/push-token`.
4. Confirm a D1 `device_push_tokens` row exists with `status = active`.
5. Queue a listing that reaches review, publish, or failure.
6. Confirm a system notification appears even if the app is backgrounded.

Useful commands:

```sh
npm run worker:tail
npm run db:migrate:remote
```

### Verified Android Test

Latest verified Android standalone test:

- Date: July 17, 2026
- Device: Samsung A16 / `SM-A166U1`
- Package: `com.jongan69.listingos`
- App version: `1.0.0` / versionCode `6` (historical delivery proof)
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- APK SHA-256: `9d5c503d5ea7fb05a5b4eee31b3c3719830896b4d3ddf6b50f329708a6796351`
- Native build proof: Gradle ran `:app:processReleaseGoogleServices`, so `google-services.json` was included.
- Startup proof: app launched without `FATAL EXCEPTION`; `libworklets.so`, `libreanimated.so`, Hermes, and React loaded.
- Permission proof: `android.permission.POST_NOTIFICATIONS` was granted.
- Token proof: D1 `device_push_tokens` has an active Android token for `SM-A166U1`.
- Worker push proof: `POST /api/devices/test-notification` returned `{"ok":true,"tokenCount":1,"sentCount":1,"inactiveCount":0,"expoAccepted":true}`.
- Delivery proof: Android posted `Notification(channel=publishing ...)` for `com.jongan69.listingos`; screenshot captured at `/tmp/listingos-after-push.png`.

The current-source `1.0.1 (10)` build has been installed and launch-tested on the same A16, but a fresh push delivery proof has not been repeated after the store submission. iOS remains unverified because the registered physical iPhone is currently offline from this workstation.

The test endpoint is session protected:

```sh
curl -X POST "$PUBLIC_API_BASE_URL/api/devices/test-notification" \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

## Common Failure Modes

- `Unable to get Firebase Messaging instance`: Android build is missing `google-services.json` / FCM configuration.
- No permission prompt: app already denied notifications; reset app permissions or reinstall.
- Token row exists but no notification: check Worker logs and Expo push response receipts.
- Notification works foreground only: confirm the build is a standalone native build, not Expo Go.
