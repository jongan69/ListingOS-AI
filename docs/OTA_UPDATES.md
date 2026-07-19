# OTA Update Runbook

ListingOS uses EAS Update for JavaScript, styling, and bundled-asset changes that are compatible with an installed native runtime. OTA support begins with the first binary built after `expo-updates` was added. Older TestFlight and store builds cannot receive updates retroactively.

## Release Channels

| Build profile | Channel | Purpose |
| --- | --- | --- |
| `development` | `development` | Development-client inspection |
| `preview` | `preview` | Internal OTA validation before production |
| `production` | `production` | TestFlight and App Store users |

All profiles use Expo's `appVersion` runtime policy. The runtime remains stable for OTA-only changes and changes whenever the user-facing app version is bumped.

The build profiles and update scripts also set `LISTINGOS_APS_ENVIRONMENT`. Keep this value aligned when adding profiles so production binaries carry the production APNs entitlement.

Before changing a native dependency, config plugin, permission, entitlement, icon, splash screen, or other native configuration, bump `expo.version` in `app.json`. Never publish native-dependent JavaScript against an older app-version runtime.

## Safe OTA Changes

- React screens, components, state, copy, and styling
- API orchestration that remains compatible with the deployed Worker
- Existing camera and photo-picker behavior using native modules already embedded in the binary
- Bundled JavaScript assets such as images and fonts
- Fixes that do not add permissions, entitlements, native dependencies, or native configuration

Use a new native build for Expo SDK upgrades, dependency changes with native code, permissions, entitlements, push configuration, icons, splash screens, deep-link configuration, Sony native bridges, and background execution capabilities.

## Validation Flow

1. Confirm the Worker remains compatible with the current and previous mobile clients.
2. Run the complete local gate:

   ```bash
   npm run check
   npm run export:updates
   ```

3. Publish to preview:

   ```bash
   npm run eas:update:preview -- --message "Short release description"
   ```

4. Force-close and reopen the preview build twice. Verify capture, photo import, upload, OAuth, draft review, blocker recovery, notifications, and RevenueCat state. Do not use a production eBay publish as a routine smoke test.
5. Publish the verified source revision to production:

   ```bash
   npm run eas:update:production -- --message "Short release description"
   ```

Production OTA publication is a deliberate release action. It is not automatically triggered by pushes to `main`.

## Native Build Flow

When native configuration changes, create a new build before publishing updates for its runtime:

```bash
npm run eas:build:ios
npm run eas:submit:ios
```

The first OTA-capable iOS binary must pass through TestFlight. Once installed, it checks for an update at launch, downloads it in the background, and applies it on a subsequent restart. Never force a reload while capture, upload, or marketplace publishing is active.

## Recovery

If an update is unhealthy, stop its rollout or republish the previous update in the EAS dashboard. If necessary, roll the channel back to the embedded update shipped in the binary. Avoid destructive local-storage migrations in OTA releases because rollback cannot reverse persisted data safely.
