# ListingOS Current Implementation State

Last reconciled against the repository and public endpoints: **July 21, 2026**.

This file is the documentation source of truth for what is implemented, what is publicly reachable, and what remains external or blocked. If an older plan, script, or checklist conflicts with this file, this file wins.

## Judge-safe product statement

ListingOS is a camera-first seller workflow that turns item photos into evidence-backed listing drafts, requires human review, and publishes fixed-price inventory to eBay. A ListingOS Market beta is present in source for public discovery and verified buyer inquiries, but its deployed API is not currently ready to claim as an end-to-end production feature.

## Current capability matrix

| Area | Source implementation | Public/runtime evidence | Claim status |
|---|---|---|---|
| Photo capture/import and draft generation | Implemented | Must be shown in the final device/browser demo | Claim only what the demo proves |
| AI listing draft and review | Implemented | Review UI and proof fixtures exist | Claimable |
| Evidence-gated pricing | Implemented | Accepted/rejected comparable evidence is visible | Claimable |
| eBay account connection | Implemented | OAuth uses platform callbacks and web session restoration | Claimable when demonstrated |
| eBay publishing | Implemented for fixed-price Inventory API flow | Live publish is an external mutation and is not a routine test | Claim fixed-price only |
| RevenueCat native billing | iOS/Android SDK integration, offering lookup, purchase, restore, and entitlement sync are implemented | Store catalog availability and final sandbox transactions remain external proof gates | Implemented, not fully production-proven |
| RevenueCat web billing | Hosted purchase-link routing is implemented | EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS is empty in checked EAS config | Not ready to claim checkout |
| ListingOS Market web UI | /market and /market/[slug] exist | https://listingos.expo.app/market returned 200 | Public shell is reachable |
| ListingOS Market backend | Publish, feed, detail, inquiry, buyer thread/message, report, block, and rate-event code exists | Public feed returned HTTP 500 on July 21, 2026 | Deployment blocked |
| Buyer verification | Configured-code verification exists | No outbound email provider is connected | Controlled demo only |
| Seller Market inbox/replies | Backend does not provide a seller reply workflow and native inbox UI is absent | None | Do not claim |
| Market checkout, escrow, maps, shipping, ratings | Not implemented | None | Explicitly out of scope |

## Marketplace beta: exact implemented boundary

Source includes:

- Seller-authenticated publish, unpublish, mark-sold, and mine endpoints.
- Public feed and listing detail endpoints with keyword, category, and optional distance inputs.
- Coarse location labels with optional latitude/longitude.
- Buyer session start and verification using MARKET_EMAIL_VERIFICATION_DEMO_CODE.
- Verified-buyer inquiry creation, buyer thread reads/messages, reports, blocks, and rate-event persistence.
- Public web feed/detail/inquiry surfaces.

Current limitations:

- The deployed public feed currently returns HTTP 500. The exact cause is unconfirmed; remote D1 migration state and Worker logs must be checked before claiming the feature is live.
- Verification compares a configured demo code. It does not send email.
- Seller inbox/reply UI is not implemented.
- Feed accepts cursor input but currently returns nextCursor: null.
- There is no Market payment, checkout, escrow, map SDK, shipping, rating, or trust-badge system.

## RevenueCat: exact runtime contract

### Native iOS and Android

- EXPO_PUBLIC_REVENUECAT_MODE=test is permitted only for development bundles and uses EXPO_PUBLIC_REVENUECAT_TEST_API_KEY.
- Production iOS uses EXPO_PUBLIC_REVENUECAT_IOS_API_KEY and requires an appl_ public SDK key.
- Production Android uses EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY and requires a goog_ public SDK key.
- There is no shared platform-specific RevenueCat production public key fallback.
- The app requests the configured offering, purchases packages, restores purchases, and syncs entitlement state with the Worker.

### Web

- Web does not use react-native-purchases checkout.
- Web checkout requires explicit hosted links in EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS.
- EXPO_PUBLIC_REVENUECAT_WEB_API_KEY may identify the RevenueCat Billing app, but the current checkout path is hosted-link based.
- Empty hosted links mean web purchase buttons must remain unavailable rather than pretending checkout works.

### Worker trust boundary

These values are server-only and must never be exposed through EXPO_PUBLIC_*:

- REVENUECAT_SECRET_API_KEY
- REVENUECAT_WEBHOOK_AUTH_TOKEN
- Optional webhook signing secret
- RevenueCat project/version configuration

Entitlements are authoritative only after Worker verification or a verified webhook event. Client UI state alone is not proof of access.

## Enforced plan quotas

| Plan | Monthly listing quota |
|---|---:|
| Free | 20 |
| Starter | 75 |
| Pro | 300 |
| Studio | 1,000 |

Older pricing projections using 25, 150, or 750 listings are historical assumptions, not the enforced runtime contract.

## Public URL snapshot

The following returned HTTP 200 on July 21, 2026:

- https://listingos.expo.app/
- https://listingos.expo.app/app-support
- https://listingos.expo.app/support
- https://listingos.expo.app/privacy
- https://listingos.expo.app/terms
- https://listingos.expo.app/legal/terms
- https://listingos.expo.app/deletion
- https://listingos.expo.app/market
- Worker /health, /app-support, and /privacy

Current red endpoint:

- Worker GET /api/public/market/listings returned HTTP 500 with {"error":"An unexpected server error occurred."}.

A 200 web shell does not prove its backing API is healthy.

## Proof Mode

Proof Mode must be enabled explicitly for the command being run:

~~~bash
EXPO_PUBLIC_PROOF_MODE=true npm run web:export
EXPO_PUBLIC_PROOF_MODE=true npm run web:deploy:production
~~~

The convenience script names do not set EXPO_PUBLIC_PROOF_MODE themselves. Keep Proof Mode disabled in native production profiles.

## External/manual gates

Repository code cannot prove these dashboard or publication states:

- App Store Connect and Google Play product availability.
- RevenueCat offering/package mappings in each store.
- Successful native sandbox purchase, restore, restart, and webhook trace.
- RevenueCat Billing products and non-empty hosted web purchase links.
- Remote D1 migration application and healthy deployed Market feed.
- App review metadata completion and selected builds.
- Public under-three-minute demo video and final submission acceptance.

## Release truth rule

Use three labels consistently:

- **Implemented**: present in source.
- **Verified**: observed with a local, device, deployed, or dashboard artifact.
- **Published**: externally available to the intended audience.

Do not collapse these labels into "shipped."
