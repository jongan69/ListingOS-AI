# RevenueCat Webhook Smoke Test Notes (Sandbox)

Use this for the next sandbox transaction attempt until a signed event is confirmed end-to-end.

## Required evidence to capture

- App build and platform:
  - Build type:
  - Bundle ID / app ID:
  - Device:
  - Timestamp:
- RevenueCat identity used:
  - `app_user_id` sent by app:
  - `customer_id`:
  - `package_id`:
- Webhook payload details:
  - Event type:
  - `eventId`:
  - Signed header present (`x-revenuecat-signature` or `x-revenuecat-webhook-signature`):
  - Result from `Authorization` token check:
- Worker validation outcome:
  - `billing.revenuecat_webhook.*` log event:
  - `signatureStatus`:
  - `isReplay`:
- Internal trace capture:
  - `GET /api/internal/revenuecat/webhook-traces?appUserId=...&limit=10` response:
- Billing state check:
  - `/api/billing/summary` before:
  - `/api/billing/summary` after:

## Duplicate/replay smoke check

Repeat the same event delivery payload (same `eventId`) once.

- Expected response: `{ "ok": true, "replay": true }`
- Expected log: `billing.revenuecat_webhook.replay`
- Expected billing sync call count unchanged after the replay.

## No-event scenario analysis

- If no Worker trace appears in `worker:tail`, classify as app/webhook/network path:
  - route not hit in Worker logs → webhook URL, RC webhook enabled/events config, or network ingress issue.
  - auth/signature failures only → key or header contract mismatch.
  - `replay: true` for immediate duplicate → idempotency is working as designed.

