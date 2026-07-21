# RevenueCat

Single source of truth for billing. Replaces the five overlapping RevenueCat documents
that described the pre-2026-07-21 broken state.

**Project:** ListingOS (`89a32260`) · **Offering:** `default` (`ofrng180f676205`)

---

## 1. The contract

Do not let these drift. Code and dashboard must agree.

| Plan | Entitlement | Product IDs (App Store / Test Store / Web) | Play Store |
| --- | --- | --- | --- |
| Starter | `starter` | `listingos_starter_monthly`, `listingos_starter_annual` | `listingos_starter:monthly`, `listingos_starter_annual:annual` |
| Pro | `pro` | `listingos_pro_monthly`, `listingos_pro_annual` | `listingos_pro:monthly`, `listingos_pro_annual:annual` |
| Studio | `studio` | `listingos_studio_monthly`, `listingos_studio_annual` | `listingos_studio:monthly`, `listingos_studio_annual:annual` |

Free tier is app-side only; it has no product and no entitlement.

Defined in: `src/config/billing.ts`, `src/shared/contracts.ts`.
Consumed by: `src/lib/revenuecat.ts`, `src/components/billing-card.tsx`, `src/screens/dashboard-screen.tsx`.

> Play Store IDs use colon-suffixed base-plan notation. That is correct for Play and must
> **not** be normalised to the Apple format.

---

## 2. Apps and keys

Public SDK keys are safe in client code. The secret key is not.

| App | Key | Where it goes |
| --- | --- | --- |
| Test Store | `test_…` | `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` |
| ListingOS (App Store) | `appl_…` | `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` |
| ListingOS (Play Store) | `goog_…` | `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` |
| ListingOS (RevenueCat Billing) | `rcb_…` | `EXPO_PUBLIC_REVENUECAT_WEB_API_KEY` |
| Secret (REST) | `sk_…` | **Worker secret only** — never in `.env`, never in `eas.json` |

### Environment variables

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_REVENUECAT_MODE` | `test` or `production`. Selects Test Store vs. platform store keys. |
| `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` | `default`. |
| `EXPO_PUBLIC_REVENUECAT_ALLOW_TEST_STORE_IN_RELEASE` | Opts release builds into Test Store. Dev/preview only — never production. |
| `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS` | JSON map of hosted checkout URLs. Empty until Stripe is connected. |
| `REVENUECAT_SECRET_API_KEY` | Worker secret. REST entitlement verification. |
| `REVENUECAT_WEBHOOK_AUTH_TOKEN` | Worker secret. Validates inbound webhooks. |
| `REVENUECAT_WEBHOOK_SIGNING_SECRET` | Optional Worker secret. Verifies RevenueCat HMAC signatures only after signing is enabled for the same dashboard integration. |
| `REVENUECAT_API_VERSION` | `v1` \| `v2` \| `auto` (default). Which REST generation the secret key belongs to. |
| `REVENUECAT_PROJECT_ID` | `89a32260`. Required by the v2 API, which scopes customers under a project. |

### Secret key generations — the 403 trap

Secret keys are **all prefixed `sk_`**, but they come in two generations, and a
key of one generation returns **403 against the other generation's endpoints**.
The only place the generation is visible is the **"API Version" column** on the
API keys page.

This cost real debugging time on 2026-07-21: a V2 key was in use against the v1
`/v1/subscribers` endpoint, so every verification returned 403. In `enforce`
mode that silently downgraded paying sellers to `free` — the store charged them
and the app showed no entitlement.

`lookupRevenueCatEntitlements` in `worker/index.ts` now supports both:

- **v1** — `GET /v1/subscribers/{app_user_id}`, entitlements keyed by object name.
- **v2** — `GET /v2/projects/{project_id}/customers/{app_user_id}/active_entitlements`,
  matched on each item's `lookup_key`.

Both resolve to the same `starter` / `pro` / `studio` strings via the shared
`KNOWN_ENTITLEMENTS` list, so the two paths cannot drift.

With `auto`, v1 is tried first and v2 is used only when v1 fails with 401/403 —
any other error is a genuine failure and is not masked by a second request. Once
you know which key you hold, pin `REVENUECAT_API_VERSION` to skip the retry.

**Migrating to v2:** set `REVENUECAT_API_VERSION=v2` and store a V2 secret key.
No other change. Note the v2 `active_entitlements` collection carries no
management URL, so the client-supplied one is used instead.

---

## 3. Runtime behaviour by platform

### Native (iOS / Android)

`src/lib/revenuecat.ts` configures `react-native-purchases`, resolves the platform key,
validates its prefix, and loads `customerInfo` + offerings.

Test Store keys are rejected in release builds **unless**
`EXPO_PUBLIC_REVENUECAT_ALLOW_TEST_STORE_IN_RELEASE=true`. Without that opt-in, an
internal or preview build silently reports "catalog pending" — it is a release build, so
`__DEV__` is false. This was the long-standing cause of that error.

### Web

Web never calls `react-native-purchases`. It uses hosted RevenueCat Web Purchase Links,
gated on `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS` containing at least one valid URL.
With no links the paywall renders a notice and disables paid actions; metering still works.

---

## 4. Server-side trust

A client claiming an entitlement is not proof of purchase. `worker/index.ts` only elevates
a `billing_profiles` row when the source is `revenuecat_rest`, `revenuecat_webhook`, or
`manual`.

`BILLING_ENFORCEMENT_MODE=enforce` (current setting) means: **if `REVENUECAT_SECRET_API_KEY`
is unset, a completed purchase still resolves to `free`.** The paywall appears to succeed
and the entitlement never sticks. This is the highest-consequence, lowest-visibility
failure mode in the billing path.

Verify at any time:

```bash
curl -s https://seller-ai-platform.jonathang132298.workers.dev/health
```

```json
{ "revenueCatSecretConfigured": true,
  "revenueCatWebhookConfigured": true,
  "revenueCatWebhookSigningConfigured": false,
  "billingEnforcementMode": "enforce" }
```

The REST secret, webhook authorization, and enforcement values must be as shown. HMAC may
remain `false` until deliberately enabled. To enable it safely:

1. Open the exact webhook integration in RevenueCat and enable HMAC signing.
2. Copy the one-time signing secret directly into the Worker with
   `npx wrangler secret put REVENUECAT_WEBHOOK_SIGNING_SECRET`.
3. Deploy the Worker and confirm `revenueCatWebhookSigningConfigured: true`.
4. Send a dashboard test event and confirm HTTP 200 before relying on the integration.

Do not set the Worker signing secret before the RevenueCat integration sends the matching
`X-RevenueCat-Webhook-Signature` header: once configured, missing, stale, or mismatched
signatures are rejected. The separate Authorization token remains required in both modes.
To repair the base trust path: `npm run rc:finish`.

---

## 5. Status

**Working:** offering package mapping across all four stores; entitlements attached to all
15 products; real SDK keys in `.env` and every EAS profile; Test Store purchases on
device; Worker REST + webhook verification.

**Blocked — needs a person:**

| Item | Why | Fix |
| --- | --- | --- |
| Web checkout | RevenueCat Billing has no Stripe account, so Web Purchase Links cannot be saved at all | Web → ListingOS (RevenueCat Billing) → Billing → connect Stripe |
| App Store products show "Could not check" | App Store Connect credential sync | Re-enter ASC credentials in RevenueCat and re-sync |
| Play Store products show "Not found" | App not published to a track with a matching package name | Publish to internal testing |

None of the three block a Test Store demo.

---

## 6. Verification runbook

```bash
npm run rc:finish            # secret + deploy + verify server trust path
npm run device:ios           # or device:android
```

On device, open the paywall and confirm:

1. Six plans render with real prices — not the setup notice.
2. Metro logs a `[RevenueCat]` line showing mode, key source, key prefix, offering, and
   a non-zero package count.
3. A Test Store purchase completes.
4. The dashboard plan flips off Free.
5. `GET /api/billing/summary` reports the expected active entitlement.

Step 4 is the one that proves the server trust path; steps 1–3 only prove the client.

---

## 7. Rollback

1. Clear `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS` to disable web checkout.
2. Detach the affected entitlement mapping in RevenueCat.
3. Confirm the app falls back to the free plan.
4. Re-attach one product family at a time, re-testing between each.
