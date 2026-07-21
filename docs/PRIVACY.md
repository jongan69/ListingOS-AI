# ListingOS Privacy Notes

ListingOS is a camera-first AI listing tool for creating eBay listings from product photos.
It also contains an experimental ListingOS Market public-listing beta. Buyer messaging is a
controlled demo surface; outbound email delivery and a native seller inbox are not shipped.

## Data Used

- eBay account authorization through OAuth.
- Product photos selected by the seller.
- Listing draft data generated from those photos.
- Seller readiness data required by eBay, such as policies and inventory locations.
- For a ListingOS Market listing: seller username, title, description, price, category,
  photo URLs, status, and a location label. Active listing snapshots are public.
- For the controlled buyer-inquiry demo: buyer email, verification/session records,
  inquiry and thread messages, and report or block requests (including submitted reasons
  and details).
- Abuse-prevention inputs such as email or connection identifiers are converted to hashed
  rate-limit keys where used. Do not submit secrets or unnecessary personal data in listing
  descriptions, messages, or report details.

## Storage

- Photos are uploaded to Cloudflare R2 for listing generation and publishing.
- Drafts, jobs, publish attempts, and listing references are stored in Cloudflare D1.
- ListingOS Market listing snapshots, buyer identities, verification sessions, inquiry
  threads/messages, reports, and blocks are stored in Cloudflare D1.
- OAuth state and short-lived session cache are stored in Cloudflare KV.
- Market session tokens are stored as hashes. Active buyer verification sessions expire;
  rate-limit state may be stored temporarily in Cloudflare infrastructure.
- eBay tokens are stored server-side and are not embedded in the mobile app.

## Public And Private Market Data

- When a seller explicitly publishes to ListingOS Market, the active listing's title,
  description, price, category, photos, seller username, and coarse location label can be
  read without signing in. The public API does not return buyer email, exact coordinates,
  private draft payloads, or eBay tokens.
- Unpublish hides a listing from the active public feed; mark-sold changes its state. These
  actions do not currently promise immediate deletion of the stored snapshot.
- A buyer email is used only for the controlled verification/session path and is not shown
  on public listings. Inquiry/thread access requires the matching verified buyer session.
- Email delivery is not configured in this build. Buyer verification fails closed unless a
  private controlled-demo code is deliberately configured on the Worker.
- Reports may be submitted without a buyer account; verified buyers may also request a
  listing block. Report reasons/details are stored for safety review.

## AI Use

The backend sends product photos and marketplace context to the OpenAI Responses API to generate structured listing recommendations.

ListingOS Market buyer emails, inquiry messages, reports, and block requests are not part of
the listing-generation prompt in the implemented flow.

## Service Providers And Disclosure

- Cloudflare hosts the Worker and stores application data in D1, R2, and KV.
- OpenAI processes product photos and listing context for AI draft generation.
- eBay receives seller-authorized listing and media data when the seller explicitly uses
  the eBay publish path.
- Active ListingOS Market snapshots are intentionally disclosed to public visitors. No
  email provider is configured for the controlled inquiry demo.

## Retention And Requests

Listing and communication records remain stored as needed to operate and audit the MVP.
Automated account deletion and fixed retention schedules are not implemented; do not claim
otherwise. Use the support URL below for an access or deletion request. Operational removal
may require deleting related records and media across D1, R2, and KV.

```text
https://seller-ai-platform.jonathang132298.workers.dev/app-support
```

## Public Policy URL

The deployed Worker serves a public privacy page at:

```text
https://seller-ai-platform.jonathang132298.workers.dev/privacy
```

## Publishing Warning

Publishing creates a real eBay listing when production eBay credentials are configured. Do not publish test items against a production seller account unless you intend for the listing to go live.
