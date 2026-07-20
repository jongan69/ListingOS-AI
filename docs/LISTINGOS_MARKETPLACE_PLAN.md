# ListingOS Market Beta: Build Week Execution Plan

## Decision

Build an owned ListingOS marketplace channel inside the current project. Do not fork the app before the hackathon.

The Tuesday deliverable is **ListingOS Market Beta**, a public listing and seller-inquiry channel that works with or without eBay:

1. A seller signs into ListingOS without needing an eBay account.
2. The seller photographs an item and reviews the existing AI-generated draft.
3. The seller publishes to ListingOS Market, eBay, or both.
4. Anyone can open the ListingOS listing in a browser.
5. A verified buyer can message the seller.
6. The seller receives the inquiry in the native app and can reply.
7. An eBay-connected listing also offers a clear Buy on eBay action.

This is not a checkout marketplace yet. ListingOS helps people create inventory, discover items, and start a conversation. It does not process payments, provide escrow, arrange shipping, guarantee identity, or mediate the transaction.

## Why This Is The Right Hackathon Move

The owned channel changes the story from "an easier eBay listing form" to "an AI seller operating system that can create inventory once and activate multiple routes to a sale."

It also resolves the current cold-start problem for new sellers. A user can get value before creating an eBay account, while eBay remains the strongest transaction destination for users who want its buyer demand and commerce infrastructure.

The defensible product is not the small marketplace feed by itself. It is the shared listing intelligence, evidence, media, safety, and channel-adapter layer that can publish the same reviewed item into ListingOS Market today and additional destinations later.

## Hard Product Boundary

### Must Ship By Tuesday

- First-party ListingOS email sign-in for sellers, independent of eBay OAuth.
- Optional Connect eBay action after ListingOS sign-in.
- Destination selection on a reviewed draft: ListingOS Market, eBay, or both.
- Public responsive ListingOS Market feed.
- Public responsive listing detail page with shareable URL.
- Seller-controlled publish, unpublish, and mark-sold actions for ListingOS Market.
- Text-only buyer inquiry flow with verified email.
- Native seller inbox, thread view, reply, unread state, and refresh.
- Seller push notification for a verified new inquiry when credentials permit it.
- Email notification and secure return link for buyer replies.
- Block, report, close-thread, rate-limit, and message-length controls.
- Clear transaction and safety disclaimer.
- An eBay CTA when the item is also published to eBay.
- An end-to-end fixture path that never performs a live eBay mutation.

### Explicitly Not Shipping By Tuesday

- Payments, checkout, escrow, wallet, tax, refunds, or fees.
- Shipping labels, shipping quotes, order tracking, or fulfillment.
- Binding offers, auctions, negotiation state machines, or deposits.
- Ratings, reviews, seller verification badges, or buyer reputation.
- File, photo, audio, or video attachments in messages.
- Typing indicators, read receipts, presence, group chat, or voice calling.
- Exact-address display, geolocation tracking, or map-based nearby search.
- Automatic moderation claims or a promise that messages are continuously reviewed.
- Durable Object/WebSocket real-time chat.
- Automatic cross-channel delisting based only on a conversation.
- A Shopify, Amazon, OfferUp, or Facebook Marketplace adapter.

## Truth And Safety Boundary

Messaging content does matter operationally even when ListingOS does not handle the sale. ListingOS is still transporting the conversation, storing personal data, and exposing users to possible spam or fraud. The beta therefore needs a narrow but real safety layer.

- Require email verification before the first buyer message is delivered.
- Store message bodies as plain text and escape all rendered output.
- Limit messages to 1,500 characters.
- Do not support attachments or inline HTML.
- Do not expose seller email, buyer email, phone number, or exact address publicly.
- Use city/region only for the public location label.
- Apply per-IP, per-email, per-listing, and per-thread rate limits.
- Validate Cloudflare Turnstile on public inquiry creation.
- Give both parties a visible Block and Report path.
- Let the seller close a thread and unpublish or mark an item sold.
- Show a warning before users leave ListingOS or share sensitive contact/payment information.
- State that ListingOS does not verify counterparties, hold funds, guarantee delivery, or resolve disputes.

No automated content moderation claim should be added before it is implemented and tested. Basic pattern-based link and phone warnings are acceptable as non-authoritative friction, not as a safety guarantee.

## Current Architecture Gap

The current app session is created as a side effect of eBay OAuth. `app_sessions.seller_account_id` is required, and the existing `users` and `seller_accounts` records are populated from eBay identity. That means the app currently cannot create a seller workspace for someone who declines eBay.

For the deadline, preserve the existing tables and add first-party identity alongside them rather than rewriting every draft foreign key:

1. Add email and display-name fields to the existing user record.
2. Create a ListingOS user and seller workspace after verified email sign-in, using a generated internal handle rather than exposing the email address.
3. Allow the eBay credential fields on that workspace to remain empty.
4. Issue the existing bearer-style app session for the ListingOS workspace.
5. Change Connect eBay so an authenticated ListingOS user attaches eBay credentials to the current workspace instead of creating a second identity.
6. Keep the existing fixed-price eBay publishing adapter unchanged except for the optional-connection guard.

This is the least disruptive path because drafts, uploads, billing, notifications, and publish attempts already belong to `seller_account_id`.

## Identity Flow

### Seller

1. Seller enters email and display name in the native app.
2. Worker creates a short-lived verification challenge whose code is protected with a server-side HMAC secret.
3. Worker sends a six-digit code through the configured email provider.
4. Seller submits the code.
5. Worker creates or loads the ListingOS user and seller workspace.
6. Worker creates a seven-day app session and returns the bearer token.
7. Seller may connect eBay later from Channels.

### Buyer

1. Buyer opens a public listing and enters name, email, and the first message.
2. Worker validates Turnstile and rate limits the request.
3. Worker creates a pending inquiry and emails a one-time verification link.
4. Buyer opens the link; Worker verifies the token and activates the thread.
5. Only then does the seller receive the message and notification.
6. Buyer receives a secure, thread-scoped browser session in an HttpOnly, Secure, SameSite=Lax cookie.
7. Seller replies in the app; buyer receives an email and can return to the browser thread.

Buyer access is thread-scoped for the beta. A full buyer profile, social login, and buyer mobile app can come later.

## Data Model

Add one migration, tentatively `worker/migrations/0009_listingos_market.sql`.

### Existing Table Extensions

`users`

- `email_normalized TEXT`
- `email_verified_at TEXT`
- `display_name TEXT`
- unique index on non-null `email_normalized`

`seller_accounts`

- `ebay_connection_status TEXT NOT NULL DEFAULT 'disconnected'`
- `ebay_connected_at TEXT`
- unique partial index on non-null `ebay_user_id` to prevent one eBay account from attaching to multiple ListingOS workspaces

### New Tables

`email_auth_challenges`

- `id`, `email_normalized`, `display_name`
- `verification_code_hmac`, `expires_at`, `consumed_at`
- `verification_attempts INTEGER NOT NULL DEFAULT 0`
- `created_at`, `updated_at`

The existing `auth_sessions` table remains dedicated to eBay OAuth. When an authenticated ListingOS user starts eBay connection, its existing `user_id` field records the workspace that should receive the resulting credentials.

`market_listings`

- `id`, `draft_id`, `seller_account_id`, `slug`
- `status`: draft, live, sold, ended
- public snapshot: title, description, price, currency, condition, category label
- public seller display name and coarse location label
- optional eBay listing URL
- `published_at`, `ended_at`, `created_at`, `updated_at`
- unique constraints on `draft_id` and `slug`

`market_listing_photos`

- `listing_id`, `photo_id`, `sort_order`
- references the existing photo records and public Worker photo route

`market_threads`

- `id`, `listing_id`, `seller_account_id`, `buyer_identity_id`
- `status`: pending_verification, open, closed, blocked
- `last_message_at`, `created_at`, `updated_at`
- one thread per buyer identity per listing for the beta

`market_buyer_identities`

- `id`, normalized email, display name, verified timestamp
- email is never returned by public listing APIs

`market_messages`

- `id`, `thread_id`, `sender_kind`, optional sender account/identity ID
- plain-text body, client idempotency key, created timestamp
- index by thread and creation time

`market_buyer_sessions`

- opaque token hash, buyer identity ID, optional thread scope, expiry, revocation timestamp

`market_reports`

- reporter kind and identity, listing/thread/message target, reason, details, status, timestamps

`market_blocks`

- seller account, buyer identity, optional thread, timestamps

`market_rate_events`

- hashed subject key, action, time bucket, count, expiry
- KV may be used for fast counters, but D1 records should preserve auditable enforcement events

## API Contract

All request and response schemas must be added to `src/shared/contracts.ts` before mobile work integrates with live endpoints.

### First-Party Session

- `POST /api/session/email/start`
- `POST /api/session/email/verify`
- `POST /api/session/logout`
- `GET /api/session/me`
- `POST /api/session/ebay/connect` while authenticated to attach eBay
- `DELETE /api/session/ebay/disconnect`

### Authenticated Seller Market API

- `POST /api/market/listings/:draftId/publish`
- `POST /api/market/listings/:listingId/unpublish`
- `POST /api/market/listings/:listingId/mark-sold`
- `GET /api/market/listings/mine`
- `GET /api/market/inbox`
- `GET /api/market/threads/:threadId`
- `POST /api/market/threads/:threadId/messages`
- `POST /api/market/threads/:threadId/close`
- `POST /api/market/threads/:threadId/block`
- `POST /api/market/reports`

### Public Buyer API

- `GET /api/public/market/listings`
- `GET /api/public/market/listings/:slug`
- `POST /api/public/market/listings/:slug/inquiries`
- `GET /api/public/market/inquiries/verify`
- `GET /api/public/market/threads/:threadId`
- `POST /api/public/market/threads/:threadId/messages`
- `POST /api/public/market/reports`

Use cursor pagination for the feed, inbox, and messages. Require client idempotency keys on publish and message creation. Never return eBay tokens, internal draft payloads, email addresses, exact object keys, or internal safety metadata from public endpoints.

## Public Web Surface

Render the buyer marketplace from the Cloudflare Worker for this sprint:

- `/market`: responsive public feed
- `/market/:slug`: listing detail and verified inquiry entry point
- `/market/thread/:threadId`: buyer thread after secure verification

This is safer for the deadline than adding dynamic buyer routes to the current static Expo web deployment. It reuses the already deployed Worker, D1, R2, photo route, Turnstile, and email API boundary.

The web design should feel like ListingOS, not like a generic classifieds clone. The first viewport must communicate:

- photographed once
- AI-reviewed listing
- available directly and optionally on eBay
- clear seller identity boundary
- clear transaction disclaimer

The initial feed needs newest-first pagination and a simple category/keyword filter. Distance sorting, recommendation ranking, saved searches, and personalization are post-hackathon work.

## Messaging Delivery Architecture

Use durable D1 messages plus HTTP polling for the Tuesday build.

- Native seller inbox refreshes on focus and polls an open thread every 5 seconds.
- Buyer browser thread polls every 5 seconds while visible.
- New buyer messages enqueue seller push and email work without delaying the message response.
- Seller replies enqueue buyer email with a secure return link.
- Push deep-links to `/market/threads/:threadId` in the native app.
- If push credentials fail, the inbox and polling path still works.

Cloudflare Durable Objects and WebSocket hibernation are a sensible phase-two upgrade for real-time chat, but they add a new deployment binding, client reconnection logic, and another failure mode. They are not needed to prove the value before Tuesday.

## Listing And Inventory State

ListingOS Market and eBay are separate publication destinations that share one reviewed draft.

- Publishing to ListingOS Market snapshots the seller-approved public fields.
- Editing the draft after publication does not silently mutate the public listing; seller explicitly republishes changes.
- Publishing to eBay stores the live eBay URL on the market listing when available.
- An eBay listing marked sold or ended should eventually reconcile the ListingOS listing, but the hackathon path may use an explicit seller action.
- A conversation never marks inventory sold automatically.
- Seller can manually mark sold or unpublish at any time.
- ListingOS-only listings never claim eBay buyer protection, payment, shipping, or verification.

The existing truth boundary remains unchanged: fixed-price eBay publishing is claimable; auction publishing, sold-comps pricing, and universal iOS notification proof are not.

## Team Ownership

The leads are split by vertical feature, not by duplicating the same React Native screen twice. Each feature is shared code and is validated first on the lead's platform.

### Project Organizer: Backend, Contract, Public Web, Integration

Owns:

- `src/shared/contracts.ts`
- `src/lib/api.ts` market and identity methods
- `worker/migrations/0009_listingos_market.sql`
- `worker/index.ts` route mounting and current session integration
- new `worker/market/**` modules
- public Worker HTML/CSS/JS marketplace pages
- email provider, Turnstile, rate limits, notification dispatch
- fixture data and non-mutating demo path
- architecture, README, Devpost, QA matrix, final merge, deployment, and demo recording

Does not own:

- seller onboarding/publish presentation after contracts are frozen
- inbox/thread presentation after contracts are frozen

Deliverables:

1. Freeze schemas and endpoint fixtures before either mobile lead integrates.
2. Implement first-party identity without breaking existing eBay sessions.
3. Implement publish/unpublish/feed/listing APIs and public pages.
4. Implement inquiry verification, messages, reports, blocks, and notifications.
5. Deploy migration and Worker only after local migration and dry-run checks pass.
6. Run the final cross-platform and judge-safe integration pass.

### iOS Lead: First-Party Onboarding, Channels, Publish And Share

Owns:

- email sign-in and verification presentation
- eBay as an optional connected channel after sign-in
- destination selector on the draft review screen
- ListingOS Market publish/unpublish/mark-sold state
- public-listing success card, Open, Copy Link, and native Share actions
- iOS keyboard, autofill, secure entry, share sheet, loading, retry, and accessibility behavior
- iPhone physical-device acceptance pass

Expected files:

- `src/components/auth/**`
- `src/components/market/destination-selector.tsx`
- `src/components/market/market-publish-card.tsx`
- `src/lib/share-listing.ts`
- scoped integration in `src/screens/dashboard-screen.tsx`
- scoped integration in `src/screens/draft-detail-screen.tsx`

Constraints:

- Do not edit `src/shared/contracts.ts`, `src/lib/api.ts`, `worker/**`, or migrations.
- Use organizer-provided typed API methods and fixtures.
- Do not replace or weaken the existing eBay review/blocker path.
- Do not perform a production eBay publish as a routine UI test.

Acceptance proof:

- New seller reaches dashboard without eBay.
- Existing eBay seller can still sign in or attach the existing account.
- Seller can select ListingOS only, eBay only, or both.
- ListingOS publish returns a public URL that opens in an iOS private browser.
- Failure and retry states preserve seller edits.

### Android Lead: Inbox, Threads, Notifications And Safety Controls

Owns:

- inbox list with unread count and empty/error/loading states
- thread screen with paginated history and optimistic text reply
- close, block, and report actions
- dashboard inbox entry and unread badge
- push-notification navigation into the correct thread
- Android notification channel behavior and foreground/background handling
- Android keyboard, back navigation, offline/retry, and accessibility behavior
- physical Android acceptance pass

Expected files:

- `src/app/market/inbox.tsx`
- `src/app/market/threads/[thread-id].tsx`
- `src/screens/market-inbox-screen.tsx`
- `src/screens/market-thread-screen.tsx`
- `src/components/market/message-*.tsx`
- scoped integration in `src/screens/dashboard-screen.tsx`
- scoped changes in `src/lib/notifications.ts`

Constraints:

- Do not edit `src/shared/contracts.ts`, `src/lib/api.ts`, `worker/**`, migrations, or the draft publish surface.
- Use organizer-provided typed API methods and fixtures.
- No attachment picker, read receipts, typing state, or WebSocket dependency.
- Failed sends must remain visibly retryable and must not duplicate messages.

Acceptance proof:

- Verified inquiry appears in the seller inbox.
- Unverified inquiry never notifies the seller.
- Seller reply appears once, survives refresh, and reaches the buyer thread.
- Push tap opens the correct conversation on a development/release build.
- Polling still works when push is unavailable.
- Blocked buyer cannot send another message.

### Shared File Rule

`src/screens/dashboard-screen.tsx` is the only planned shared mobile integration file. The iOS lead owns the auth/channel section; the Android lead owns the inbox badge/entry section. Each engineer must commit that file separately and announce the exact line-level area before editing. The organizer resolves the final integration only after both feature commits exist.

No engineer may casually reformat shared files. No lead changes contracts, API method signatures, migration names, or Worker response shapes without organizer approval.

## Contract Freeze And Parallel Work

### Organizer First Two Hours

1. Add schemas for session, market listing, feed, thread, message, report, and publish result.
2. Add typed methods to `src/lib/api.ts`.
3. Provide fixture JSON for every happy, empty, blocked, expired, and failure state.
4. Publish the final endpoint and enum names in this document.

### Leads Start Immediately Against Fixtures

The mobile leads should not wait for deployed backend endpoints. They build against typed fixtures behind a development-only adapter. The organizer then swaps fixtures for the same contract-backed API implementation.

Fixtures must never activate live eBay publishing, and Proof Mode must remain visibly non-mutating.

## Sprint Schedule

### Saturday, July 18: Freeze The Spine

- Organizer: contract, migration, email provider proof, Turnstile keys, identity endpoints.
- iOS: onboarding, verification, destination-selector fixtures.
- Android: inbox and thread fixtures, notification route design.
- Exit gate: both leads render all fixture states and contract names stop changing.

### Sunday, July 19: Make The Owned Channel Real

- Organizer: public feed/detail, market publish/unpublish, photo references, seller listing APIs.
- iOS: live first-party sign-in and ListingOS-only publish integration.
- Android: live inbox/thread reads and replies.
- Exit gate: incognito public listing plus seller app round trip works without eBay.

### Monday, July 20: Complete Messaging And Both-Destination Story

- Organizer: verified inquiry, email return link, rate limits, report/block, push dispatch.
- iOS: both-destination publish, share/open flow, physical-device hardening.
- Android: push deep-link, report/block, retry/idempotency, physical-device hardening.
- Exit gate: buyer inquiry to seller reply works end to end; eBay path has not regressed.

### Tuesday, July 21: Freeze, Prove, Submit

- No new product features.
- Fix only P0 demo, security, data-loss, or submission blockers.
- Run all automated gates and the physical-device matrix.
- Record the final video before the internal 12:00 PM PT code freeze.
- Verify YouTube visibility in an incognito window.
- Finish Devpost, feedback session ID, team invitations, and final submission before 5:00 PM PT.

## End-To-End Acceptance Gates

### Identity

- A new email user can enter the app without eBay.
- Verification codes expire, are attempt-limited, and are stored only as server-secret HMAC values.
- Existing eBay users are not duplicated when they connect through the new account flow.
- Logout revokes the app session.

### ListingOS Market

- A reviewed draft publishes to one canonical public URL.
- Public URL works without authentication in an incognito browser.
- Public response exposes no bearer tokens, private object keys, emails, or exact address.
- Seller can unpublish and mark sold.
- An eBay-connected listing shows a valid eBay CTA; a ListingOS-only listing does not.

### Messaging

- Buyer cannot notify seller before email verification.
- Duplicate submit/retry produces one message.
- Seller receives inbox update even if push is unavailable.
- Buyer and seller can exchange at least three messages across refreshes.
- Block stops future delivery; report creates an auditable record.
- Rendered message text cannot inject HTML or script.

### Regression

- Camera/photo input still creates a draft.
- Existing evidence-first review and blockers remain visible.
- Fixed-price eBay publishing code path is unchanged except for connection checks.
- Proof Mode cannot create a public market listing or live eBay listing unless an explicit market demo fixture is selected.

### Required Commands

```bash
npm run check
npm run worker:check
npm run export:android
```

Also apply the new migration locally before remote deployment, verify Worker health, open the market feed and listing in a private browser, and test one physical Android plus one physical iPhone.

## Demo Story

Target a 2:40 to 2:55 final video, per `ListingOS-Hackathon-Demo-Assets/DEMO_VIDEO_SCRIPT_V2.md`.

1. **Problem, 10 seconds:** New sellers abandon selling because creating listings and choosing channels is too much work.
2. **Capture, 20 seconds:** Photograph an item once.
3. **Agent proof, 35 seconds:** Show identity confidence, evidence-backed pricing, rejected comp, and the one seller decision that matters.
4. **Destinations, 20 seconds:** Select ListingOS Market plus eBay and explain that eBay remains a real fixed-price adapter.
5. **Owned market, 20 seconds:** Open the live public ListingOS page in an incognito browser.
6. **Messaging, 30 seconds:** Buyer sends and verifies an inquiry; seller receives it and replies in the app.
7. **New-seller payoff, 15 seconds:** Show that the same ListingOS listing works without an eBay account.
8. **Codex/GPT-5.6, 20 seconds:** Show the build thread evidence and explain the specific architecture or feature built with it.
9. **Vision, 10 seconds:** Photograph once, approve exceptions, activate every viable route to a sale.

Do not spend video time pretending there is checkout, buyer traffic, auction support, or automated sold-comps intelligence. The strongest proof is the real cross-surface loop.

## Kill Order If Time Slips

Remove work in this order without breaking the core story:

1. Feed keyword/category filtering.
2. Seller mark-sold UI; retain unpublish.
3. Email notification for every later reply; retain secure buyer thread polling.
4. Native share sheet; retain Copy Link and Open.
5. Push deep-link polish; retain inbox polling and unread count.

Do not cut first-party seller identity, public listing visibility, verified first inquiry, seller reply, block/report, or the no-live-mutation proof path. Those are the minimum credible product.

## Post-Hackathon Sequence

1. Durable Object WebSockets for real-time delivery and presence.
2. Search indexing, location radius, saved searches, and recommendation ranking.
3. Inventory reconciliation from eBay sold/ended events.
4. Seller profiles, trust signals, ratings, and stronger fraud controls.
5. Structured offers and reservation state without holding funds.
6. Optional payments only after legal, tax, dispute, and operations design.
7. Additional free-to-list adapters where official APIs and account requirements permit them.
8. Shopify as a paid merchant control-plane variant, not as a fork of the core intelligence layer.

## Technical References

- Cloudflare recommends the Durable Object WebSocket Hibernation API for a later real-time chat implementation: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Turnstile requires server-side Siteverify validation; a client widget alone is not protection: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Expo SDK 57 supports push token registration and notification deep-link handling, but remote notifications require a development or release build rather than Expo Go on Android: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
- Resend documents direct email delivery from Cloudflare Workers; provider credentials and domain verification are a day-zero organizer dependency: https://resend.com/docs/send-with-cloudflare-workers

## Final Recommendation

Commit to this exact wedge: **AI listing creation plus an owned public listing plus verified seller messaging, with eBay as an optional high-trust transaction channel.**

That is meaningfully bigger than an eBay listing helper, still truthful, and small enough to prove before Tuesday. A larger marketplace feature set would make the demo less credible, not more competitive.
