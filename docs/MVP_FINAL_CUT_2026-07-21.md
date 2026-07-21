# ListingOS — Six-Hour Final Cut

**Snapshot:** 2026-07-21, final submission day

**Deadline:** 5:00 PM Pacific
**Rule:** freeze scope. Fix only safety, judge access, broken proof, and submission compliance.

[`CLAIMS.md`](CLAIMS.md) governs every public sentence. This file governs the order of work.

## The Winning Story

> Photos in. Listing out. ListingOS is a review-first AI seller agent that turns product
> photos into evidence-backed eBay drafts, explains uncertainty, and publishes a fixed-price
> listing only after explicit seller action.

The memorable feature is not generic copy generation. It is the refusal path: weak card
identity or pricing evidence stops for review instead of becoming a confident mistake.

## P0 Gates, In Order

### 1. Freeze the safe publish contract

- [ ] `npm run verify:submission` passes on the merged worktree.
- [ ] Photo intake queues a draft with `autoPublish: false`.
- [ ] Omitted `autoPublish` input defaults to `false` in the Worker contract.
- [ ] A live eBay publish still requires an explicit press on the review screen.
- [ ] No production eBay listing is created as a routine test.

This safety change is judge-worthy: camera input is not publish consent.

### 2. Put Proof Mode on the judge URL

The live site returned HTTP 200 on 2026-07-21, but the deployed HTML did not render the
Proof Mode section at the time of this audit. The Devpost story tells judges to use it, so
the deployment must match the instruction.

```sh
npm run web:export:proof
npm run web:serve
npm run web:deploy:proof
```

- [ ] Open `https://listingos.expo.app` signed out.
- [ ] Confirm all three Proof Mode scenarios are visible.
- [ ] Open each scenario and confirm the `No live eBay mutation` label.
- [ ] Exercise edit, blocker repair, and verify locally; confirm no authenticated network
      request or marketplace mutation occurs.
- [ ] Confirm the stored publish result is described as historical evidence from a separate
      run, while photos/prices/comparables are labelled illustrative.

Do not set `EXPO_PUBLIC_PROOF_MODE=true` in a native production EAS profile.

### 3. Replace the accidental video tail

The public video attached to Devpost (`I67o7B2JfYQ`) is playable and public, but YouTube
reports it as exactly 3:00. The polished presentation ends at 2:30; an unfinished duplicate
take begins immediately afterward. The Official Rules say the video should be less than
three minutes.

The intended replacement is already prepared:

`ListingOS-Hackathon-Demo-Assets/final-renders/listingos-openai-build-week-final-2m30s.mp4`

It is 150.002 seconds, H.264 1080p30 with AAC audio, and passed a full decode check. See
[`../ListingOS-Hackathon-Demo-Assets/final-renders/README.md`](../ListingOS-Hackathon-Demo-Assets/final-renders/README.md).

- [ ] Upload the 2:30 file to YouTube as **public**.
- [ ] Verify playback signed out and confirm the processed duration is below 3:00.
- [ ] Replace the video URL on Devpost.
- [ ] Keep the old upload until the new Devpost embed works.
- [ ] Confirm the music bed and third-party visuals are owned, licensed, or otherwise
      authorized.

### 4. Re-lock Devpost

The public page was verified on 2026-07-21: it resolves, uses the eBay-only pitch, embeds a
video, includes six gallery screenshots, links the public MIT-licensed repository, and is
listed under OpenAI Build Week.

- [ ] Confirm the replacement video embed.
- [ ] Confirm the repository still points to the final public commit.
- [ ] Confirm `listingos.expo.app` opens Proof Mode signed out.
- [ ] Keep the Play internal-test link secondary; it redirects signed-out judges to Google
      authentication and is not the primary no-restriction test path.
- [ ] Keep the valid public TestFlight link only as an optional device path.
- [ ] Re-open the public project page in a private window after the final save.

## What Ships In The Story

- Expo SDK 57 / React Native mobile app.
- Deployed Cloudflare Worker with D1, R2, KV, and Queues.
- GPT-5.6 through the Responses API with strict structured output and schema validation.
- Asynchronous photo-to-draft pipeline.
- Editable one-screen review and eBay requirement repair.
- Active eBay comparable context, never sold-comps claims.
- Graded-card evidence gates that lock weak pricing.
- Explicit seller-triggered fixed-price eBay publish.
- Judge-safe, fixture-backed Proof Mode with no marketplace mutations.

## Label Or Cut

| Surface | Final treatment |
| --- | --- |
| ListingOS Market public feed/publish routes | Beta/prototype only; not the winning core |
| Buyer inquiry | Cut from present-tense claims: email delivery is unconfigured and must fail closed |
| Seller inbox/reply | Cut: not implemented |
| RevenueCat | Metering and enforcement implemented; do not claim production subscriptions are available |
| OfferUp | Supplementary asking-price context only; never sold data or a publish destination |
| Sony | Import-only; never imply remote control |
| On-device AI | Photo-quality scoring only; YOLOX object detection is not in the release build |
| Auction | Roadmap only |
| Image transformation | Roadmap only; current product recommends improvements |
| iOS push | Unconfirmed on a physical release device |

## Six-Hour Allocation

| Window | Outcome |
| --- | --- |
| 0:00–1:30 | Merge safety fixes; run `npm run verify:submission` |
| 1:30–2:30 | Build and deploy judge Proof Mode; signed-out smoke test |
| 2:30–3:15 | Upload 2:30 video; verify public playback; swap Devpost URL |
| 3:15–4:00 | Final Devpost, gallery, links, rights, and claim review |
| 4:00–5:00 | One clean Android smoke pass without live publish |
| 5:00–deadline | Buffer for deployment, processing, or form failures; no new features |

## Do Not Spend The Final Hours On

- App Store Connect metadata or subscription approval unless it directly breaks the judge
  path.
- Stripe/Web Billing setup.
- Buyer messaging or seller inbox work.
- New marketplace adapters.
- A fresh production eBay publish merely for footage.
- Visual redesign that is not blocking comprehension.

The submission is already public. The remaining job is to make every judge-facing surface
agree: review first, proof before promise, and no hidden live mutation.
