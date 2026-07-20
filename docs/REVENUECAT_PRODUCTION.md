# RevenueCat Production Setup

ListingOS uses RevenueCat production public SDK keys in release builds. The
mobile app must never receive the RevenueCat secret API key; the Worker keeps
that secret for server-side subscriber verification.

## EAS production variables

Set these in the EAS `production` environment before building:

```text
EXPO_PUBLIC_REVENUECAT_MODE=production
EXPO_PUBLIC_REVENUECAT_PROD_API_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default
```

Apply Worker secrets in Cloudflare (never as `EXPO_PUBLIC_*`):

```bash
npx wrangler secret put REVENUECAT_SECRET_API_KEY
npx wrangler secret put REVENUECAT_WEBHOOK_AUTH_TOKEN
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
EXPO_PUBLIC_REVENUECAT_PROD_API_KEY=
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

## Webhook validation checklist

- Confirm Worker secrets are set:
  - `REVENUECAT_SECRET_API_KEY`
  - `REVENUECAT_WEBHOOK_AUTH_TOKEN`
- Confirm mobile/public env does not include either secret key (no `EXPO_PUBLIC_REVENUECAT_SECRET_API_KEY` or `REVENUECAT_SECRET_API_KEY`).
- Confirm RevenueCat webhook target is `POST /api/revenuecat/webhook` with `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH_TOKEN>`.
- Confirm signed webhook header is sent as `x-revenuecat-signature` or `x-revenuecat-webhook-signature`.
- Send one sandbox `purchase_completed`, `entitlement_granted`, `restore`, or `subscription_renewed` event and collect:
  - Worker log line `billing.revenuecat_webhook.processed` with `isReplay: false`, `signatureStatus: ok`.
  - Row in `GET /api/internal/revenuecat/webhook-traces` with:
    - `eventId`
    - `appUserId`
    - `customerId`
    - `packageId`
    - `eventType`
    - `signatureVerified: true`
    - `isReplay: false`
- Confirm `/api/billing/summary` for the target seller changes to paid status after webhook processing.

If no webhook events arrive, use this triage order:

1. `wrangler tail --format pretty` and check whether requests reach Worker.
2. If only `billing.revenuecat_webhook.auth.failed` appears: verify RC Authorization header and token.
3. If only `billing.revenuecat_webhook.signature.failed` appears: verify `REVENUECAT_SECRET_API_KEY` and signing header.
4. If no route hits happen: verify RC webhook URL/events and project webhook activation in the RevenueCat dashboard.

## Auth/signature hardening behavior

- Missing webhook token while enforcement is active: `503`, `billing.revenuecat_webhook.config`.
- Token mismatch: `401`, `billing.revenuecat_webhook.auth`.
- Missing/invalid signature: `401`, `billing.revenuecat_webhook.signature`.
- Missing signing secret: `503`, `billing.revenuecat_webhook.config`.

All webhook traces now include:

- `eventId`
- `isReplay`
- `signatureVerified`
- `signatureStatus`

## Duplicate/replay incident note

- Replay detection is based on repeated `eventId` values in `billing.revenuecat_webhook` events.
- Response for replayed payload: `{ "ok": true, "replay": true }`.
- Replay logs: `billing.revenuecat_webhook.replay`.
- No entitlement sync is executed for replayed payloads.

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
7. Rotate secrets by updating both `REVENUECAT_WEBHOOK_AUTH_TOKEN` and
   `REVENUECAT_SECRET_API_KEY`, then redeploy.
8. Validate replay behavior by resubmitting a known `eventId` and checking
   `billing.revenuecat_webhook.replay`.

The iPhone release and GitHub billing workflows are intentionally outside this
release pass.

## Rollback and safe restore

1. Rotate `REVENUECAT_WEBHOOK_AUTH_TOKEN` to an emergency value to disable incoming deliveries.
2. Redeploy Worker immediately (no schema migration required).
3. If release is blocked on signature parsing, disable strict signature enforcement temporarily in a hotfix.
4. Restore prior valid secrets and redeploy when upstream header format is corrected.

## Current Android release evidence

- EAS production build: `33049d11-62b4-4f65-b6d3-6fe2488cba80`
- Android version code: `11`
- AAB: https://expo.dev/artifacts/eas/4QPvC65yttuPyEBxMhr3uvLbQ8msbzItFTsutBUuzb4.aab
- Google Play internal-track submission: `a651b790-ae89-47af-a7e5-a32d7240cdd6`
- Google Play result: accepted as a draft internal release
