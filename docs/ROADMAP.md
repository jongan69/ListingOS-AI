# Roadmap

This is the only document in the repo that speaks in future tense. Everything here is
**planned, not shipped.**

[`CLAIMS.md`](CLAIMS.md) is the opposite: it describes what exists today and governs every
public-facing sentence. When the two disagree, `CLAIMS.md` wins.

**Rule for public copy:** anything on this page belongs in a "what's next" or "roadmap"
section, in future tense, clearly marked. It must never appear in an elevator pitch,
product description, demo narration, or store listing as a present-tense capability.

Each area below is split three ways, because most of these are partially real and the
distinction is where accidental overclaiming happens:

- **Today** — shipped, in the release build, claimable now.
- **In the codebase, not enabled** — real code exists, but it is not wired up, not in the
  release build, or explicitly gated. **Not claimable.**
- **Next** — design intent. Not built.

---

## 1. Marketplace Channels

Today ListingOS is an eBay seller tool. The intent is for it to become a channel-agnostic
listing layer where a seller reviews an item once and routes it to several destinations.

### Today

- Publishes verified **fixed-price** listings to **eBay**, through the eBay Inventory API,
  into the seller's own account via eBay OAuth.
- Media is ingested through eBay's Media API before publish so buyer-facing galleries use
  eBay-hosted images.
- Category, item specifics, and active comparables come from eBay Taxonomy and Browse.
- `marketplaceId` is `EBAY_US` throughout.

### Experimental or in the codebase, not launch-ready

- **Auction mode** appears in the shared contracts, but no verified Trading API publish
  adapter is active. Fixed-price is the only proven path.
- **OfferUp** local asking-price signals are queried as supplementary seller context. This
  is read-only market context, not a publish destination.
- **ListingOS Market public-listing beta** has a public feed/detail surface and a
  seller-controlled beta publish path. Buyer inquiry is controlled-demo-only; email
  delivery and the native seller inbox/reply flow are not shipped. eBay remains the only
  verified external publish channel.

### Next

- **Complete ListingOS Market** — finish the first-party channel so a seller can publish to
  ListingOS, eBay, or both from the same reviewed draft. Remaining scope includes reliable
  first-party identity, verified email delivery, destination selection, abuse controls,
  and a tested buyer inquiry flow with a native seller inbox and reply path.
  Explicitly **not** a checkout marketplace: no payments, escrow, shipping, identity
  guarantees, or transaction mediation.
- **Additional destinations** behind the same channel-adapter interface.
- **Auction publishing** via a Trading API adapter, once verified.

The defensible layer is not the feed. It is the shared listing intelligence, evidence,
media, and safety pipeline underneath it — the part that makes one reviewed item
publishable to more than one place. See
[`LISTINGOS_MARKETPLACE_PLAN.md`](LISTINGOS_MARKETPLACE_PLAN.md) for the full execution plan.

---

## 2. Camera Capture

Today the proven path is mobile capture. Dedicated-camera support exists in one direction
only: importing what a real camera already shot.

### Today

- **Mobile capture** via the patched Expo Camera path — explicit shutter taps, reorderable
  photo tray, lead-photo selection, flash off, audio muted.
- **Sony monitor mode** (`sony_monitor`) — auto-imports photos from the camera roll that
  were shot on a Sony body, and tags the batch with capture source, capture session ID,
  device model, and capture profile `monitor_plus_v1`. Backed by a real
  `camera_capture_sessions` table (migration `0004_camera_capture_session.sql`).
- **On-device photo-quality analysis** — blur, exposure, and detail scoring at capture time.
  Advisory only; it never blocks the listing pipeline.

### In the codebase, not enabled

- **Sony remote mode** (`sony_remote`) — the capture source enum and the `sony_remote_v1`
  profile exist, and the app surfaces the mode, but selecting it returns
  "Remote camera control is not enabled yet." There is no shutter or settings control.

### Next

- **Tethered Sony control** — trigger the shutter and read or set camera settings from the
  app, so a seller can run a full capture session without touching the camera.
- **Session-aware multi-item capture** — one tethered session producing several separate
  drafts, using capture-session boundaries that the schema already records.
- **Broader camera support** through the same capture-source abstraction.

Note: dedicated-camera capture was deliberately out of scope for the Android-first Build
Week sprint. See [`../ListingOS-Hackathon-Demo-Assets/DEMO_TESTING_NOTES.md`](../ListingOS-Hackathon-Demo-Assets/DEMO_TESTING_NOTES.md).

---

## 3. On-Device AI

Today the listing intelligence is server-side. On-device work is limited to cheap,
deterministic image scoring. The intent is to move more perception onto the phone.

### Today

- **On-device photo-quality analysis** — cross-platform blur, exposure, and detail scoring,
  running in the Android release build.
- The Worker accepts an optional **on-device vision context** alongside uploaded photos, and
  the prompt treats those observations as *probabilistic hints only* — never as
  authoritative identity, condition, authenticity, or pricing evidence. Model output is
  still cross-checked against marketplace and catalog evidence.

### In the codebase, not enabled

- **YOLOX object detection** (`src/lib/vision/yolox.ts`) exists and the Worker ingest path
  is implemented, but the runtime is **not linked into the Android release build**. Its
  JSI/native binary caused startup and alignment risk. The web build throws by design:
  "On-device vision is available in native builds only."

### Next

- **VisionCamera + React Native ExecuTorch** as a feature-flagged migration, giving real
  on-device inference during capture rather than after it.
- **Native compatibility gate first.** The published RN ExecuTorch compatibility table
  documents React Native support through 0.85 and Expo resource-fetcher support through
  Expo SDK 55. This repo runs React Native 0.86 and Expo SDK 57, so the exact native
  combination must be proven before any feature work proceeds.
- Gates before it can become the default: capture parity, performance, thermal behaviour,
  and physical-device validation.
- Longer term: on-device pre-filtering so obvious retries, duplicates, and unusable frames
  are caught before upload, reducing latency and cost per listing.

See [`ENGINEERING_EXECUTION_PLAN.md`](ENGINEERING_EXECUTION_PLAN.md) for sprint structure
and gates.

---

## 4. Seller Copilot Companion

ListingOS and Seller Copilot could work together as optional companion products while
remaining independently useful. This would not merge the products or make either one a
prerequisite for the other.

The product boundary would stay explicit:

- **ListingOS** would own mobile capture, listing intelligence, seller review, and initial
  publication.
- **Seller Copilot** would own desktop store operations after publication, including
  optimization, orders, messages, fulfillment, and other ongoing management.

### First experiment

The first integration would be a narrow handoff rather than shared infrastructure:

- Seller Copilot would offer a **Create with ListingOS** action that displays a QR code
  and mobile deep link into the ListingOS capture flow.
- The handoff would carry only non-sensitive launch context, such as marketplace and an
  attribution source. It would never carry marketplace credentials or session tokens.
- Listings published by ListingOS would use stable SKU attribution that Seller Copilot
  could recognize.
- Seller Copilot would discover the resulting listing through its normal eBay
  reconciliation and label it as created with ListingOS before taking over post-publish
  operations.

The experiment would not introduce shared OAuth tokens, a shared database, cross-product
draft synchronization, or bundled subscriptions. Those choices would couple two products
with deliberately different storage and trust boundaries before user value is proven.

### Validation gate

Test the handoff with at least five varied products on the same connected eBay account.
The experiment would need to show that the deep link opens the correct capture state,
canceling creates no desktop state, each approved publish produces exactly one listing,
Seller Copilot reconciliation finds it without duplicates, attribution survives repeated
syncs and restarts, and unrelated listings remain unchanged.

Richer account linking or signed cross-product events would be considered only after
observed sellers repeatedly move from ListingOS capture into Seller Copilot management and
the attribution materially improves that workflow. Otherwise, the QR/deep-link handoff
would remain the complete integration.

---

## 5. Other Planned Work

- Sold-comps pricing and true time-to-sale calibration. Pricing today uses **active**
  comparables only.
- Buyer-honest image enhancement variants. Today the AI produces an enhancement *plan*; it
  does not generate transformed images.
- Background upload resume after OS termination. Today transfer continues only while the
  app process is alive.
- Production RevenueCat catalog. Metering and entitlement enforcement are implemented;
  store products are not finalized.
- iOS push delivery confirmation on a physical device. Android delivery was verified.
- Automated unit, integration, and device E2E coverage. Current gates are lint, typecheck,
  Expo Doctor, Worker dry-run, web export, and manual physical-device testing.
- Vertical playbooks for cards, sneakers, apparel, electronics, cameras, and collectibles.

---

## Wording Guide

For anyone writing public copy, these pairs are the easiest mistakes to make:

| Do not say | Say instead |
| --- | --- |
| "publishes to online marketplaces" | "publishes to eBay" — plus a roadmap line about additional channels |
| "works with your Sony camera" | "imports photos shot on a Sony body" — remote control is not enabled |
| "AI runs on your device" | "scores photo quality on device" — listing intelligence is server-side |
| "sold comps" | "active comparable listings" |
| "auction or fixed-price" | "fixed-price" |
| "enhances your photos" | "recommends image improvements" |

The pattern: **name the shipped capability precisely, then state the ambition separately in
future tense.** The roadmap is a stronger story when it is clearly labelled as one, and a
liability when it is smuggled into a present-tense sentence.
