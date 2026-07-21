# Monetization Plan

ListingOS should monetize as a usage-bounded subscription, not as unlimited lifetime access. The product creates real variable cost through AI vision, marketplace lookups, storage, background jobs, and publishing retries, so every plan needs monthly limits and backend-enforced cost controls.

## Business Goal

Keep the app as cheap as possible for sellers while guaranteeing that normal usage pays for:

- OpenAI image and text inference.
- eBay API orchestration and publishing retries.
- Cloudflare Workers, D1, R2, KV, and Queues usage.
- RevenueCat billing infrastructure.
- App Store / Google Play fees.
- A safety margin for abuse, retries, support, refunds, and model-price drift.

## Billing Model

Use RevenueCat for subscriptions and entitlements. Use the ListingOS Worker as the source of truth for usage metering.

RevenueCat should answer:

- Is this user subscribed?
- Which tier is active?
- Is the subscription still valid?
- Is this user in trial, intro offer, grace period, billing retry, or expired?

ListingOS should answer:

- How many AI listing credits has the seller used this month?
- Which expensive operations were performed?
- Can the seller start another draft?
- Can the seller autopublish?
- Should the seller upgrade, wait for renewal, or buy a credit pack?

## Usage Unit

The primary billable unit is an `AI listing credit`.

One credit is consumed when a draft job reaches a terminal useful state:

- `ready`
- `needs_input`
- `blocked`
- `publishing`
- `published`

Do not charge a credit for:

- upload failures before AI starts
- backend queue failures that produce no usable draft
- duplicate retry jobs for the same batch
- publish retries for an already-charged draft

Track secondary cost events for internal analysis:

- photo upload count and compressed byte size
- OpenAI draft call
- OpenAI card OCR call
- eBay image-search call
- PSA lookup
- Pokémon TCG lookup
- eBay media upload
- publish verification
- publish attempt

## Recommended Tiers

These are launch defaults, not permanent pricing. The MVP now uses three paid tiers to keep the paywall understandable while still covering AI/API cost risk.

| Tier | Price | Annual | Monthly AI Listings | Autopublish | Best For |
| --- | ---: | ---: | ---: | --- | --- |
| Free | $0 | $0 | 20 | No | building a listing habit |
| Starter | $14.99/mo | $149.99/yr | 75 | Yes | casual sellers |
| Pro | $49.99/mo | $499.99/yr | 300 | Yes | active eBay sellers |
| Studio | $149.99/mo | $1,499.99/yr | 1,000 | Yes | resale teams / card shops |

Annual plans are roughly two months free. Monthly plans should remain the default while unit economics are still being measured.

## Credit Packs

Credit packs can supplement subscriptions, but should not replace them.

Recommended consumable packs:

- 25 extra AI listings: $7.99
- 100 extra AI listings: $24.99
- 500 extra AI listings: $99.99

Credit packs are useful for spikes, but subscription tier upgrades should be the primary path for recurring high usage.

## Lifetime Plan

Do not offer unlimited lifetime access.

If a lifetime product is ever offered, it must be capped:

- one-time purchase
- fixed lifetime credit bucket
- no unlimited AI calls
- no unlimited autopublish
- clear fair-use language

Example:

- `Founder Lifetime`: $299 one-time
- includes 1,000 AI listing credits
- includes future app access
- additional usage still requires credit packs or subscription

This is more like prepaid credits plus founder access, not true unlimited lifetime service.

## RevenueCat Setup

Create entitlements:

- `starter`
- `pro`
- `studio`

Create one offering:

- `default`

Attach monthly and annual products to each entitlement:

- `listingos_starter_monthly`
- `listingos_starter_annual`
- `listingos_pro_monthly`
- `listingos_pro_annual`
- `listingos_studio_monthly`
- `listingos_studio_annual`

Optional consumables:

- `credits_25`
- `credits_100`
- `credits_500`

The app should never hardcode product IDs as business logic. It should read RevenueCat customer entitlements, send them to the Worker, and the Worker should map entitlements to quota.

## Backend Data Model

Add tables:

```sql
CREATE TABLE usage_periods (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  entitlement TEXT NOT NULL,
  included_credits INTEGER NOT NULL,
  extra_credits INTEGER NOT NULL DEFAULT 0,
  used_credits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  draft_id TEXT,
  batch_id TEXT,
  event_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cost_estimate_usd REAL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
```

Add fields to seller account or a linked subscription table:

- `revenuecat_app_user_id`
- `active_entitlement`
- `entitlement_expires_at`
- `subscription_status`
- `last_revenuecat_sync_at`

## Backend Enforcement

Before creating an upload batch:

1. Resolve seller session.
2. Sync or verify RevenueCat entitlement if stale.
3. Load current usage period.
4. If remaining credits are zero, return `402 Payment Required`.
5. Allow upload only when the seller has quota.

When a draft reaches a terminal useful state:

1. Use idempotency key `draft-credit:{draftId}`.
2. Increment `used_credits` once.
3. Record a `usage_events` row.

Before autopublish:

1. Require active paid entitlement, not Free.
2. Require remaining credits or already-charged draft.
3. Require normal publish blockers to be clear.
4. Require the existing strict confidence / comp evidence rules.

### Current implementation state

Implemented:

- `react-native-purchases` installed for native RevenueCat SDK support.
- Home screen shows current plan, monthly AI listing credits, usage, and upgrade/manage entry point.
- Native builds initialize RevenueCat by `EXPO_PUBLIC_REVENUECAT_MODE`:
  - `production` → `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
  - `test` → `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`
  - optional migration fallback: `EXPO_PUBLIC_REVENUECAT_PROD_API_KEY` when a platform key is temporarily missing
- RevenueCat identity is linked to the seller account as `seller:{sellerAccountId}` after eBay login.
- The app syncs RevenueCat active entitlements to the Worker.
- The Worker stores `billing_profiles`, `usage_periods`, and `usage_events`.
- `GET /api/billing/summary`, `POST /api/billing/sync`, and `POST /api/billing/events` are live.
- `POST /api/uploads/batches` checks monthly AI listing quota.
- Draft generation charges one idempotent `ai_listing_credit` when a useful draft is produced.
- Autopublish is entitlement-aware; free users are moved to review-first when enforcement is enabled.
- `BILLING_ENFORCEMENT_MODE=enforce` blocks over-quota draft creation and disables free autopublish in production.
- Client-side RevenueCat sync is not trusted for paid access in enforce mode; paid entitlements must come from RevenueCat REST verification, a signed RevenueCat webhook, or a manual server-side grant.

RevenueCat project state as of July 20, 2026:

- Project: `ListingOS`
- Current store configuration: production-first (`EXPO_PUBLIC_REVENUECAT_MODE=production`) with Test Store retained for local and preview test checks.
- Test Store key is still configured locally through `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` for non-production test-mode debugging.
- Platform production keys are expected from `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`; the shared `EXPO_PUBLIC_REVENUECAT_PROD_API_KEY` remains fallback-only.
- Entitlements created: `starter`, `pro`, `studio`
- Test Store products currently configured:
  - `listingos_starter_monthly` at `$14.99/mo`
  - `listingos_starter_annual` at `$149.99/yr`
  - `listingos_pro_monthly` at `$49.99/mo`
  - `listingos_pro_annual` at `$499.99/yr`
- `listingos_studio_monthly` at `$149.99/mo`
- `listingos_studio_annual` at `$1,499.99/yr`
- Product-to-entitlement attachment completed for all six Test Store products.

## Web Checkout Links (RevenueCat Web)

ListingOS web billing currently uses RevenueCat Web Purchase Links for checkout:

- `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS` is required in web-facing profiles.
- Configure per-plan, per-term hosted checkout URLs in the JSON format expected by
  the app config parser.
- Keep native iOS/Android unchanged; they continue to use `react-native-purchases`
  and store-based entitlement sync.

Expected format:

```text
EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS={"starter":{"monthly":"https://...","annual":"https://..."},"pro":{"monthly":"https://...","annual":"https://..."},"studio":{"monthly":"https://...","annual":"https://..."}}
```

Entitlement elevation remains server-controlled through Worker verification.

Still required before production store purchases:

- Create matching in-app subscription products in App Store Connect.
- Create matching subscription products/base plans in Google Play Console.
- Add real App Store and Play Store app configurations in RevenueCat for `com.jongan69.listingos`.
- Copy the iOS `appl_...` and Android `goog_...` public SDK keys into EAS environment variables.
- Create a RevenueCat secret API key and set it as `REVENUECAT_SECRET_API_KEY` on the Worker so client refreshes can verify paid entitlements server-side.
- Configure a RevenueCat webhook to `POST /api/revenuecat/webhook` with `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH_TOKEN>`.
- Finish the `default` offering packages in RevenueCat once real store products exist; the Test Store catalog currently exists for development and integration testing.

## Cost Guardrails

Set internal cost budgets per listing credit:

| Operation Type | Target Cost | Hard Review Threshold |
| --- | ---: | ---: |
| General item draft | <= $0.08 | $0.20 |
| Graded card draft | <= $0.15 | $0.35 |
| Autopublish media + verify | <= $0.05 | $0.15 |

If a draft exceeds the threshold, record it in `usage_events` and lower future model/image fidelity for that path until reviewed.

## Launch Unit Economics

Assume small-business app-store economics where net proceeds are roughly 85% before RevenueCat and infrastructure costs.

Example monthly revenue before variable AI costs:

| Tier | Gross | Approx Net After Store Fee | Included Listings | Net Per Included Listing |
| --- | ---: | ---: | ---: | ---: |
| Starter | $14.99 | $12.74 | 25 | $0.51 |
| Pro | $49.99 | $42.49 | 150 | $0.28 |
| Studio | $149.99 | $127.49 | 750 | $0.17 |

The launch position is intentionally generous but measured: the free tier is a customer-acquisition cost, while paid tiers must maintain a variable-cost target below 30% of net subscription revenue. The product must aggressively compress images, cap AI inputs, cache lookups, avoid repeated AI calls, and use the operation ledger to adjust future quotas from real usage instead of guesses.

## App UX

Keep pricing UX simple:

- show remaining AI listings this month
- show current plan
- show upgrade button only when useful
- show "Autopublish requires Seller plan or higher" if free users try it
- never show backend cost language to normal sellers

Paywall trigger points:

- before first upload if user is signed out or out of credits
- after free credits are used
- when trying bulk queue on Free / Starter
- when trying autopublish on Free
- when trying high-volume card verification without enough credits

## MVP Implementation Order

1. Add RevenueCat SDK to Expo app.
2. Create RevenueCat project/products/entitlements with the AI Toolkit or dashboard.
3. Add Worker-side subscription and usage tables.
4. Add entitlement sync endpoint.
5. Gate `POST /api/uploads/batches`.
6. Charge one credit per terminal draft.
7. Add paywall / remaining credits UI.
8. Gate autopublish behind paid entitlement.
9. Add credit packs later after subscription flow is stable.

## Policy Notes

- Use Apple/Google in-app purchases for digital app functionality on mobile unless a specific regional external-purchase program applies.
- Subscriptions can include a monthly credit allowance.
- Consumable credit packs are reasonable for overflow usage.
- Unlimited lifetime access is not safe for an AI-heavy product.
