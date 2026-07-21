# ListingOS Hackathon QA Notes

Date: 2026-07-18
Device: Samsung Galaxy A16, Android release APK, package `com.jongan69.listingos`
Backend: `seller-ai-platform.jonathang132298.workers.dev`

## Scope and test rules

This sprint tested the camera/photo-to-draft path against 10 distinct product sets. Each selected set used four product photos, asynchronous upload, draft generation, queue state, review data, pricing/comps, and the `ready` or `needs_input` safety gate.

**This matrix tested drafting, not publishing.** No item in the table below was published to the live eBay account. For the state of publish evidence, see "Publish evidence" below — it is an open blocker, not a settled result.

The test assets are in `product-image-sets/`. The source photos are desktop product photos resized only for repeatable test intake. The app itself must use the original-resolution source photos for a production listing.

**Fixture folder numbers do not correspond to matrix row numbers.** The `#` column below is a record index. Row 4 (`Only Mostly Devastated` paperback) has no fixture folder, and fixtures `11-car-charger` and `12-lighter` were never run through the matrix. Do not assume `product-image-sets/0N-*` maps to row N.

## Matrix results

| # | Product set | Draft result | Confidence | Category / condition | Pricing evidence | Result / finding |
|---:|---|---|---:|---|---|---|
| 1 | Compact Canon instant camera | `fbb578a1-f5bc-428a-9e44-a092ba1fae54`, `ready` | 0.90 | Digital Cameras / Used | $32.50 balanced, 8 comps | Strong draft. Correctly called out unconfirmed battery, film, power, and function. |
| 2 | White compact camera | `d7be1e0c-6b80-44e2-a7e4-4d5f504dfc0e`, `ready` | 0.76 | UI showed Digital Cameras; payload category guess was Straps & Hand Grips / Used | $135.22, 8 weak comps; auction mode in payload | P1 category reconciliation issue. The UI and persisted AI category disagree and must converge before publish. |
| 3 | Limitless book harness run | `75e248a0-1b4a-4c80-9599-88d43b14c572`, `needs_input` | 0.18 | Misrouted to Every Other Thing / Used | $0, 0 comps | Safe failure. The picker had not indexed the intended desktop photos, so prior camera photos were selected; malformed AI output was blocked rather than published. |
| 4 | Only Mostly Devastated paperback | `e39722a1-4f95-45f9-8e15-7fc31e0fb672`, `ready` | 0.86 | Books / Used - Good | $14.70, 8 comps | Strong book draft with usable title, description, and category. |
| 5 | Why Machines Learn book | `486f27e7-a725-4e9b-821a-43ceec7a496e`, `ready` | 0.78 | Textbooks / Used | $8.27, 8 comps | Usable draft; category is plausible but should remain seller-editable. |
| 6 | White USB-C adapter | `ce9fa02b-b65d-4efd-8a6f-fa62d4b6149c`, `needs_input` | 0.42 | Cables & Adapters / Used | $9.50, 8 comps | Correct review gate. Brand, model, compatibility, and included accessories were not reliable enough to publish without review. |
| 7 | 2023 Pokemon Wartortle PSA 10 | `b5d2a162-2fb8-48e9-86ab-0c616d98d641`, `ready` | 0.87 | CCG Individual Cards / Graded - PSA Gem Mint 10 | $125, 3 comps | Strong card identity including year, set, number, and grade. Only three comps means seller review remains appropriate for pricing. |
| 8 | 2022 Pokemon GO Pikachu PSA 8 | `289d7d04-e1dd-4e3c-9ce4-e770a50dd33c`, `needs_input` | 0.72 | CCG Individual Cards / Graded | $0, 0 exact comps | Safe pricing lock. The app extracted grade 8, cert `1243182729`, set, number, and year but did not invent a price when exact comps were unavailable. The UI must show `pricing unavailable`, never a publishable `$0`. |
| 9 | Black leather wallet | `78213fd1-f06e-4fe3-9db1-e5347e631bc6`, `ready` | 0.78 | Wallets / Pre-owned | $16.50, 8 comps | Usable generic-product draft with conservative unbranded language. |
| 10 | Brown aviator sunglasses | `97b1591a-2309-46c4-80ea-353829131847`, `ready` | 0.83 | Sunglasses / Pre-owned | $26.49, 8 comps | Usable generic-product draft with editable specifics. |
| 11 | Duplicate wallet-style processing record | `bb6afa84-3d31-4f2e-9f80-b6840d573ddb`, `ready` | 0.77 | Sheaths / Used | $15.10, 8 comps | Duplicate/navigation anomaly observed while moving between the sunglasses flow and queue. This must be addressed with a product-photo idempotency key. |
| 12 | White wireless earbuds | `571c03d4-34d7-4c56-b77f-6f0f3f1251c2`, `ready` | 0.78 | Headsets / Used | $40, 8 comps | Usable draft; function and included accessories remain seller-editable. |

Summary: 12 records, 10 distinct intended product sets, 9 `ready`, and 3 `needs_input`. The matrix intentionally includes both good paths and safety-gated paths.

## Bugs and fixes

### Fixed this sprint: queue More action displaced the app

Reproduction: open the A16 release app, open the queue, tap `More` on a queue item. The `@expo/ui` BottomSheet implementation could displace the activity to the launcher without a fatal native crash, leaving the action surface unusable.

Fix: replaced only this action surface with a platform-stable React Native `Modal` and Pressable sheet. The rest of the Expo UI usage remains unchanged. The release APK was rebuilt and installed. Post-fix validation showed `com.jongan69.listingos/.MainActivity` remained top-resumed while the action sheet displayed `Open listing`, `Clear from home queue`, and `Dismiss`.

Evidence: `screenshots/qa-attempts/queue-more-sheet-fixed.png` (local-only QA history; intentionally ignored by Git).

### Open P1: category reconciliation

The white camera run displayed `Digital Cameras` in the review flow while the persisted
payload category guess was `Straps & Hand Grips`. Before any publish, the backend should
validate the final category against the generated specifics and reject or repair
contradictory category sources. The current mobile flow stops at review and requires an
explicit seller publish action; this defect is another reason to keep that boundary.

### Open P1: duplicate draft idempotency

The matrix produced an extra wallet-style draft during queue navigation. Add an idempotency key derived from the user, product session, and ordered asset IDs. Repeated submission of the same product should return the existing job instead of creating another draft.

### Open P1: unavailable pricing presentation

The Pikachu case correctly stopped because it had no exact comps, but the draft payload contains zero pricing values. The review UI must replace zero values with an explicit unavailable state and disable publish until a seller price or trustworthy comp is present.

### Process finding: Android picker indexing

ADB-pushed images were not immediately available to the native picker until a MediaStore scan was broadcast. The invalid book attempt is retained as evidence of the resulting failure. For repeatable device testing, scan each prepared asset directory before selection. This is a test-fixture requirement, not evidence that the production camera capture path is broken.

### Quality finding: reduced test assets

The QA fixture files generated a small-image warning on some photos. This is expected from the resized test copies. Production capture should preserve the original camera asset and only create a compressed upload derivative after the original is safely stored.

## Coverage checklist

- Four-photo multi-image intake: passed across the matrix.
- Camera release app launch on A16: passed.
- Queue creation and return to the main workflow: passed in the verified live run.
- Ready drafts with title, description, category, specifics, condition, pricing, and comps: passed.
- Low-confidence and missing-comps safety gates: passed.
- Card identity extraction and exact-comps refusal: passed for Wartortle and Pikachu.
- Queue action sheet stability after native UI patch: passed.
- Live eBay publish proof: **not captured in this sprint.** See "Publish evidence" below.
- Full matrix live publishing: intentionally not performed to avoid creating test listings in the seller account.
- Sony camera capture: not part of this Android-first hackathon sprint; the provider contracts remain documented separately.

## Publish evidence

This section replaces an earlier claim that a live publish "passed in the verified run." That claim was not supported by the recordings and is corrected here.

**What is true:** the product publishes real fixed-price listings. Inventory item, offer, and publish calls are implemented, the production Worker runs with `EBAY_USE_SANDBOX=false`, and published D1 attempts contain real listing and offer IDs. `../docs/CLAIMS.md` rates this High confidence and approves it for public use.

**What was missing from this July 18 sprint:** footage of a successful publish. The
continuous sprint recording ends in an eBay `BrandMPN` validation failure — recorded
honestly in [`notes/devpost-android-cut-qa.md`](notes/devpost-android-cut-qa.md) rather than
edited around. Later submission evidence is documented separately; do not treat this dated
matrix as the current video-status source.

The capability claim is defensible, but this recording alone does not prove a successful
publish. The current submission-video state lives in [`final-renders/README.md`](final-renders/README.md).

## Evidence index

All video and screenshot paths below are gitignored local artifacts. Empty in a fresh checkout.

- Reusable product fixtures: `product-image-sets/` — **tracked, present**
- Continuous demo recording: `raw-screen-recordings/listingos-full-demo-a16.mp4` — local-only. Approximately 135s, H.264, 1080x2340. This is the single source recording referenced by `DEMO_VIDEO_SCRIPT_V2.md`; earlier docs referred to it under other filenames.
- Camera-flow QA clip: `raw-screen-recordings/listingos-camera-flow-a16.mp4` — local-only
- Raw attempt captures: `raw-screen-recordings/qa-attempts/` — local-only
- Review and queue screenshots: `screenshots/qa-attempts/` — local-only, gitignored at the parent; the directory does not exist in this checkout
