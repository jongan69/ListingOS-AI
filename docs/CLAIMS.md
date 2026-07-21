# Submission Claims And Evidence

This ledger is the truth source for README, Devpost, demo narration, and store copy. Claims are intentionally narrower than the roadmap.

Everything here is **present tense**. Forward-looking statements live in [`ROADMAP.md`](ROADMAP.md) and must stay in future tense, clearly labelled, and out of any elevator pitch or product description.

| Public claim | Evidence | Confidence | Safe to publish? | Required wording |
| --- | --- | --- | --- | --- |
| ListingOS is an Expo React Native mobile app | `package.json`, `app.json`, Expo Router routes under `src/app` | High | Yes | Built with Expo SDK 57, React Native, and Expo Router. |
| GPT-5.6 analyzes product photos | `worker/index.ts` calls `/v1/responses` with `input_image`; default model constant is `gpt-5.6-luna` | High | Yes | GPT-5.6 analyzes product photos through the OpenAI Responses API. |
| Model output is structured and validated | Both draft and card OCR calls use strict JSON Schema; public draft payload is parsed by Zod | High | Yes | GPT-5.6 returns strict structured output that the Worker validates before persistence. |
| Draft generation is asynchronous | Upload batches, draft jobs, Cloudflare Queue producers/consumers, and queue status routes are implemented | High | Yes | Draft generation runs asynchronously while the seller continues from Home. |
| Photo intake is review-first | `DraftJobsCreateInputSchema` defaults `autoPublish` to `false`; current mobile intake and retry paths send `false`; a live publish remains a separate seller action | High | Yes | Photo intake creates a draft for review. In the current mobile flow, publishing starts only after the seller explicitly presses Publish. |
| Cloudflare is the backend platform | Deployed Worker plus configured D1, R2, KV, and three Queues; `/health` reports all configured | High | Yes | Backed by Cloudflare Workers, D1, R2, KV, and Queues. |
| Sellers connect their own eBay accounts | OAuth connect/callback flow, encrypted token persistence, Identity lookup, and seller session routes are implemented | High | Yes | Sellers connect with eBay OAuth and publish through their own account. |
| ListingOS publishes real fixed-price listings | Inventory item, offer, and publish calls are implemented; production Worker uses `EBAY_USE_SANDBOX=false`; published D1 attempts contain real listing/offer IDs | High | Yes | Publishes verified fixed-price listings through eBay's Inventory API. |
| Listing images are buyer-reachable | Photos are first sent through eBay's Media API and replaced with returned eBay-hosted URLs before Inventory publish | High | Yes | Media is ingested by eBay before publish so buyer-facing galleries use eBay-hosted images. |
| Pricing uses eBay comparables | Browse text search and image search are implemented, with exact-match filtering and active-listing price aggregation | High | Yes, qualified | Uses active eBay comparable listings and image-search candidates; it does not claim sold-comps data. |
| Graded-card identity is guarded | OpenAI label OCR, PSA cert lookup, Pokémon catalog resolution, identity confidence gates, and exact-comp requirements are implemented | High | Yes | Cross-checks graded cards against PSA, catalog, and eBay evidence; weak identity locks pricing for review. |
| Blockers are resolved in-app | Seller readiness, required-aspect verification, policy/location resolution routes, and inline actions are implemented | High | Yes, qualified | Surfaces eBay blockers inline and resolves supported policy, location, and aspect issues in-app. |
| The seller can edit before publishing | Review supports title, price override, strategy, category, condition, specifics, description, photo order, and lead photo | High | Yes | One review screen keeps AI defaults editable before verify and publish. |
| Judges can test without mutating eBay | Proof Mode uses local fixtures, bypasses authenticated fetches, disables marketplace mutations, and preserves local edit/blocker-repair behavior | High | Yes, qualified | Proof Mode is a non-mutating product walkthrough. Its photos, review fields, prices, and comparable rows are illustrative; stored publish metadata is historical evidence from a separate verified Android run. |
| Background completion can notify the seller | Device token registration, Expo Push delivery, Worker publish notifications, and Android delivery proof exist | Medium | Yes, qualified | Android background publish alerts were verified; iOS delivery still requires device-level confirmation. |
| RevenueCat subscriptions are live | SDK integration, backend usage metering, entitlement sync routes, webhook validation, and enforcement exist; production store products are not finalized | High | No as a launch claim | RevenueCat-backed metering is implemented, but production subscription products remain launch work. |
| ListingOS Market is an end-to-end buyer channel | An experimental public listing/feed and seller-controlled beta publish surface exists, but inquiry is controlled-demo-only, email delivery is unconfigured, and the native seller inbox/reply flow is not implemented | High | No as an end-to-end claim | An experimental ListingOS Market public-listing beta exists. eBay remains the only verified external publish channel; do not claim verified inquiry delivery, seller inbox, seller replies, or a complete marketplace flow. |
| Auction publishing is supported | Shared contracts include auction mode, but no verified Trading API publish adapter is active | High | No | Fixed-price is the verified MVP; auction publishing is roadmap work. |
| Image enhancement is automatic | AI returns an enhancement plan, but transformed variants are not generated | High | No | AI recommends honest image improvements; automated transforms are roadmap work. |
| Local asking-price signals from OfferUp | `worker/index.ts` queries `offerup.com/search` and resolves item detail URLs; surfaced as supplementary seller context in `src/screens/draft-detail-screen.tsx` | High | Yes, qualified | Shows local asking-price signals for extra context. These are asking prices, not sold data, and do not affect eBay publish safety. |
| Capture quality is scored on device | `src/shared/contracts.ts` defines `qualityScore`, `blurScore`, and `exposureScore`; capture surface computes them | High | Yes, qualified | Scores blur, exposure, and detail at capture time as guidance. Quality scores never block the listing pipeline. |
| Deterministic listing-strength audit | `src/lib/listing-opportunity.ts` computes the opportunity audit rendered on the review screen | High | Yes | A deterministic opportunity audit scores listing strength on the review page. It is rule-based, not model output. |
| Sony monitor-mode import | `CaptureSourceSchema` includes `sony_monitor`; the app auto-imports camera-roll photos, sets device model and `monitor_plus_v1` profile, and opens a capture session persisted in `camera_capture_sessions` (migration `0004`) | High | Yes, qualified | Imports photos shot on a Sony body and keeps them grouped as one capture session. This is import, not camera control. |
| Sony remote camera control | `sony_remote` exists in the capture-source enum with a `sony_remote_v1` profile, but the app returns "Remote camera control is not enabled yet" | High | No | Tethered Sony control is roadmap work. Do not imply the app operates the camera. |
| On-device vision object detection | `src/lib/vision/yolox.ts` exists and the Worker accepts a vision context, but the YOLOX runtime is **not linked into the Android release build** (JSI/native startup and alignment risk); the web build throws by design | High | No | Do not claim on-device object detection. On-device work in the release build is photo-quality scoring only. |
| On-device hints are advisory | Worker prompt states on-device observations are probabilistic hints only and must be cross-checked against marketplace and catalog evidence | High | Yes | On-device observations are hints; identity, condition, and pricing evidence still come from validated model output intersected with marketplace data. |
| Listings reach review in under one minute | Prior device runs reached a usable draft in roughly 40 seconds, but latency varies with network and providers | Medium | Only as demo evidence | In the recorded run, the draft reached review in under one minute. Do not promise a universal SLA. |

## Verification Snapshot

- Public Devpost project, production web app, Worker health, support, privacy, public GitHub
  repository, and TestFlight invite checked July 21, 2026.
- Worker health returned HTTP 200 with OpenAI, eBay, storage, queues, D1, analytics,
  RevenueCat REST trust, and RevenueCat webhook authorization configured. This does not
  prove that production subscription products are purchasable.
- The public web app returned HTTP 200, but the deployed build did not visibly expose Proof
  Mode during the July 21 audit. Treat the judge path as pending until the dedicated proof
  build is deployed and rechecked signed out.
- The current public YouTube upload is playable but contains an accidental duplicate take
  after the polished ending. A verified 2:30 replacement exists locally; the external upload
  and Devpost URL swap remain pending.
- No obvious committed API key or private-key patterns were found in the tracked tree.
- Full automated unit, integration, and device E2E suites are not yet present; do not claim automated coverage.
