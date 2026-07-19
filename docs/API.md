# API Reference

The mobile app communicates with the Cloudflare Worker using JSON over HTTPS. Shared response contracts live in `src/shared/contracts.ts` and are validated with Zod on both sides where applicable.

## Conventions

- Production base URL: `https://seller-ai-platform.jonathang132298.workers.dev`
- Authenticated routes require `Authorization: Bearer <session-token>`.
- Timestamps are ISO 8601 strings.
- Error responses use `{ "error": "message" }` and an appropriate HTTP status.
- IDs are opaque UUID strings.

## Authentication

### `POST /api/session/ebay/connect`

Creates a 15-minute OAuth session and returns an eBay authorization URL.

Response:

```json
{
  "authSessionId": "uuid",
  "authUrl": "https://auth.ebay.com/oauth2/authorize?...",
  "expiresAt": "2026-07-16T12:00:00.000Z"
}
```

### `GET /api/session/pending/:authSessionId`

Polled by the app while the seller completes OAuth. `status` is `pending`, `complete`, or `failed`. A complete response includes a seven-day app `sessionToken`.

### `GET /api/session/ebay/callback`

Public eBay OAuth callback. It validates the KV-backed state, exchanges the code, stores encrypted eBay tokens, creates the app session, and returns an HTML completion page.

Expected query parameters: `state` and `code`; eBay may return `error` instead.

### `GET /api/session/me`

Returns the authenticated seller identity and configured marketplaces.

## Uploads

### `POST /api/uploads/batches`

Creates an upload batch.

Request:

```json
{
  "marketplaceId": "EBAY_US",
  "pricingStrategy": "balanced"
}
```

`pricingStrategy` is `fast_sale`, `balanced`, or `max_profit`.

### `POST /api/uploads/init`

Registers one photo and returns a one-hour, one-time Worker upload URL.

Request:

```json
{
  "batchId": "uuid",
  "fileName": "front.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 1234567
}
```

### `PUT /api/uploads/object/:objectKey?token=...`

Uploads raw image bytes to R2. This route does not use the app bearer token; the scoped KV upload token authorizes exactly one object and is deleted after success.

### `GET /api/public/photos/:photoId`

Streams the original R2 image with a one-hour public cache header. The route is public so eBay can retrieve listing images.

## Draft Jobs

### `POST /api/drafts/jobs`

Queues processing for an uploaded batch.

```json
{
  "batchId": "uuid",
  "pricingStrategy": "balanced"
}
```

### `GET /api/drafts/jobs?batchId=:batchId`

Returns every product job in a batch. The app polls this route until jobs reach `ready`, `needs_input`, `blocked`, `published`, or `failed`.

### `GET /api/drafts/jobs/:jobId`

Returns one draft job.

## Drafts

### `GET /api/drafts/:draftId`

Returns the validated `DraftPayload`, including photos, title options, selected title, category, condition, specifics, pricing, comparables, confidence, strategies, and blockers.

### `PATCH /api/drafts/:draftId`

Updates editable draft fields. All fields are optional:

```json
{
  "selectedTitle": "Seller-edited title",
  "description": "Description",
  "category": "Hydration Packs",
  "condition": "Used",
  "conditionNotes": "Visible wear shown in photos.",
  "listingMode": "fixed_price",
  "itemSpecifics": [
    { "name": "Brand", "value": "Example" }
  ]
}
```

Providing `category` runs eBay category suggestion again; it is not treated as a raw category ID.

## Seller Readiness and Blockers

### `GET /api/seller/readiness?marketplaceId=EBAY_US`

Reads fulfillment, payment, return, and inventory-location readiness from eBay.

### `GET /api/seller/blockers?draftId=:draftId`

Returns persisted blockers for a draft. The mobile app normally receives the same blocker data in `DraftPayload` and does not need this route separately.

### `POST /api/seller/blockers/:blockerId/resolve`

Resolution payload depends on blocker type:

- policy blocker: `{ "marketplaceId": "EBAY_US" }`
- inventory location: location fields expected by the Worker/eBay adapter
- required aspects: `{ "values": { "Brand": "Example" } }`

The client re-runs verification after a successful resolution.

## Verification and Publishing

### `POST /api/listings/:draftId/verify`

Checks seller policies, inventory location, category, condition, required aspects, confidence, and listing-mode compatibility. It updates and returns the draft.

### `POST /api/listings/:draftId/publish`

Verifies again and queues an idempotent publish attempt.

Request:

```json
{
  "strategy": "balanced",
  "selectedTitle": "Optional final title",
  "listingMode": "fixed_price"
}
```

Responses:

- `200` with `queued`, `publishing`, or `published` status
- `409` when verification finds blockers
- `404` when the draft does not belong to the authenticated seller

Repeated calls return the existing active or published attempt rather than creating another listing.

### `GET /api/listings/:draftId`

Returns the most recent publish attempt:

```json
{
  "attemptId": "uuid",
  "draftId": "uuid",
  "status": "published",
  "adapter": "inventory_offer",
  "ebayListingId": "1234567890",
  "ebayOfferId": "offer-id",
  "buyerFacingUrl": "https://www.ebay.com/itm/1234567890",
  "message": "Listing published successfully."
}
```

## Status Values

### Draft job

`queued | processing | needs_input | ready | blocked | publishing | published | failed`

### Batch

`open | uploading | queued | processing | partial_ready | complete | failed`

### Publish attempt

`queued | publishing | published | failed`

## Health

### `GET /health`

Returns configuration presence for OpenAI, eBay, D1, R2, and Queues. It does not perform paid or mutating upstream calls.
