# ListingOS Web Production Audit

Audit date: 2026-07-19

## Addendum (2026-07-20)

- The deployed host checks are currently inconsistent with this audit snapshot for store-facing web routes.
- Production checks in this workspace currently return `404` for:
  - `/app-support`
  - `/privacy`
  - `/terms`
  - `/support`
  - `/legal/terms`
- Worker-hosted support and privacy routes remain available:
  - `https://seller-ai-platform.jonathang132298.workers.dev/app-support`
  - `https://seller-ai-platform.jonathang132298.workers.dev/privacy`

Deployed source baseline: `9c6c7d3` on `main`

Production URL: `https://listingos.expo.app`

## Assessment

The hardened Worker, server-rendered web app, and iOS/Android OTA update are deployed from `9c6c7d3` and pass the reachable production checks. The release is operationally green except for GitHub Actions, which cannot start while the GitHub account is locked for billing, and the remaining authenticated physical-device smoke test.

## Live findings before the patch

- `/` and dynamic paths returned HTTP 200 from EAS Hosting, but the HTML was the older 1.2 KB SPA shell with a July 17 `Last-Modified` date.
- Both 1280 px desktop and 390 px mobile views overflowed horizontally by 60 px because decorative background blobs escaped the viewport.
- The page had no main landmark, no semantic heading, no image alternative text, and no meta description.
- The page exposed no browser console warnings, but the deployed artifact did not contain the current source UI.
- The Worker allowed CORS from every origin and API responses did not consistently declare `no-store` or standard hardening headers.

## Implemented hardening

- Switched Expo web output to server rendering so dynamic batch and draft URLs render on direct requests.
- Added per-route metadata, `noindex` for the authenticated seller app, a root HTML document, a branded 404 route, and global security headers.
- Added production async route splitting and a per-request TanStack Query client to avoid server-side cache sharing.
- Fixed horizontal overflow and added a main landmark, level-one headings, and image labels.
- Removed non-functional Sony controls from web while preserving them in native builds.
- Disabled fixture-backed Proof Mode by default; demo builds must explicitly opt in.
- Added web-specific notification adapters so SSR and hydration do not import unsupported native notification APIs.
- Added client schema-mismatch handling, sanitized Worker validation errors, API `no-store` headers, and a production/preview/localhost CORS allowlist.
- Added repeatable `web:export`, `web:serve`, and `web:verify` commands.
- Preserved route-specific titles, descriptions, and no-index directives after browser hydration.

## Verification evidence

- `npm run check`: passed, including ESLint, app/Worker TypeScript, documentation links, and Expo Doctor 20/20.
- `npm run worker:check`: passed; Wrangler dry-run bundled all D1, KV, R2, and Queue bindings plus `PUBLIC_WEB_APP_URL`.
- `npm run web:export`: passed with server and client route bundles.
- `npm run export:updates`: passed for runtime `1.0.1` on both iOS and Android.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
- Local production server returned HTTP 200 for `/` and HTTP 404 for an unknown route with `no-store`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer Policy, and Permissions Policy headers.
- Browser checks at 1280 px and 390 px found no horizontal overflow, no console warnings/errors, one main landmark, one level-one heading, a meta description, and no Proof Mode or Sony controls on web.
- Local Worker preflight returned `Access-Control-Allow-Origin` for `https://listingos.expo.app` and omitted it for `https://example.invalid`; unauthenticated seller APIs remained HTTP 401.
- Production Worker deployment `b8a35aa8-e226-4c3c-a964-d12c48846e71` reports healthy OpenAI, eBay, D1, R2, Queue, and analytics bindings.
- EAS Hosting deployment `0ep8fwvssn` is promoted at `https://listingos.expo.app`; `/`, direct draft, and direct batch routes return HTTP 200, unknown routes return HTTP 404, and live browser checks pass at 390 px and 1280 px without warnings or overflow.
- Preview OTA group `f94f78ce-8d5c-4f2c-b617-b564d9698b54` and production OTA group `54f359f0-1782-4b8f-8959-50b96c98d8ca` each contain iOS and Android updates for runtime `1.0.1` at commit `9c6c7d3`.

## Remaining production gates

1. Resolve the GitHub account billing lock and obtain a green `ListingOS quality` run. Run `29675960571` failed before any step started with the billing-lock annotation; the same gates passed locally.
2. Run one non-publishing authenticated smoke test on physical iOS and Android devices through eBay OAuth, photo selection/upload, draft generation, direct dynamic-route reload, sign-out, session-expiry recovery, and OTA application.
3. Add automated unit/integration coverage for API parsing, auth-session polling, CORS origin selection, and route-level error states. Current CI is build/static-analysis oriented.
4. Keep real eBay publishing outside routine web QA; use Proof Mode in a separate explicit demo build when publish evidence is required.
