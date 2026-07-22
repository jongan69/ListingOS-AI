# Web and Store-Facing Pages

Last checked: **July 21, 2026**.

## Current production routes

These routes returned HTTP 200 at https://listingos.expo.app:

| Purpose | Route |
|---|---|
| Product landing/app | / |
| App support | /app-support |
| Support alias | /support |
| Privacy | /privacy |
| Terms | /terms |
| Terms alias | /legal/terms |
| Account deletion | /deletion |
| Market beta shell | /market |
| Market listing detail | /market/[slug] |

Worker-hosted /app-support and /privacy also returned 200.

## Recommended store metadata URLs

- Support URL: https://listingos.expo.app/app-support
- Privacy Policy URL: https://listingos.expo.app/privacy
- Terms URL: https://listingos.expo.app/terms
- Account deletion URL: https://listingos.expo.app/deletion
- Marketing URL: https://listingos.expo.app/

## Important distinction

A route returning 200 proves only that the page shell is reachable. It does not prove every API behind that page is healthy.

On July 21, 2026, the Worker endpoint GET /api/public/market/listings returned HTTP 500. Therefore /market must not be treated as a working end-to-end marketplace until the Worker deployment and remote D1 migrations are repaired and verified.

## Proof Mode deployment

Enable the flag explicitly:

~~~bash
EXPO_PUBLIC_PROOF_MODE=true npm run web:deploy:production
~~~

Do not assume a script name enables Proof Mode. Native production profiles must keep it disabled.

## Store review checklist

- Public routes open without authentication.
- Support provides a monitored contact method.
- Privacy describes photo, account, marketplace, billing, and deletion behavior accurately.
- Terms do not promise Market payments or unimplemented moderation.
- Account deletion instructions match the in-app flow.
- App Store Connect has content rights, primary category, build, contact information, privacy answers, description, keywords, and support URL completed by an Admin.
