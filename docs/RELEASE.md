# Release And Demo Packaging

<!-- CURRENT-STATE-AUTHORITY -->
> **Accuracy note, July 21, 2026:** Preview and production profiles use production-mode platform keys; public legal/support routes are live, while the deployed Market feed is currently failing. See [Current Implementation State](./CURRENT_STATE.md) for the authoritative implementation and deployment snapshot.

ListingOS can be demoed as a standalone Android app without Expo Go, Metro, or a USB cable after installation.

## Current production snapshot (as of 2026-07-20)

- App and Worker are still production-operational for core flows.
- Current web deployment smoke status for store-facing routes:
  - `https://seller-ai-platform.jonathang132298.workers.dev/app-support`: `200`
  - `https://seller-ai-platform.jonathang132298.workers.dev/privacy`: `200`
  - `https://listingos.expo.app/app-support`: `404`
  - `https://listingos.expo.app/privacy`: `404`
  - `https://listingos.expo.app/terms`: `404`
- RevenueCat production Android build artifact `a5e3300a-57b5-42d1-8621-d4dd2698a2de` is in progress from the last run.
- iOS production submission remains unfinalized pending store credential/session work.

## Current Demo Build

- App name: `ListingOS`
- Android package: `com.jongan69.listingos`
- Deep-link scheme: `listingos://`
- Backend: `https://seller-ai-platform.jonathang132298.workers.dev`
- Gradle APK: `android/app/build/outputs/apk/release/app-release.apk`
- Demo APK copy: `dist/release/ListingOS-android-demo-release.apk`

## RevenueCat environment strategy and payment matrix

Use this only for payment checks. It is production-safe once EAS profile values are set and local `.env` is test-only.

### Environment matrix (dev/debug vs release + dev-client)

| Context | Command | RC mode source | RC key source | Start behavior |
| --- | --- | --- | --- | --- |
| Local debug (recommended) | `npm run dev:tunnel` | `.env` or shell override | `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` | Native dev-client only; test-mode SDK diagnostics should appear. |
| Local clean native rebuild | `npx expo run:ios --device` / `npx expo run:android --device` | `.env` | `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` | Same as above after native build refresh. |
| EAS dev-client (`development` / `preview`) | `npx eas-cli@latest build -p ios|android --profile development|preview` | `test` (from profile) | `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` (or build profile override) | Shared profile for internal QA and payment checks. |
| EAS release/dev-client (`production`) | `npx eas-cli@latest build -p ios|android --profile production` | `production` (from profile) | `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` (plus optional `platform-specific RevenueCat production public key` fallback only) | Real build-path verification only; never uses test store keys. |
| Expo Go | `npx expo start` | n/a | n/a | **Not supported for payment checks.** Native Billing SDK must be present.

### Release verification command bundle

Collect a deterministic startup transcript each time you change `eas.json` or `.env` values:

```sh
mkdir -p artifacts/revenuecat/validation
npx eas-cli@latest env:list > artifacts/revenuecat/validation/eas_env_list.log 2>&1
cat src/config/app.ts | sed -n '1,220p' > artifacts/revenuecat/validation/app_config_contract.log
cat .env | sed -n '1,80p' > artifacts/revenuecat/validation/env_snapshot.log
cat eas.json | jq '.build.development.env, .build.preview.env, .build.production.env' > artifacts/revenuecat/validation/eas_profiles.json
```

### Clean native rebuild commands

Create and reuse evidence logs:

```sh
mkdir -p artifacts/revenuecat/validation
```

iOS clean native rebuild:

```sh
rm -rf ios/Pods ios/build ios/Podfile.lock
EXPO_PUBLIC_REVENUECAT_MODE=test \
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=YOUR_REVENUECAT_TEST_PUBLIC_API_KEY \
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default \
npx expo prebuild --platform ios --clean \
  2>&1 | tee artifacts/revenuecat/validation/ios_prebuild.log
EXPO_PUBLIC_REVENUECAT_MODE=test \
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=YOUR_REVENUECAT_TEST_PUBLIC_API_KEY \
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default \
npx expo run:ios --device \
  2>&1 | tee artifacts/revenuecat/validation/ios_dev_client_install.log
```

Android clean native rebuild:

```sh
cd android && ./gradlew clean && cd ..
EXPO_PUBLIC_REVENUECAT_MODE=test \
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=YOUR_REVENUECAT_TEST_PUBLIC_API_KEY \
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default \
npx expo run:android --device \
  2>&1 | tee artifacts/revenuecat/validation/android_dev_client_install.log
```

Expected outputs:

1. iOS/Android install succeeds and app launches on target device.
2. Startup log contains `[RevenueCat] mode=test` (local) or `[RevenueCat] mode=production` (release). The log includes `keySource` and `keyState`.
3. Run the same two command blocks again with no source changes to validate reproducibility.

### One-command startup for bundle stability

```sh
npm run dev:tunnel
```

Equivalent direct command:

```sh
expo start --dev-client --clear --host tunnel
```

Use this when Metro bundling or package discovery is unstable. Use `npm run dev` if the same network path is stable.

### Startup transcript template

To confirm the startup key path, launch once and capture startup logs:

```sh
npm run dev:tunnel > artifacts/revenuecat/validation/startup_trace.log 2>&1
```

Search `startup_trace.log` for the `[RevenueCat] mode=` line and verify that it matches the expected mode for the command and profile.

### Validation checklist

| Step | Command | Evidence file | Success signal |
| --- | --- | --- | --- |
| 1 | `npx eas-cli@latest env:list > artifacts/revenuecat/validation/eas_env_list.log 2>&1` | `artifacts/revenuecat/validation/eas_env_list.log` | Production and development profiles resolve keys consistently across environments. |
| 2 | `cat .env | sed -n '1,80p' > artifacts/revenuecat/validation/env_snapshot.log` | `artifacts/revenuecat/validation/env_snapshot.log` | `EXPO_PUBLIC_REVENUECAT_MODE` is `test` for local checks. |
| 3 | `cat eas.json | jq '.build.development.env, .build.preview.env, .build.production.env' > artifacts/revenuecat/validation/eas_profiles.json` | `artifacts/revenuecat/validation/eas_profiles.json` | Development and preview profiles are `test`; production is `production`. |
| 4 | `npm run dev:tunnel > artifacts/revenuecat/validation/startup_trace.log 2>&1` (stop on first install prompt) | `artifacts/revenuecat/validation/startup_trace.log` | Log line confirms `[RevenueCat] mode=test` and expected source prefix. |
| 5 | iOS clean native rebuild | `artifacts/revenuecat/validation/ios_prebuild.log`, `artifacts/revenuecat/validation/ios_dev_client_install.log` | Successful install + launch + RC source line in startup trace. |
| 6 | Android clean native rebuild | `artifacts/revenuecat/validation/android_dev_client_install.log` | Successful install + launch + RC source line in startup trace. |
| 7 | Replay steps 5-6 after an unchanged second run | same files + appended lines | RC startup line and mode are unchanged (deterministic). |

### Migration notes: test-only -> dual-mode production

1. Keep local `.env` at `EXPO_PUBLIC_REVENUECAT_MODE=test` for dev-device checks.
2. Add explicit `EXPO_PUBLIC_REVENUECAT_MODE=production` and platform keys in `eas.json -> build.production.env`.
3. Keep `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` in local/dev profiles only.
4. Keep `platform-specific RevenueCat production public key` as a temporary fallback only while `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` are being validated.
5. Add release validation using `eas env:list`, startup trace, and one reproducibility rerun.

### Rollback steps

To revert immediately while keeping a safe production posture:

1. Revert the env and config commit (or the three files touched in that commit): `.env`, `.env.example`, `eas.json`, `src/config/app.ts`.
2. Re-run:

```sh
npm run check
```

3. Redeploy from the prior approved build profile and re-run `eas env:list` to confirm restored profile values.

## Local Standalone Android Build

```sh
npm run check
npm run worker:check
npm run build:android:release
npm run install:android:release
npm run open:android
```

After `install:android:release`, the app is installed on the phone and runs from the launcher without the computer connected. It uses the deployed Cloudflare Worker, not Metro.

If more than one Android target is connected, install explicitly:

```sh
adb -s R5CY51SFSDL install -r android/app/build/outputs/apk/release/app-release.apk
adb -s R5CY51SFSDL shell monkey -p com.jongan69.listingos -c android.intent.category.LAUNCHER 1
```

The local `assembleRelease` APK is suitable for demos and local recording. Store distribution should use EAS or Play signing credentials instead of the local debug/demo signing setup.

### Verified Android fallback build

On July 18, 2026, the current source produced and installed a fresh `arm64-v8a` release APK after Gradle's final incremental splitter failed under its default worker configuration. The successful cached packaging command was:

```sh
ANDROID_HOME=/Users/jonathangan/Library/Android/sdk \
ANDROID_SDK_ROOT=/Users/jonathangan/Library/Android/sdk \
./gradlew :app:packageRelease --no-daemon --stacktrace \
  --info -Dorg.gradle.workers.max=1 \
  -PreactNativeArchitectures=arm64-v8a -x lintVitalAnalyzeRelease
```

The resulting 71 MB APK was installed on Samsung A16 serial `R5CY51SFSDL`; the app launched with PID `18418` and no `FATAL EXCEPTION` or `AndroidRuntime` crash was observed in the post-launch log window. This is a local demo verification, not a replacement for a signed store build.

## EAS Internal Build

Use this when you want a shareable install link without manually sending an APK:

```sh
npx eas-cli@latest build -p android --profile preview
```

The `preview` profile produces an Android APK for internal testing.

## Web Release

Build and exercise the server-rendered web artifact before assigning the production alias:

```sh
npm run web:verify
npm run web:serve
```

`web:verify` is read-only with respect to hosting. After the local smoke test passes, use
one explicit deployment command:

```sh
npm run web:deploy:preview
npm run web:deploy:production
```

Do not chain preview and production deployment in one command. A production alias change
must always be a deliberate action.

The normal production web and every native production build keep Proof Mode disabled. For
the time-limited judge website only, build and inspect the fixture-backed artifact locally,
then deploy it with the dedicated command:

```sh
EXPO_PUBLIC_PROOF_MODE=true npm run web:export
npm run web:serve
EXPO_PUBLIC_PROOF_MODE=true npm run web:deploy:production
```

`web:deploy:proof` sets `EXPO_PUBLIC_PROOF_MODE=true` only while exporting the public web
artifact. Never add that flag to the native production EAS profile. Proof Mode is
non-mutating, but it is a judge surface rather than a normal seller feature. Verify `/`, a
Proof Mode draft, and an unknown route in a signed-out browser after deployment.

## Store Builds

Android Play Store:

```sh
npm run eas:build:android
```

iOS App Store or TestFlight:

```sh
npm run eas:build:ios
```

Store submission requires Apple Developer / Google Play Console accounts and signed store credentials. Use platform-specific submits so one platform can move even if the other is blocked:

```sh
npm run eas:submit:ios
npm run eas:submit:android
```

The Android submit profile targets the Play `internal` track with
`releaseStatus: completed`. In EAS Submit/Google Play terms, that completes rollout to the
**internal test track**; it does not promote the app to production. Confirm the destination
track in Google Play Console before every submit.

Before store builds, configure push credentials:

- Android: Firebase project `listingos-jongan69` must have `google-services.json` at the repo root, and EAS must have the FCM V1 key assigned.
- iOS: EAS must have Apple build credentials, APNs key, and App Store Connect API key assigned for `com.jongan69.listingos`. Production EAS builds set the APNs entitlement to `production`; local/dev builds set it to `development`.
- Full push checklist: `docs/PUSH_NOTIFICATIONS.md`.

Convenience scripts:

```sh
npm run eas:credentials:android
npm run eas:credentials:ios
npm run eas:build:android
npm run eas:build:ios
npm run eas:build:production
npm run eas:submit:android
npm run eas:submit:ios
npm run eas:submit:production
```

## Current Release State

- EAS project: `@jongan69/listingos`
- Web production URL: `https://listingos.expo.app`
- Cloudflare Worker: deployed and healthy
- RevenueCat test entitlements: `starter`, `pro`, `studio`
- Billing enforcement: `enforce`
- Free usage allowance: `20` AI listing credits per month
- iOS build metadata is currently `1.0.1 (20)` in `app.json`; finalize status remains external to the repo.
- Android build metadata is currently `1.0.1` / versionCode `14` in `app.json`; historical internal-track `versionCode 10` remains in the record.
- Android production build `a5e3300a-57b5-42d1-8621-d4dd2698a2de` is active in EAS as of 2026-07-20.
- iOS submission: `https://expo.dev/accounts/jongan69/projects/listingos/submissions/c826411e-2462-47e5-8fa7-47fa5c4f0f85`
- Android submission: `https://expo.dev/accounts/jongan69/projects/listingos/submissions/4e2c3cf1-65f5-4290-ab4e-d8af3e5b44b5`
- Android installed release APK: `android/app/build/outputs/apk/release/app-release.apk`
- Android notification verification: a physical Samsung A16 registered a token and received a Worker-sent Expo/FCM notification on July 17, 2026
- iOS notification delivery still requires a physical-device proof pass
- Remote D1 migration `0008_draft_job_fingerprints.sql` is applied; the deployed Worker is healthy.
- Android release intentionally uses cross-platform on-device photo-quality analysis; the experimental YOLOX runtime is not linked into the release build because its JSI/native binary caused Android startup and alignment risk.

Note: App Store Connect previously reported the display name `ListingOS` as already taken during app-record creation and temporarily created the record as `ListingOS (44f5ee)`. Confirm the final display name in App Store Connect before public release.

The Google Play Android Developer API is enabled. The historical internal-track submission used versionCode `10`; newer production-cycle builds are currently running separately.

The Play submit service account is active in Play Console with app-scoped access to `ListingOS`, including app read access and `Release apps to testing tracks`. API access was verified by creating and deleting a temporary Android Publisher edit for `com.jongan69.listingos`, so `npm run eas:submit:android` can be used for future internal-track draft submissions.

## Current Production Monetization Blockers

- Cloudflare Worker billing enforcement is live and unsigned RevenueCat webhook calls are rejected.
- Android Play subscription creation is blocked until the Google Play merchant account is set up and the Play service account receives monetization/product-management permission.
- Google Play public production release is blocked by Play's closed testing requirement: at least 12 opted-in testers for at least 14 days before production access can be requested.
- iOS subscription setup is blocked until App Store Connect is signed in and the paid app/subscription agreements, tax, and banking status are confirmed.
- RevenueCat production app configs, production public SDK keys, the `default` offering, and the production webhook must be finalized after App Store Connect / Play subscription products exist.

## Store Metadata

Canonical launch copy lives in:

- `docs/APP_STORE_COPY.md`
- `store.config.json`

Before pushing App Store metadata, replace any account-specific review contact details in App Store Connect and confirm that these URLs are live:

- Privacy: `https://seller-ai-platform.jonathang132298.workers.dev/privacy`
- Support: `https://seller-ai-platform.jonathang132298.workers.dev/app-support`
- Marketing: `https://listingos.expo.app`

## Demo Safety

- Use the release APK for recordings.
- Do not use Expo Go in the demo.
- Do not show `.env`, eBay credentials, OpenAI keys, or Cloudflare secrets.
- Do not create extra production eBay listings unless the demo explicitly needs a live publish.
- If publishing live, verify the buyer-facing listing and media before claiming success.

<!-- CURRENT-RELEASE-SNAPSHOT-2026-07-21 -->
## July 21, 2026 Release Snapshot

Public app, support, privacy, terms, deletion, and Market shell URLs returned 200. The deployed public Market feed returned 500 and is not release-ready.

Development EAS configuration may use RevenueCat Test Store mode. Preview, production, and TestFlight demo profiles use production mode with platform-specific iOS/Android public SDK keys. Web checkout remains unavailable while hosted purchase links are empty.

For fixture-backed web proof, set the environment explicitly: EXPO_PUBLIC_PROOF_MODE=true npm run web:deploy:production.
