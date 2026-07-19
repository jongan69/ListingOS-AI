# Maintenance Runbook (ListingOS)

## 1) Architecture at a glance

- `src/` is the Expo app (mobile + web surface) and owns UI state.
- `worker/` is the Cloudflare Worker API and queue orchestrator.
- `src/shared/contracts.ts` is the single source of truth for API request/response contracts used by both `src` and `worker`.
- `src/lib/api.ts` is the app-facing API client; treat it as the authoritative gateway for all backend calls.
- `worker/index.ts` stores all HTTP routes and background processors; prefer keeping route behavior explicit and versioned by behavior comments.
- `worker/migrations/` is the source of truth for D1 schema changes.

## 2) Where critical flows live

- **Capture and upload entrypoint**: `src/screens/dashboard-screen.tsx`
- **Capture metadata + camera sessions**: `src/lib/camera/capture.ts`, `src/lib/api.ts`, `worker/index.ts`, `worker/migrations/0004_camera_capture_session.sql`
- **Batch creation and queue orchestration**: `POST /api/uploads/batches` in `worker/index.ts`
- **AI listing draft generation**: queue path in `worker/index.ts`
- **Draft review state machine**: queue item contract in `src/shared/contracts.ts` and UI controls in `src/screens/dashboard-screen.tsx`

## 3) Local runbook

1. `npm install`
2. `npm run check` (must pass lint, typecheck, and `expo-doctor`)
3. `cp .dev.vars.example .dev.vars` (if needed)
4. `npm run worker:dev` for API work
5. `npm run dev` (in separate terminal) for app
6. Use a native debug target for camera and publishing behavior.

## 4) Production deployment runbook

- **Worker**
  - `npm run worker:check`
  - `npm run worker:deploy`
- **App**
  - Bump app version/build metadata in `app.json` as needed.
  - Build and submit through EAS workflow for target store (iOS/Android).
  - Validate production `.expo` assets and Firebase/notification config before shipping.

## 5) DB migration safety

- New schema changes belong in `worker/migrations`.
- Never hand-edit live data manually. Add a migration and apply via:
  - `npm run db:migrate:local` for local validation
  - `npm run db:migrate:remote` for production
- For current D1 schema, camera intake support uses:
  - `upload_batches.capture_source`
  - `upload_batches.capture_session_id`
  - `upload_batches.capture_device_model`
  - `upload_batches.capture_profile`
  - `camera_capture_sessions` table

## 6) Coding guidance for future contributors

- Keep contract changes in `src/shared/contracts.ts` first, then update:
  - app callsites in `src/lib/api.ts`
  - UI consumers in `src/screens`
  - Worker response parsing + validation in `worker/index.ts`
- Prefer explicit fallback behavior in non-MVP camera branches rather than throwing.
- Keep pricing and product-fidelity protections as first-class behavior (`zero-locked` options and confidence checks are intentional safeguards).

## 7) Known non-production paths today

- `sony_remote` capture mode is intentionally placeholder-only.
- Auction publishing adapter remains present in contracts but fixed-price publish path is the validated production path.
- Async publishing persistence works through queue state; deep app background resume improvements should follow this runbook.

## 8) eBay validation recovery policy

Publish errors are converted into seller-readable blockers in `worker/index.ts` before they reach the app. Each blocker explains what eBay rejected and what the seller can do next; the raw eBay text remains in the blocker payload for debugging.

- **Safe auto-repair:** low-risk marketplace identifiers may be repaired before verification, or repaired and retried once after an eBay publish rejection, when the AI output contains explicit supporting evidence. For eBay US, a genuinely unbranded generic product can use separate item specifics `Brand=Unbranded` and `MPN=Does not apply`.
- **Never auto-repair:** card identity, PSA grade/certification, category, condition, price, visible brand, or any identifier that could change the item's identity or value.
- **Marketplace scope:** unavailable identifier values are marketplace-specific. The automatic Brand/MPN repair is intentionally gated to `EBAY_US`; other marketplaces remain in review until their supported values are implemented.
- **User experience:** `BrandMPN` is eBay's container name, not a seller-facing field. The app renders it as separate `Brand` and `MPN (manufacturer part number)` inputs with plain-language hints and an inline Apply fix action.
- **Retry behavior:** deterministic repair is attempted before verification and at most once per publish attempt. If it does not apply, the draft remains failed/editable and the seller can correct the fields without rebuilding the listing.
