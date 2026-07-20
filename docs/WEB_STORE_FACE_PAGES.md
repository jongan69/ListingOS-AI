# Web Store-Facing Route Evidence

## Current status snapshot (2026-07-20)

- Public web routes in this repo are implemented at the `src/app` level, and local dev checks continue to pass.
- Production `listingos.expo.app` checks for `/app-support`, `/privacy`, `/terms`, `/support`, and `/legal/terms` still return `HTTP/2 404` in this workspace snapshot, while local route checks return `200`.
- Canonical support/privacy links for App Store and support workflows remain the Worker routes:
  - `https://seller-ai-platform.jonathang132298.workers.dev/app-support`
  - `https://seller-ai-platform.jonathang132298.workers.dev/privacy`

## Scope

- Added public web routes in `src/app` only:
  - `/app-support` (canonical support page)
  - `/privacy`
  - `/terms`
  - `/support` (legacy alias → `/app-support`)
  - `/legal/terms` (legacy alias → `/terms`)
- Added shared footer links for web routes:
  - Home
  - Support
  - Privacy
  - Terms
- Kept copy constrained to shipped capabilities:
  - fixed-price eBay publishing only
  - AI assists draft generation and review
  - no guaranteed outcomes language
- Added App-Review-safe copy updates:
  - explicit manual-publish limitation wording
  - explicit no-auction/ no-guarantee language
  - no secret handling claims
- Updated copy to match the shipped workflow from `docs/APP_STORE_COPY.md` and `docs/PRIVACY.md`.
  - support scope
  - data types and storage paths (Cloudflare R2/D1/KV)
  - fixed publish warning: `Publishing with production credentials can create live eBay listings.`

## Evidence commands executed

### 1) Local web export and route smoke checks

```bash
npm run web:export
curl -I http://localhost:8081/app-support
curl -I http://localhost:8081/privacy
curl -I http://localhost:8081/terms
curl -I http://localhost:8081/support
curl -I http://localhost:8081/legal/terms
```

Observed in this workspace:

- local dev server route probes returned `HTTP/1.1 200 OK` for each required URL when running from Expo web dev server.
- `/support` and `/legal/terms` redirected through route mapping and also returned `200 OK`.

### 2) Local screenshot capture (desktop + mobile)

```bash
mkdir -p artifacts/web-store-pages
npx playwright screenshot --wait-for-timeout=5000 --full-page --viewport-size=1440,900 http://localhost:8081/app-support artifacts/web-store-pages/app-support-desktop.png
npx playwright screenshot --wait-for-timeout=5000 --full-page --viewport-size=390,844 http://localhost:8081/app-support artifacts/web-store-pages/app-support-mobile.png
npx playwright screenshot --wait-for-timeout=5000 --full-page --viewport-size=1440,900 http://localhost:8081/privacy artifacts/web-store-pages/privacy-desktop.png
npx playwright screenshot --wait-for-timeout=5000 --full-page --viewport-size=390,844 http://localhost:8081/privacy artifacts/web-store-pages/privacy-mobile.png
npx playwright screenshot --wait-for-timeout=5000 --full-page --viewport-size=1440,900 http://localhost:8081/terms artifacts/web-store-pages/terms-desktop.png
npx playwright screenshot --wait-for-timeout=5000 --full-page --viewport-size=390,844 http://localhost:8081/terms artifacts/web-store-pages/terms-mobile.png
```

Captured files:

- `artifacts/web-store-pages/app-support-desktop.png`
- `artifacts/web-store-pages/app-support-mobile.png`
- `artifacts/web-store-pages/privacy-desktop.png`
- `artifacts/web-store-pages/privacy-mobile.png`
- `artifacts/web-store-pages/terms-desktop.png`
- `artifacts/web-store-pages/terms-mobile.png`

### 3) Required command transcript before submission

```bash
npm run check
curl -I https://listingos.expo.app/app-support
curl -I https://listingos.expo.app/privacy
curl -I https://listingos.expo.app/terms
```

Observed in this workspace:

- `npm run check` currently fails on pre-existing repo warnings in `worker/index.ts`:
  - `@typescript-eslint/array-type`
  - `@typescript-eslint/no-unused-vars` (`escapeLikePattern`)
- Public URL probes for `listingos.expo.app` currently returned `HTTP/2 404` for all tested routes in this workspace snapshot, so store-submission support/terms references should stay on Worker URLs until deployment is fixed.

## Route list summary

- `src/app/app-support.tsx`
- `src/app/privacy.tsx`
- `src/app/terms.tsx`
- `src/app/support.tsx` (alias)
- `src/app/legal/terms.tsx` (alias)
- `src/app/index.tsx` (web footer links)
- `src/app/_layout.tsx` (route registrations)
