# RevenueCat Production Setup

ListingOS uses RevenueCat production public SDK keys in release builds. The
mobile app must never receive the RevenueCat secret API key; the Worker keeps
that secret for server-side subscriber verification.

## EAS production variables

Set these in the EAS `production` environment before building:

```text
EXPO_PUBLIC_REVENUECAT_MODE=production
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default
```

The ListingOS project currently has these production entitlements and products:

- `starter`: `listingos_starter_monthly`, `listingos_starter_annual`
- `pro`: `listingos_pro_monthly`, `listingos_pro_annual`
- `studio`: `listingos_studio_monthly`, `listingos_studio_annual`

Google Play uses subscription/base-plan identifiers in the catalog:
`listingos_starter:monthly`, `listingos_pro:monthly`,
`listingos_studio:monthly`, plus the corresponding `:annual` base plans.
The mobile paywall normalizes those identifiers to the shared plan IDs, so the
same plan definitions work on both stores.

The `default` offering is wired to all six App Store products and all six
Google Play products. The old Test Store products remain available for local
development only and are not used by production builds.

Use a separate RevenueCat offering identifier for internal QA discounts, for
example `dev_discount`, only after that offering contains the real App Store
and Google Play products and is configured in RevenueCat targeting. The app
will select that offering by ID, but it will not grant entitlements based on a
local code.

## Discount testing

- iOS offer codes and promotional offers must be created in App Store Connect
  and connected to the production subscription products.
- Google Play promo codes and subscription offers must be created in Play
  Console for the production base plans.
- RevenueCat receives the resulting store transaction and grants the normal
  `starter`, `pro`, or `studio` entitlement. Do not add a client-side “unlock”
  code; that would bypass billing enforcement.

## Local development

Development builds may use the RevenueCat Test Store:

```text
EXPO_PUBLIC_REVENUECAT_MODE=test
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_...
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default
```

Test Store mode is rejected outside `__DEV__` builds. If a release build has
no platform production key, the app shows the subscription catalog as
unconfigured instead of initializing RevenueCat with the wrong key.

## Worker verification and webhooks

The live Worker has `BILLING_ENFORCEMENT_MODE=enforce` and stores the
RevenueCat secret API key server-side as `REVENUECAT_SECRET_API_KEY`. The
production RevenueCat webhook is configured as:

```text
POST https://seller-ai-platform.jonathang132298.workers.dev/api/revenuecat/webhook
Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH_TOKEN>
Environment: Production only
Apps: All apps
Events: All events
```

The endpoint was verified after configuration: no authorization returns `401`,
and an authorized webhook request is accepted by the live Worker. Never put
either secret in the mobile bundle, source control, or store metadata.

## Store-side verification

RevenueCat catalog configuration is complete, but a real store transaction
still requires the matching subscriptions/base plans to exist and be active in
App Store Connect and Google Play Console. RevenueCat currently cannot check
the App Store products until App Store Connect credentials are connected. Use
the store sandbox/test account or a developer offer for the first real purchase
test; do not treat a catalog entry alone as proof of a successful charge.

## Release order

1. Configure products, entitlements, and the production offering in RevenueCat.
2. Set the EAS production environment variables above.
3. Apply the Worker `REVENUECAT_SECRET_API_KEY` and configure the production
   webhook shown above.
4. Build a production Play internal release with the current Android package
   mapping and submit it to the internal track.
5. Purchase using a store sandbox/test account or the configured developer offer.
6. Confirm the entitlement reaches the Worker through SDK sync/webhook and that
   usage limits change only after RevenueCat confirms the purchase.

The iPhone release and GitHub billing workflows are intentionally outside this
release pass.

## Current Android release evidence

- EAS production build: `33049d11-62b4-4f65-b6d3-6fe2488cba80`
- Android version code: `11`
- AAB: https://expo.dev/artifacts/eas/4QPvC65yttuPyEBxMhr3uvLbQ8msbzItFTsutBUuzb4.aab
- Google Play internal-track submission: `a651b790-ae89-47af-a7e5-a32d7240cdd6`
- Google Play result: accepted as a draft internal release
