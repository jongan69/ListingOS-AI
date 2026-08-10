# ListingOS Current Implementation State

Last reconciled against the repository and public endpoints: **August 10, 2026**.

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
| ListingOS Market backend | Publish, feed, detail, inquiry, buyer thread/message, report, block, and rate-event code exists | Public feed still returned HTTP 500 on August 10, 2026. Root cause confirmed: the marketplace migration is not applied to the remote D1 | Deployment blocked, one operator action from resolution |
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

- The deployed public feed currently returns HTTP 500. The cause is no longer unconfirmed. See
  [Market feed 500: confirmed root cause](#market-feed-500-confirmed-root-cause).
- Verification compares a configured demo code. It does not send email.
- Seller inbox/reply UI is not implemented.
- Feed accepts cursor input but currently returns nextCursor: null.
- There is no Market payment, checkout, escrow, map SDK, shipping, rating, or trust-badge system.

## Market feed 500: confirmed root cause

`worker/migrations/0002_marketplace_beta.sql` has not been applied to the remote D1 database.
Every market table is therefore absent in production, and each route that reads one fails.

The Worker source is not at fault. No code change fixes this.

### Evidence

Observed against the deployed Worker on August 10, 2026:

| Request | Result |
|---|---|
| `GET /api/public/market/listings` | 500 |
| `GET /api/public/market/listings?q=test` | 500 |
| `GET /api/public/market/listings/<any-slug>` | 500 |
| `GET /api/public/market/listings?radiusMiles=notanumber` | 400 |
| `GET /health` | 200 |

The 400 is the decisive one. A malformed query is rejected by request validation before any
database read, so routing, the handler, and the error mapper all work. Only the requests that
reach a market table fail, and they fail regardless of which table they touch.

Reproduced locally by applying every migration except `0002_marketplace_beta.sql` to a scratch
database: the feed returns exactly `{"error":"An unexpected server error occurred."}` with HTTP
500, while `/health` still reports `d1Configured: true`. Applying the held-back migration to the
same database returns the feed to HTTP 200 and the detail route to a correct 404.

The migration itself is sound. It applies cleanly in both orderings, and its 13 statements are
all `CREATE TABLE IF NOT EXISTS` or `CREATE INDEX IF NOT EXISTS`, so re-application is safe.

### Why it went unnoticed

`/health` reported `d1Configured: true` throughout, because that field only tested whether the
D1 binding exists. It never queried the database, so a schema gap could not surface. `/health`
now also reports `marketSchemaReady`, which counts the eight market tables in `sqlite_master`
and returns `false` when any is missing.

### Remediation

This requires Cloudflare credentials and must be run by the account owner:

~~~bash
npx wrangler d1 migrations list seller-ai-db --remote   # expect 0002_marketplace_beta.sql pending
npm run db:migrate:remote
~~~

Then confirm, without redeploying the Worker:

~~~bash
curl -s .../health | grep marketSchemaReady          # expect true
curl -s -o /dev/null -w '%{http_code}' .../api/public/market/listings   # expect 200
~~~

Deploy the Worker first only if `marketSchemaReady` is absent from the health response, which
means the deployed build predates the probe.

### Note on the duplicate migration prefix

`0002_device_push_tokens.sql` and `0002_marketplace_beta.sql` share a numeric prefix. This was
tested and is **not** the cause: Wrangler tracks applied migrations by filename, so it still
lists a late-added duplicate-prefix migration as pending and applies it correctly.

Do not renumber either file. Wrangler would treat a renamed file as a new migration and
re-run it. Both are idempotent so that would be survivable, but it is needless risk for no gain.

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

Current red endpoint, re-confirmed August 10, 2026:

- Worker GET /api/public/market/listings returned HTTP 500 with {"error":"An unexpected server error occurred."}.
  Root cause confirmed. See [Market feed 500: confirmed root cause](#market-feed-500-confirmed-root-cause).

A 200 web shell does not prove its backing API is healthy. `https://listingos.expo.app/market`
returned 200 on the same day its feed API was returning 500.

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
- Remote D1 migration application and healthy deployed Market feed. The required command and
  its verification steps are in [Remediation](#remediation); only Cloudflare credentials are missing.
- App review metadata completion and selected builds.
- Public under-three-minute demo video and final submission acceptance.

## Release truth rule

Use three labels consistently:

- **Implemented**: present in source.
- **Verified**: observed with a local, device, deployed, or dashboard artifact.
- **Published**: externally available to the intended audience.

Do not collapse these labels into "shipped."
