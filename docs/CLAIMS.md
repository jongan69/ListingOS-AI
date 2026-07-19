# Submission Claims And Evidence

This ledger is the truth source for README, Devpost, demo narration, and store copy. Claims are intentionally narrower than the roadmap.

| Public claim | Evidence | Confidence | Safe to publish? | Required wording |
| --- | --- | --- | --- | --- |
| ListingOS is an Expo React Native mobile app | `package.json`, `app.json`, Expo Router routes under `src/app` | High | Yes | Built with Expo SDK 57, React Native, and Expo Router. |
| GPT-5.6 analyzes product photos | `worker/index.ts` calls `/v1/responses` with `input_image`; default model constant is `gpt-5.6-luna` | High | Yes | GPT-5.6 analyzes product photos through the OpenAI Responses API. |
| Model output is structured and validated | Both draft and card OCR calls use strict JSON Schema; public draft payload is parsed by Zod | High | Yes | GPT-5.6 returns strict structured output that the Worker validates before persistence. |
| Draft generation is asynchronous | Upload batches, draft jobs, Cloudflare Queue producers/consumers, and queue status routes are implemented | High | Yes | Draft generation runs asynchronously while the seller continues from Home. |
| Cloudflare is the backend platform | Deployed Worker plus configured D1, R2, KV, and three Queues; `/health` reports all configured | High | Yes | Backed by Cloudflare Workers, D1, R2, KV, and Queues. |
| Sellers connect their own eBay accounts | OAuth connect/callback flow, encrypted token persistence, Identity lookup, and seller session routes are implemented | High | Yes | Sellers connect with eBay OAuth and publish through their own account. |
| ListingOS publishes real fixed-price listings | Inventory item, offer, and publish calls are implemented; production Worker uses `EBAY_USE_SANDBOX=false`; published D1 attempts contain real listing/offer IDs | High | Yes | Publishes verified fixed-price listings through eBay's Inventory API. |
| Listing images are buyer-reachable | Photos are first sent through eBay's Media API and replaced with returned eBay-hosted URLs before Inventory publish | High | Yes | Media is ingested by eBay before publish so buyer-facing galleries use eBay-hosted images. |
| Pricing uses eBay comparables | Browse text search and image search are implemented, with exact-match filtering and active-listing price aggregation | High | Yes, qualified | Uses active eBay comparable listings and image-search candidates; it does not claim sold-comps data. |
| Graded-card identity is guarded | OpenAI label OCR, PSA cert lookup, Pokémon catalog resolution, identity confidence gates, and exact-comp requirements are implemented | High | Yes | Cross-checks graded cards against PSA, catalog, and eBay evidence; weak identity locks pricing for review. |
| Blockers are resolved in-app | Seller readiness, required-aspect verification, policy/location resolution routes, and inline actions are implemented | High | Yes, qualified | Surfaces eBay blockers inline and resolves supported policy, location, and aspect issues in-app. |
| The seller can edit before publishing | Review supports title, price override, strategy, category, condition, specifics, description, photo order, and lead photo | High | Yes | One review screen keeps AI defaults editable before verify and publish. |
| Background completion can notify the seller | Device token registration, Expo Push delivery, Worker publish notifications, and Android delivery proof exist | Medium | Yes, qualified | Android background publish alerts were verified; iOS delivery still requires device-level confirmation. |
| RevenueCat subscriptions are live | SDK integration, backend usage metering, entitlement sync routes, webhook validation, and enforcement exist; production store products are not finalized | High | No as a launch claim | RevenueCat-backed metering is implemented, but production subscription products remain launch work. |
| Auction publishing is supported | Shared contracts include auction mode, but no verified Trading API publish adapter is active | High | No | Fixed-price is the verified MVP; auction publishing is roadmap work. |
| Image enhancement is automatic | AI returns an enhancement plan, but transformed variants are not generated | High | No | AI recommends honest image improvements; automated transforms are roadmap work. |
| Listings reach review in under one minute | Prior device runs reached a usable draft in roughly 40 seconds, but latency varies with network and providers | Medium | Only as demo evidence | In the recorded run, the draft reached review in under one minute. Do not promise a universal SLA. |

## Verification Snapshot

- Worker health checked July 17, 2026: HTTP 200 with OpenAI, eBay, storage, queues, and D1 configured.
- Worker dry-run bundle checked successfully.
- Mobile and Worker TypeScript projects checked successfully.
- Android and web Expo production exports checked successfully.
- No obvious committed API key or private-key patterns were found in the tracked tree.
- Full automated unit, integration, and device E2E suites are not yet present; do not claim automated coverage.
