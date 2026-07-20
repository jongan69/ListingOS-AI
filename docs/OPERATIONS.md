# Operations

## Environment Separation

The mobile app and Worker have different configuration boundaries.

### Mobile

Only public values may use Expo environment variables:

```bash
EXPO_PUBLIC_API_BASE_URL=https://seller-ai-platform.example.workers.dev
```

The default is defined in `src/config/app.ts`. There is no runtime backend URL input.

### Worker local development

Copy `.dev.vars.example` to `.dev.vars`. Never commit `.dev.vars`.

Required secrets:

- `OPENAI_API_KEY`
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_RUNAME`
- `APP_ENCRYPTION_SECRET`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_WEBHOOK_AUTH_TOKEN`

Optional values:

- `OPENAI_MODEL`
- `EBAY_DEV_ID`
- `EBAY_MARKETPLACE_ID`
- `EBAY_USE_SANDBOX`
- `PUBLIC_API_BASE_URL`

Use a random, stable `APP_ENCRYPTION_SECRET`. If it changes, existing encrypted eBay refresh tokens can no longer be decrypted. The code falls back to `EBAY_CLIENT_SECRET`, but a separate secret is preferred.

## eBay Configuration

1. Create or select an eBay application keyset.
2. Configure an eBay OAuth RuName whose accepted URL is:

   ```text
   https://<worker-host>/api/session/ebay/callback
   ```

3. Set `EBAY_RUNAME` to the RuName value, not the callback URL.
4. Ensure the consent scopes include the base API scope, `sell.account`, and `sell.inventory`.
5. Use matching sandbox credentials and `EBAY_USE_SANDBOX=true` for sandbox testing.

Production and sandbox identities, tokens, policies, and listings are separate.

## Cloudflare Resources

`wrangler.jsonc` binds:

- D1 as `DB`
- KV as `SESSION_KV`
- R2 as `UPLOADS_BUCKET`
- Queues as `PROCESS_UPLOAD_BATCH_QUEUE`, `GENERATE_DRAFT_QUEUE`, and `PUBLISH_LISTING_QUEUE`

For a new Cloudflare account or environment, create equivalent resources and replace the IDs/names in `wrangler.jsonc`. Apply migrations before serving traffic:

```bash
npm run db:migrate:remote
```

Store deployed secrets with Wrangler:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put EBAY_CLIENT_ID
npx wrangler secret put EBAY_CLIENT_SECRET
npx wrangler secret put EBAY_RUNAME
npx wrangler secret put APP_ENCRYPTION_SECRET
npx wrangler secret put REVENUECAT_SECRET_API_KEY
npx wrangler secret put REVENUECAT_WEBHOOK_AUTH_TOKEN
```

`PUBLIC_API_BASE_URL` must be the externally reachable Worker origin. eBay uses URLs under this origin to fetch listing photos.

## Local Development

### Worker

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run worker:dev
```

The local Worker listens on port 8787. Local D1 and KV state is under `.wrangler/` and is ignored.

### Expo development client

```bash
npm run dev
```

For a physical Android device over USB:

```bash
adb devices -l
adb reverse tcp:8081 tcp:8081
npm run android
```

Use one Metro process. If the same phone appears twice, disconnect the wireless ADB transport and keep the USB serial:

```bash
adb disconnect <wireless-transport-name>
```

Direct native builds are the primary Android truth surface. Expo Go is not required.

## Validation Gate

Run before deploying:

```bash
npm run check
npm run export:android
npm run worker:check
```

The checks cover:

- strict TypeScript for mobile code
- strict TypeScript for Worker code
- Expo-compatible ESLint rules
- Expo dependency and configuration consistency
- production Android bundle generation

For UI changes, also test:

- cold launch on an Android emulator
- cold launch on a physical Android device
- normal and increased system font scale
- short/narrow viewport behavior
- keyboard focus for every editable field
- safe-area clearance above gesture and three-button navigation
- background/reopen behavior for active jobs

Do not press the final publish button against a production-connected seller during routine UI testing. Use an already-published draft for read-only review testing or use eBay sandbox.

## Deploying the Worker

1. Validate code and bindings.
2. Apply pending remote migrations.
3. Deploy.
4. Inspect health and tail logs.

```bash
npm run check
npm run db:migrate:remote
npm run worker:deploy
curl https://<worker-host>/health
npm run worker:tail
```

Migration files are append-only. Add a numbered migration for schema changes; do not rewrite a migration that has already reached production.

## Release Safety

Before a real publish test:

1. Confirm the intended eBay seller username in the app.
2. Confirm marketplace, title, condition, price, quantity, policies, and all photos.
3. Open every public photo URL outside the authenticated app context.
4. Verify the draft and resolve every blocker.
5. Publish once and poll the existing attempt.
6. Confirm the returned item ID and buyer-facing URL in eBay Seller Hub.

The Worker prevents duplicate active attempts per draft, but operators should still avoid repeated manual publish testing.

## Observability

- Worker observability is enabled in `wrangler.jsonc`.
- Use `npm run worker:tail` for route and Queue events. Queue logs are structured JSON and include the available `batchId`, `jobId`, `draftId`, and `attemptId` correlation fields.
- Queue events use `queue.item.started`, `queue.item.completed`, and `queue.item.failed`. Failed publish messages retry; failed upload-processing and draft-generation messages are recorded as terminal failures for explicit retry from the app.
- D1 `publish_attempts` is the source of truth for publish state.
- D1 `draft_jobs` and `upload_batches` are the source of truth for background generation state.
- The internal listing analytics route resolves AI operations by both `draft_id` and the draft's originating job, including historical operations written before the draft ID existed.
- D1 `device_push_tokens` stores active Expo push tokens for publish-complete and needs-review notifications.

Never log bearer sessions, eBay access/refresh tokens, OpenAI keys, or decrypted credentials.

## Troubleshooting

### App opens to a blank screen or reports an unavailable bundle

- Confirm exactly one Metro process listens on port 8081.
- Run `adb reverse tcp:8081 tcp:8081` for a USB device.
- Confirm the package is the native development build, not an unrelated Expo Go project.
- Check `adb logcat` for `Unable to load script` before changing application code.

### Photos appear in the app but are gray on eBay

- Open `GET /api/public/photos/:photoId` without authentication.
- Confirm `PUBLIC_API_BASE_URL` is the deployed Worker origin.
- Confirm the R2 object exists and has a valid image content type.
- Confirm the publish pipeline ingests each photo through eBay Media/EPS and the final inventory payload uses `i.ebayimg.com` URLs, not Worker/R2/local URLs.

### Closed-app publish notifications do not arrive

- Confirm `app.config.js` has included native push config for this build.
- Android: place Firebase `google-services.json` at the repo root, then rebuild.
- iOS: configure APNs/App Identifier credentials through EAS, then rebuild for TestFlight/App Store.
- Run `eas init` or set `EXPO_PUBLIC_EAS_PROJECT_ID` so native builds can mint Expo push tokens.
- Rebuild and reinstall the native app after changing notification credentials.
- Confirm the app has notification permission and the Android `publishing` channel exists.
- Confirm `/api/devices/push-token` writes an active row to `device_push_tokens`.
- Send a session-protected smoke test with `POST /api/devices/test-notification`; a healthy response has `expoAccepted: true` and `sentCount > 0`.
- Confirm the Worker can reach `https://exp.host/--/api/v2/push/send`; an optional `EXPO_ACCESS_TOKEN` secret can be set for authenticated push sends.
- See `docs/PUSH_NOTIFICATIONS.md`.

### OAuth never completes

- Confirm the callback URL configured for the RuName matches the Worker callback.
- Confirm the app polls the same `authSessionId` created before opening eBay.
- OAuth state expires after 15 minutes; restart sign-in after expiration.
- Check Worker logs and the `auth_sessions` row for `error_message`.

### Draft remains processing

- Inspect `upload_batches` and `draft_jobs` in D1.
- Tail Queue logs.
- Confirm all expected R2 objects exist.
- Confirm OpenAI and eBay credentials are configured in the Worker environment.

### Publish is blocked

- Call verification and inspect `DraftPayload.blockers`.
- Resolve policies, inventory location, and required aspects in-app.
- Re-run verification after each fix.
- Treat auction mode as unsupported for production until a Trading API adapter is implemented and tested.

## Dependency Audit Note

Use `npm audit` as an input, not an automatic upgrade command. Expo’s toolchain may report transitive development advisories whose suggested fix is an incompatible Expo downgrade. Do not run `npm audit fix --force`; evaluate Expo-compatible upgrades through the normal SDK upgrade process.
