# Claims and Evidence Policy

Last reconciled: **July 21, 2026**. See [Current Implementation State](./CURRENT_STATE.md) for the authoritative release snapshot.

## Allowed claims

| Capability | Allowed wording | Required evidence |
|---|---|---|
| Capture/import | "Capture or import item photos and create a listing draft." | Recorded app flow |
| AI assistance | "AI proposes listing fields for seller review." | Draft review screen |
| Pricing | "Pricing recommendations show accepted and rejected comparable evidence." | Visible evidence cards |
| Human control | "The seller reviews and approves before publishing." | Review/publish sequence |
| eBay | "Publish fixed-price listings to eBay." | Recorded or dashboard-backed publish proof |
| RevenueCat native | "Native subscription purchase and restore flows are implemented with RevenueCat." | Source plus platform sandbox evidence before saying production-ready |
| RevenueCat web | "Web can open configured RevenueCat-hosted checkout links." | Non-empty configured links and successful return/sync flow |
| ListingOS Market | "A public Market beta exists in source for discovery and verified-buyer inquiries." | Healthy deployed feed/detail/inquiry flow before saying live |
| Privacy | "Photos and listing data are processed to provide the service." | Privacy policy and code behavior |

## Current qualification requirements

- eBay is the only implemented transactional publishing channel. Say **fixed-price**; do not claim auctions.
- ListingOS Market is discovery and inquiry only. Do not claim checkout, escrow, shipping, ratings, maps, or marketplace payments.
- Market verification is configured-code based and sends no email.
- Seller Market inbox/reply is not implemented.
- The deployed public Market feed returned HTTP 500 on July 21, 2026. Until repaired and rechecked, do not present the Market loop as production-live.
- Native RevenueCat code does not prove store product availability or successful sandbox purchases.
- Empty web purchase links mean web checkout is unavailable.
- Proof Mode is fixture-backed judge evidence, not a live eBay or Market transaction.

## Prohibited wording without new evidence

- "Fully autonomous"
- "Guaranteed accurate"
- "Works on every marketplace"
- "Publishes auctions"
- "RevenueCat works on all platforms"
- "ListingOS Market is live"
- "Verified by email"
- "Real-time messaging"
- "Payments are handled in ListingOS Market"
- "Production-ready" based only on static checks, an export, or source presence

## Evidence hierarchy

1. Public production behavior observed in a clean browser or installed release.
2. Store/dashboard artifact tied to the current build.
3. Physical-device recording tied to the current build.
4. Local end-to-end behavior.
5. Static checks and source inspection.
6. Planned behavior or mockups.

State the evidence level when a claim could otherwise be misunderstood.
