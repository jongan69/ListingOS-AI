# App Store Connect Review Blocker Log

## Objective

Clear all required metadata and listing fields using repository-backed values so the app can move from `Unable to Add for Review` to a valid submission state.

## Current status snapshot (2026-07-20)

- Blockers remain as listed if App Store Connect metadata is still missing in the live form.
- Support URL and privacy URL should use the Worker paths (`/app-support`, `/privacy`) while `listingos.expo.app` store-facing routes continue to return `404` in this deployed-check snapshot.

## Current App Store Connect blockers

### App Information blockers

1. Set up **Content Rights Information** in App Information.
2. Select a **primary category**.
3. Choose a **build** for submission.
4. Complete the **Contact Information** section.
5. Provide app privacy disclosures in the **App Privacy** section (admin-provided information required).

### App Store listing blockers

1. English (U.S.) **Description** is required.
2. English (U.S.) **Keywords** are required.
3. English (U.S.) **Support URL** is required.

## Code-backed values you can paste now

### Store copy source of truth

1. `store.config.json` includes title/subtitle/description/keywords/support URL/marketing URL for App Store and Play.
2. `docs/APP_STORE_COPY.md` mirrors this wording for launch and demo packaging.
3. `app.json` includes shorter general product description for app runtime.

### Title and subtitle

1. App title: `ListingOS AI`
2. Subtitle: `AI listings from photos`

### Primary/secondary category

1. Primary category: `SHOPPING`
2. Optional secondary category: `PRODUCTIVITY`

### English (U.S.) description

1. ListingOS helps eBay sellers turn product photos into complete listings without rebuilding every item from scratch.
2. Take or select photos of products, choose whether you want to sell faster or maximize profit, and let ListingOS build the draft. The app uses AI and marketplace context to generate a title, category, condition notes, item specifics, description, pricing strategy, and publish-readiness checks.
3. What ListingOS does:
4. Creates listing drafts from product photos
5. Writes buyer-ready eBay titles and descriptions
6. Suggests category, condition, and item specifics
7. Recommends pricing for fast sale, balanced sale, or max profit
8. Checks seller readiness and required eBay fields
9. Surfaces blockers in-app instead of hiding them in error messages
10. Publishes fixed-price listings from one review screen
11. Adds stricter identity and pricing safeguards for graded trading cards
12. ListingOS is built for sellers who move real inventory: resellers, collectors, side hustlers, card shops, thrift sellers, and anyone who wants to spend less time filling forms.
13. The app is intentionally simple. AI does the heavy lifting. You only step in when a marketplace rule, low-confidence identification, or seller preference truly needs a human decision.
14. Important: ListingOS is an independent seller tool and is not affiliated with or endorsed by eBay. Publishing with production credentials can create live eBay listings.

### English (U.S.) keywords

1. `ebay,seller,reseller,listing,inventory,ai,photos,marketplace,commerce,scanner,cards`

### English (U.S.) support URL

1. `https://seller-ai-platform.jonathang132298.workers.dev/app-support`

### Other required storefront fields

1. Privacy policy URL: `https://seller-ai-platform.jonathang132298.workers.dev/privacy`
2. Marketing URL: `https://listingos.expo.app` (optional)
3. App privacy disclosures: use repo evidence in `docs/PRIVACY.md` and Worker behavior.

## One-click status checks

1. A build is attached.
2. Content Rights section completed with legal source and user-generated content posture.
3. Contact information entered.
4. Privacy section updated with concrete data-handling disclosures.
5. No red errors remain on the metadata page.

## Required fields to capture

1. Store metadata in required languages (at minimum English (U.S.)).
2. Description.
3. Keywords.
4. Support URL.
5. App name/subtitle.
6. Category assignment and build selection.
7. Content Rights and privacy disclosures.
8. Contact information.

## Acceptance criteria

1. No App Store Connect listing errors remain on the pre-submission page.
2. Required localization fields for English (U.S.) are populated using the exact repo-backed strings above.
3. Content Rights, primary category, contact info, and privacy sections are complete.
4. A build is attached to submission.
5. App status advances beyond `Unable to Add for Review`.

## Blocker owners

1. App Information + metadata completion: Founder/PM Owner.
2. Privacy section + admin input: Founder/PM Owner.
3. Build selection + final validation: Android/iOS Lead + QA.

## Notes on data not in code

1. Content Rights information is not defined in repository metadata files and must be added in App Store Connect.
2. Contact information is account-level in App Store Connect and must be added there.
3. Keep claim language aligned to shipped behavior only.

## References

1. `store.config.json`
2. `docs/APP_STORE_COPY.md`
3. `docs/PRIVACY.md`
4. `app.json`
5. Apple guidance: Manage App Information and App Privacy in App Store Connect
