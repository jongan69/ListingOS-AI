<p align="center">
  <img src="assets/icon.png" alt="ListingOS" width="240" />
</p>

# ListingOS

ListingOS is a camera-first AI seller agent for eBay. Take or select product photos, let the app identify the item, draft the listing, price it against marketplace evidence, surface only the required fixes, and publish from one review screen.

The goal is simple: make listing inventory feel as fast as posting a story. This repository contains the Expo React Native app and the Cloudflare Worker backend. It is an independent project and is not affiliated with or endorsed by eBay.

ListingOS began as a private Next.js prototype that explored post-listing audit and recommendation workflows. The Build Week submission evolved into the current mobile-first Expo + Cloudflare architecture, while the useful deterministic audit concept was adapted into the mobile review page as an opportunity score.

## Quick Links

- Web app: [https://listingos.expo.app](https://listingos.expo.app)
- Devpost project: [https://devpost.com/software/listingos](https://devpost.com/software/listingos)
- Support page: [https://seller-ai-platform.jonathang132298.workers.dev/app-support](https://seller-ai-platform.jonathang132298.workers.dev/app-support)
- Privacy page: [https://seller-ai-platform.jonathang132298.workers.dev/privacy](https://seller-ai-platform.jonathang132298.workers.dev/privacy)
- Documentation map: [docs/README.md](docs/README.md)
- Marketplace execution plan: [docs/LISTINGOS_MARKETPLACE_PLAN.md](docs/LISTINGOS_MARKETPLACE_PLAN.md)
- Build Week audit: [docs/BUILD_WEEK_AUDIT.md](docs/BUILD_WEEK_AUDIT.md)
- Final submission checklist: [docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md)

## Current Status

The MVP supports:

- eBay OAuth for multiple sellers
- single-product and multi-product photo batches
- asynchronous AI draft generation through Cloudflare Queues
- AI-generated titles, category suggestions, condition notes, descriptions, item specifics, and pricing options
- graded trading-card safeguards with PSA cert verification, anchored Pokémon catalog lookup, eBay image-search comparables, and strict comp filtering
- OfferUp local asking-price signals for extra seller context without weakening eBay-led publish safety
- seller readiness and listing blocker checks
- optimistic upload, autosave, blocker-resolution, and publish UI
- deterministic opportunity audit on the review page, adapted from the legacy web prototype
- direct fixed-price publishing through the eBay Inventory API
- publicly reachable listing photos served from R2 through the Worker
- native capture quality checks for blur, exposure, and visual detail that never block the listing pipeline
- judge-safe proof mode with fixture-backed published, trust-gated card, and blocker-repair examples that do not require seller OAuth or a live eBay mutation

The following are not complete production capabilities yet:

- Auction publishing is represented in shared contracts, but the proven publish adapter is fixed-price Inventory API publishing.
- Pricing uses active eBay Browse API comparables, including image search for cards. It does not currently use sold-item data or a calibrated time-to-sale model.
- AI produces an image enhancement plan, but the app does not currently generate transformed image variants.
- Photo transfer continues while the app process remains alive. Uploads do not yet resume after the OS terminates the app.
- Full automated marketplace E2E coverage is still being added. Current gates are strict lint/type checks, Expo Doctor, Worker dry-run, web export, and physical-device testing.

## Submission Readiness

The repo is organized to support three external surfaces cleanly:

- Devpost and demo narrative: [docs/DEVPOST_SUBMISSION.md](docs/DEVPOST_SUBMISSION.md), [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md), and the [local demo workbench](ListingOS-Hackathon-Demo-Assets/README.md)
- App-store copy and review prep: [docs/APP_STORE_COPY.md](docs/APP_STORE_COPY.md), [docs/PRIVACY.md](docs/PRIVACY.md), and [docs/SUPPORT.md](docs/SUPPORT.md)
- Truth source for public claims: [docs/CLAIMS.md](docs/CLAIMS.md)

When in doubt, keep public language as narrow as the evidence in `docs/CLAIMS.md`.

## Judge-Safe Proof Mode

For OpenAI Build Week judging, the Home screen now includes a proof mode that opens non-mutating fixture-backed drafts:

- a published general-merchandise example
- a graded-card example that locks weak pricing instead of bluffing
- a blocker-repair example that turns a raw eBay error into a concrete fix path

This path exists so a judge can understand the complete review experience without needing a seller account or risking a live listing. It is disabled by default; enable it only in a dedicated demo build with `EXPO_PUBLIC_PROOF_MODE=true`.

## Stack

| Layer | Technology |
| --- | --- |
| Mobile | Expo SDK 57, React Native, Expo Router |
| Client state | TanStack Query, Zod, SecureStore, AsyncStorage |
| API | Cloudflare Workers with Hono |
| Database | Cloudflare D1 |
| Media | Cloudflare R2 |
| Ephemeral state | Cloudflare KV |
| Background work | Cloudflare Queues |
| AI | OpenAI Responses API |
| Marketplace | eBay OAuth, Browse, Taxonomy, Account, Inventory, and Identity APIs |

## How OpenAI Is Used

GPT-5.6 is used through the OpenAI Responses API in the Worker draft-generation pipeline. It receives product photos plus marketplace context and returns strict structured listing intelligence: title options, category, condition notes, description, item specifics, pricing context, strategy, missing information, confidence, and blocker predictions. A second high-detail structured pass is used when card-label OCR is needed.

The Worker validates model output before persistence, intersects it with eBay and vertical-specific evidence, and refuses to trust graded-card pricing when identity or comparable evidence is weak.

## How Codex Was Used

This MVP was built in a Codex-assisted workflow. Codex handled repo creation, Expo/Cloudflare implementation, Android build-debug loops, eBay API integration wiring, public image delivery fixes, documentation, and device validation. Product direction, seller workflow requirements, visual taste, and live eBay account decisions were supplied by the project owner.

## Verified Submission Evidence

- The deployed Worker health endpoint reports OpenAI, eBay, D1, R2, and Queue configuration as healthy.
- The fixed-price path has produced real eBay listing and offer identifiers through the Inventory API.
- Listing media is ingested through eBay's Media API before publishing, preventing inaccessible Worker image URLs from becoming broken buyer-facing images.
- Android and web production exports build successfully. Native Android release testing is documented in [Release and demo packaging](docs/RELEASE.md).
- Exact public-claim wording and evidence live in [Submission claims](docs/CLAIMS.md).

## Repository Layout

```text
src/
  app/                 Expo Router routes
  components/          Reusable UI and app-shell primitives
  config/              Non-secret mobile configuration
  hooks/               App-level lifecycle and navigation hooks
  lib/                 API client, storage, query, and haptic utilities
  screens/             Capture, queue, and listing-review screens
  shared/              Zod schemas shared by mobile and Worker
  theme/               Colors and gradients
worker/
  migrations/          D1 schema migrations
  index.ts             HTTP routes, queue consumer, AI, and eBay orchestration
  types.ts             Cloudflare bindings and database row types
docs/
  README.md            Role-based documentation map
assets/
  proof-mode/          Runtime fixtures for non-mutating judge flows
ListingOS-Hackathon-Demo-Assets/
  README.md            Local-only video workbench and reproducible sources
```

## Quick Start

### Prerequisites

- Node.js compatible with Expo SDK 57
- Android Studio and Android SDK for local Android builds
- A Cloudflare account with Workers, D1, KV, R2, and Queues
- OpenAI and eBay production or sandbox credentials
- Wrangler authenticated with `npx wrangler login`

### Install and validate

```bash
npm install
npm run check
```

### Run the mobile app

Use the production Worker configured in `src/config/app.ts`:

```bash
npm run dev
```

For a direct Android native build:

```bash
npm run android
```

An optional build-time API override can be placed in `.env`:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-worker.example.workers.dev
```

There is intentionally no backend URL input in the seller-facing UI.

### Run the Worker locally

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run worker:dev
```

Local Worker execution is useful for route development. OAuth callbacks, public image reachability, Queues, and real eBay publishing should be verified against a deployed Worker.

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start one clean Expo development-client server |
| `npm run android` | Build and run the native Android app |
| `npm run lint` | Run ESLint with the Expo flat configuration |
| `npm run check:docs` | Verify every tracked local Markdown link |
| `npm run typecheck` | Check mobile and Worker TypeScript projects |
| `npm run doctor` | Run Expo dependency/configuration diagnostics |
| `npm run check` | Run the standard local validation gate |
| `npm run web:verify` | Run app checks, Worker dry run, and the production web export |
| `npm run web:serve` | Serve the exported production web app locally |
| `npm run verify:submission` | Run app checks, Worker dry run, and the Android production export |
| `npm run export:android` | Produce a production Android JS export |
| `npm run export:updates` | Validate iOS and Android OTA bundles locally |
| `npm run eas:update:preview -- --message "description"` | Publish an OTA to preview testers |
| `npm run eas:update:production -- --message "description"` | Publish an approved OTA to production |
| `npm run build:android:release` | Build the standalone Android release APK |
| `npm run install:android:release` | Install the standalone APK on a connected Android device |
| `npm run open:android` | Launch the installed ListingOS app |
| `npm run worker:dev` | Start the Worker locally on port 8787 |
| `npm run worker:check` | Type-check and dry-run bundle the Worker |
| `npm run worker:deploy` | Type-check and deploy the Worker |
| `npm run worker:tail` | Stream deployed Worker logs |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run db:migrate:remote` | Apply D1 migrations to the configured remote database |

## Documentation

- [Docs index](docs/README.md)
- [Submission package](docs/DEVPOST_SUBMISSION.md)
- [Final submission checklist](docs/SUBMISSION_CHECKLIST.md)
- [ListingOS Market execution plan](docs/LISTINGOS_MARKETPLACE_PLAN.md)
- [Operations and deployment](docs/OPERATIONS.md)
- [Release and device validation](docs/RELEASE.md)

## Security

- Never expose OpenAI, eBay client, or encryption secrets through `EXPO_PUBLIC_*` variables.
- Mobile seller sessions are stored in Expo SecureStore.
- eBay access and refresh tokens are encrypted before D1 persistence.
- Current app sessions are opaque bearer IDs in D1; token hashing, explicit revocation, and abuse-rate controls remain production-hardening work.
- `.env`, `.dev.vars`, Wrangler state, native build folders, and generated output are ignored by Git.
- Publishing is a live marketplace mutation. Do not use the publish endpoint in routine UI tests.

## License

[MIT](LICENSE)
