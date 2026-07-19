# Sony A7 III + Remote Integration Plan (MVP to Scale)

This document captures a practical path to support Sony camera ingestion today using the existing Monitor+ flow and keep the codebase extensible for newer Sony Remote APIs.

## Current App State (Implemented)

- Added capture mode selector in the Dashboard:
  - `Mobile Photos` (manual)
  - `Sony Monitor` (auto-picks recent camera roll assets)
  - `Sony Remote` (placeholder for future)
- Added camera intake utility in `src/lib/camera/capture.ts`:
  - `collectPhotosForListing` imports latest photos from the device library for Sony monitor mode.
  - Falls back to manual image-picker selection when recent monitor photos are not available.
- Added capture metadata contract fields:
  - `captureSource`, `captureDeviceModel`, `captureProfile`, `captureSessionId` on `UploadBatchSchema`.
- Added Worker camera session endpoint:
  - `POST /api/camera/sessions`
  - Records a `camera_capture_sessions` row and optionally links it to a batch.
- Added migration `0004_camera_capture_session.sql` for:
  - `upload_batches` capture metadata columns
  - `camera_capture_sessions` table for future remote ingestion
- Added API client methods:
  - `api.startCameraSession(...)` for session bootstrap
  - `api.createUploadBatch(...)` now accepts capture metadata.

## Phone-Camera Parity Requirement (No Sony Needed)

The same shoot-to-listings flow must work for sellers with no external
camera at all:

- Add a `phone_camera` capture path that uses `ImagePicker.launchCameraAsync`
  for in-app photo capture (repeat capture until the seller finishes the
  shoot). Camera permission strings are now configured in `app.json` via the
  `expo-image-picker` plugin (requires a native rebuild to take effect).
- Whatever the capture source (phone camera, library picker, Sony monitor,
  future Sony remote), photos land in the same upload batch pipeline. The
  Worker now AI-partitions every batch into per-product draft jobs
  (`worker/listing-intelligence.ts` — `partitionPhotosIntoProducts`), so
  multi-product shoots work identically for all capture sources with no
  capture-source gating.
- One-press listing lives at `POST /api/listings/publish-all` (queues all
  publish-ready drafts through the existing verify/publish/blocker queue).

## MVP Objective (A7 III now)

Goal: let sellers using Monitor Plus / connected A7 III shoot in-app workflow without extra taps.

### What this does today

- User selects `Sony Monitor` mode on home screen.
- App attempts to auto-import recent camera-roll photos within a capture window.
- Listing flow remains unchanged:
  - photos upload → draft generation queue → review → publish.
- Session metadata is stored for analytics and audit.

### Acceptance criteria

- In Sony Monitor mode, selecting photos should quickly bring in recent camera photos.
- If no recent photos are available, user can still continue via manual picker.
- Every batch started from Sony mode carries capture source metadata in Worker rows.

## Next Sprint (2–3 days)

1. **Strengthen auto-import intelligence**
   - Save a capture marker timestamp before entering Sony mode.
   - Prefer assets created after marker timestamp.
   - De-duplicate with a device + local batch checksum.
2. **Background import watcher**
   - Add polling-based watcher (or native file observer where supported) during capture mode.
   - Auto-refresh photo shelf in-app after new files appear.
3. **Camera session lifecycle endpoint hardening**
   - Add `PATCH /api/camera/sessions/:sessionId` (close/error states).
   - Add `POST /api/camera/sessions/:sessionId/photos` for future push/import API from native monitor bridge.

## Future Remote Camera API Path (Phase 2+)

### Assumptions

- Sony remote APIs are available under Sony camera ecosystem for newer models.
- Different auth model and command model than Monitor Plus.

### Suggested architecture

- Keep current `capture/camera` adapter boundary.
- Add `src/lib/camera/adapters/sonyRemoteAdapter.ts` that implements the same intake contract.
- Use Worker routes for signed ingest operations:
  - `POST /api/camera/sessions` (create session)
  - `POST /api/camera/sessions/:sessionId/photos` (ingest manifest or image URLs)
  - `POST /api/camera/sessions/:sessionId/finalize`
- Keep existing immediate listing queue path unchanged once photos are stored as `batch_photos`.

## Security and production readiness

- Never persist secrets in mobile app state.
- Keep ingest endpoints authenticated via seller session.
- Validate and size-limit any remotely submitted media manifests before ingest.

## Failure handling

- Capture session failures should not block listing in manual mode.
- Metadata write failures are non-fatal in listing path when upload pipeline is healthy.
- If Sony mode auto-import fails:
  - fallback message + manual photo picker
  - batch metadata remains manual-like

## Rollout Plan

- **Now (ship)**
  - Keep Monitor path as reliable fallback and manual chooser path.
  - Ship session + capture metadata only.
- **Post-MVP**
  - Implement native bridge or remote ingest when Sony API scope is confirmed.
  - Add richer quality feedback (“live card accepted / synced”)

