# ListingOS Privacy Notes

ListingOS is a camera-first AI listing tool for creating eBay listings from product photos.

## Data Used

- eBay account authorization through OAuth.
- Product photos selected by the seller.
- Listing draft data generated from those photos.
- Seller readiness data required by eBay, such as policies and inventory locations.

## Storage

- Photos are uploaded to Cloudflare R2 for listing generation and publishing.
- Drafts, jobs, publish attempts, and listing references are stored in Cloudflare D1.
- OAuth state and short-lived session cache are stored in Cloudflare KV.
- eBay tokens are stored server-side and are not embedded in the mobile app.

## AI Use

The backend sends product photos and marketplace context to the OpenAI Responses API to generate structured listing recommendations.

## Public Policy URL

The deployed Worker serves a public privacy page at:

```text
https://seller-ai-platform.jonathang132298.workers.dev/privacy
```

## Publishing Warning

Publishing creates a real eBay listing when production eBay credentials are configured. Do not publish test items against a production seller account unless you intend for the listing to go live.
