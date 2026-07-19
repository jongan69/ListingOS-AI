# Devpost Submission Pack

This file is the source copy for the OpenAI Build Week submission. Do not paste secrets, production seller tokens, or private eBay account data into public Devpost fields.

Canonical companion docs:

- Claim ledger: [`docs/CLAIMS.md`](CLAIMS.md)
- Demo script: [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md)
- Demo recording checklist: [`docs/DEMO_RECORDING.md`](DEMO_RECORDING.md)
- App-store copy: [`docs/APP_STORE_COPY.md`](APP_STORE_COPY.md)
- Final ship checklist: [`docs/SUBMISSION_CHECKLIST.md`](SUBMISSION_CHECKLIST.md)

## Project Overview

Project name:

```text
ListingOS
```

Elevator pitch, under 200 characters:

```text
Photos in. Listing out. ListingOS is the AI seller agent that uses GPT-5.6 to turn product photos into price-aware, eBay-verified drafts and publish them from one clean review screen.
```

Recommended category:

```text
Work & Productivity
```

Rationale:

```text
ListingOS is a productivity tool for marketplace sellers: product intake, AI listing copy, pricing guidance, blocker resolution, and direct publishing.
```

Built with tags:

```text
OpenAI, GPT-5.6, Codex, Responses API, Expo, Expo UI, React Native, Expo Router, TypeScript, Cloudflare Workers, Cloudflare D1, Cloudflare R2, Cloudflare KV, Cloudflare Queues, Hono, eBay API, eBay Inventory API, eBay OAuth, TanStack Query, Zod
```

## Project Description

```markdown
## Inspiration

Selling one-off inventory online is still strangely manual. A seller can photograph a product in seconds, but turning those photos into a complete eBay listing still means title research, category guessing, item specifics, condition notes, pricing, policy checks, and publish-blocker cleanup.

ListingOS was built around one idea: listing should feel as fast as posting a story. Shoot the item, let AI do the heavy lifting, review the exceptions, and publish.

## What it does

ListingOS is a camera-first mobile seller agent backed by Cloudflare and eBay APIs. A seller signs in with eBay, selects product photos, chooses a speed-versus-profit goal, and creates an asynchronous draft job. The Worker stores images in R2, queues draft generation, calls the OpenAI Responses API with GPT-5.6, pulls eBay marketplace context, and returns a structured listing draft.

For each product, ListingOS generates a search-ready title, buyer-ready description, condition notes, category suggestion, item specifics, pricing ladder, sales strategy, confidence score, and publish-readiness blockers. The seller returns to Home immediately while the job runs in a visible assembly line, then opens one review screen with optimistic autosave, inline blocker fixes, evidence-based pricing trust, deterministic listing strength, eBay verification, and fixed-price publishing through the eBay Inventory API.

For graded trading cards, ListingOS uses a stricter pipeline: card OCR, PSA cert verification, Pokémon catalog lookup, eBay image-search candidates, exact-match filtering, and confidence gates that lock pricing instead of guessing when evidence is weak.

For judging, ListingOS also includes a proof mode on the Home screen with fixture-backed examples for a published general item, a trust-gated graded card, and a blocker-repair flow. It is intentionally non-mutating so judges can inspect the product without needing seller OAuth or risking a live listing.

## How we built it

The mobile app uses Expo SDK 57, React Native, Expo Router, Expo UI native controls, TanStack Query, SecureStore, and Zod. The backend uses Cloudflare Workers, Hono, D1, R2, KV, and Queues. eBay OAuth is used as the seller login, and the publish path uses eBay Account, Taxonomy, Browse, Inventory, Identity, and Media APIs.

GPT-5.6 powers the listing intelligence pipeline. It receives product images plus marketplace context and returns strict structured output that the Worker validates before persistence. The prompt is tuned for marketplace-honest copy: no invented accessories, no fake condition claims, no unsupported authenticity claims, and no overconfident card identity guesses.

## How we used Codex

Codex was used as the main implementation partner. It helped design the stack, scaffold the Expo app and Worker, implement eBay OAuth and publishing, build the photo upload queue, debug Android device crashes, fix the eBay image-delivery issue, harden card identification, polish the mobile UI, create documentation, and repeatedly validate the app on a physical Android device.

The human product decisions were the seller-first direction, camera-style UX, emphasis on minimal input, fixed-price MVP scope, and the requirement that publishing must happen fully in-app against the seller's own eBay account.

## Challenges

The hardest parts were making eBay listing media reliable from a marketplace context, keeping the seller flow simple while still handling required eBay blockers, and stabilizing native Android builds after dependency changes. Another challenge was pricing trust: when a card was misidentified, the wrong comparable set produced a bad price. That led to a more conservative evidence pipeline that cross-checks AI vision against PSA, catalog data, and eBay image-search candidates.

## What we learned

The key product lesson is that sellers do not need another dashboard. They need a listing machine: photos in, a high-confidence draft out, and only the required blockers surfaced. The technical lesson is that AI seller tools need proof, not vibes: identity evidence, comp filtering, media reachability, OAuth token safety, idempotent publish attempts, and verification-before-publish behavior all matter before automation can be trusted.

## What's next

Next steps are finalizing the production RevenueCat catalog, sold-comps-based pricing, true time-to-sale calibration, background upload resume after OS termination, buyer-honest image enhancement variants, auction publishing through a Trading API adapter, and vertical playbooks for cards, sneakers, apparel, electronics, cameras, and collectibles.
```

## Required Custom Fields

Submitter type:

```text
Individual
```

Country:

```text
United States
```

Category:

```text
Work & Productivity
```

Project URL:

```text
https://listingos.expo.app
```

Code repo URL:

```text
https://github.com/jongan69/ListingOS
```

Judge test link and instructions:

```text
Web demo: https://listingos.expo.app

Repo: https://github.com/jongan69/ListingOS

Judge note: the backend Worker is deployed at https://seller-ai-platform.jonathang132298.workers.dev and the app uses real eBay OAuth and production eBay APIs. The safest testing path is the built-in proof mode on Home, which is fixture-backed and non-mutating. If you use a live seller account or a sandbox-configured Worker instead, do not press Publish against a production account unless you intend to create a real fixed-price eBay listing. The demo video remains the safest end-to-end proof surface.
```

Feedback session ID:

```text
019f6944-d662-7d11-8a6d-5ecc9906c817
```

Plugin/dev-tool instructions:

```text
Not applicable. ListingOS is a mobile seller app, not a plugin or developer tool.
```

## Devpost Progress

- Canonical launch identity is `ListingOS`.
- Devpost project is published as project `1338448`; OpenAI Build Week submission is still pending the required public demo video.
- Project title and final tagline are saved.
- Verified project story, built-with tags, production web URL, and public GitHub URL are saved.
- Submitter type, country, category, public repo, judge instructions, feedback session ID, and non-plugin status are saved.
- Jonathan Gan's public contribution statement is saved.
- Thumbnail uploaded to Devpost and available at `https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/004/909/119/datas/medium.png`.
- Public repository is available at `https://github.com/jongan69/ListingOS` with `main` as the default branch.
- Production web app is deployed at `https://listingos.expo.app`.
- A clean 3:2 gallery capture is ready at `artifacts/devpost/listingos-home-3x2.png`.

### OpenAI Build Week Submission Values

| Field | Value |
| --- | --- |
| Submitter type | Individual |
| Country | United States |
| Category | Work & Productivity |
| Repository | `https://github.com/jongan69/ListingOS` |
| Project/test URL | `https://listingos.expo.app` |
| Feedback session | `019f6944-d662-7d11-8a6d-5ecc9906c817` |
| Plugin/developer-tool instructions | Not applicable |

The project is published at `https://devpost.com/software/listingos`, but it is not yet submitted to OpenAI Build Week. The submission window closes July 21, 2026 at 5:00 PM Pacific Time. The continuous Android source recording is available locally at `ListingOS-Hackathon-Demo-Assets/raw-screen-recordings/listingos-full-demo-a16.mp4`; it still needs an honest final edit, public upload, and URL before submission.

## Jonathan Gan Contribution

```text
Jonathan Gan led product direction, seller-workflow design, visual direction, eBay account decisions, physical-device QA, and live marketplace validation. Codex served as the implementation partner across architecture, Expo and Cloudflare development, integration debugging, test loops, documentation, and submission packaging.
```

## Screenshot Plan

1. Camera-first Home with connected eBay state and the `Photos in. Listing out.` promise.
2. Product-photo selection with the speed-versus-profit control.
3. Home assembly line showing asynchronous processing while the next item can begin.
4. Complete one-page review with title, price, category, condition, specifics, confidence, and opportunity audit.
5. eBay verification/blocker resolution state.
6. Published success state with buyer-facing eBay listing proof.

Use real app captures. Crop account-specific identifiers when they are not needed to prove the workflow.

## 60-90 Second Demo Script

```text
Listing on eBay is still slower than photographing the product. ListingOS changes that.

I connect my own eBay account, choose a few product photos, and set one preference: sell faster or maximize profit. The item immediately enters a background assembly line, so I can start the next listing instead of waiting.

In the Worker, GPT-5.6 analyzes the images through the OpenAI Responses API and returns strict structured output. ListingOS intersects that with eBay category and comparable data, plus stricter identity evidence for graded cards.

The result is one editable review page: title, price, category, condition, item specifics, description, photo order, confidence, and required fixes. Before publishing, the Worker verifies the draft against eBay, sends each image through eBay's Media API, and publishes a fixed-price offer through the Inventory API.

This is a real native Expo app, a deployed Cloudflare backend, and a real eBay publish flow: photos in, verified listing out.
```

## Architecture Diagram Content

```text
Expo app
  -> eBay OAuth
  -> upload session
  -> Cloudflare R2
  -> Cloudflare Queue
  -> OpenAI Responses API with product images and strict JSON Schema
  -> eBay Browse/Taxonomy/identity evidence
  -> validated draft in D1
  -> one-page review and blocker fixes
  -> verify
  -> eBay Media API
  -> eBay Inventory API publish
  -> D1 result + Expo push notification
```

## Fallback Demo Strategy

- Keep one known-good generated draft available so the video can jump past provider latency without pretending the processing step is instant.
- Keep one already-published result available to prove listing and offer IDs without creating duplicates.
- If eBay blocks a fresh publish, show the inline blocker, its concrete fix, and the stored successful publish proof.
- Never substitute mocked marketplace data or claim a publish succeeded based only on queue acknowledgement.

## Claim Verification

Every public technical claim is mapped to code or runtime evidence in [`docs/CLAIMS.md`](CLAIMS.md).

## Remaining Submission Blockers

- Upload `artifacts/devpost/listingos-home-3x2.png` and final mobile flow captures to the Devpost image gallery if they are not already present.
- Upload a public YouTube demo under three minutes with a human-approved voiceover covering Codex and GPT-5.6. The local continuous QA candidate is `ListingOS-Hackathon-Demo-Assets/final-renders/listingos-devpost-android-continuous-synthetic-v1.mp4`; it uses synthetic macOS narration and must not be presented as Jonathan Gan's voice.
- Add the YouTube URL to the live Devpost project, then submit it to OpenAI Build Week.
- Review the Official Rules and Terms and accept the final agreement box during submission.

Before final submission, run the repo-level checklist in [`docs/SUBMISSION_CHECKLIST.md`](SUBMISSION_CHECKLIST.md).
