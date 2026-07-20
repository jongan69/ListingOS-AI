# Web Store-Facing Route Evidence

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
- public URL probes for `listingos.expo.app` currently returned `HTTP/2 404` for all tested routes until a deploy of this branch is published.

## Route list summary

- `src/app/app-support.tsx`
- `src/app/privacy.tsx`
- `src/app/terms.tsx`
- `src/app/support.tsx` (alias)
- `src/app/legal/terms.tsx` (alias)
- `src/app/index.tsx` (web footer links)
- `src/app/_layout.tsx` (route registrations)
