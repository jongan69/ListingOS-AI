# ListingOS Production Audit

Audit date: 2026-07-18
Repository: `jongan69/ListingOS`
Current source commit at audit: `47edac7`

## Executive assessment

ListingOS is a credible, demoable Android MVP with a verified fixed-price eBay publish path. The core product loop and the known draft correctness issues are now hardened. It is not yet a production-grade public release because billing, CI, store-console release status, and iOS notification proof still require external account work.

| Area | Assessment | Evidence |
| --- | --- | --- |
| Core Android MVP | Ready for controlled demo | A16 standalone release APK, multi-photo drafts, queue, review, verification, and prior live eBay publish proof |
| Backend operations | Healthy | Worker `/health` returned HTTP 200 with OpenAI, eBay, R2, Queues, D1, and analytics configured |
| Source quality | Green locally | Expo Doctor 20/20, lint, app/Worker TypeScript, Worker dry-run, and web export passed on `47edac7` |
| Demo package | Ready locally | Verified 1920x1080 H.264 master, QA matrix, screenshots, fixtures, and raw recordings |
| Hackathon submission | Not submitted yet | Public Devpost project exists, but the public demo URL and final submission are still open |
| Store release | Submitted | Current-source Android `1.0.1 (10)` is submitted to Google Play internal draft; iOS `1.0.1 (16)` is submitted to App Store Connect and awaiting Apple processing |
| Monetization | Not production-ready | Production RevenueCat catalog/keys/offering/webhook still require finalization |
| CI/CD | Blocked externally | GitHub Actions runs are failing before job start because the GitHub account is locked for a billing issue |

## Verified checks

- `npm run doctor`: 20/20 checks passed.
- `npm run typecheck`: app and Worker passed.
- `npm run lint`: passed with zero warnings.
- `npm run worker:check`: Worker typecheck and Wrangler dry-run passed.
- `npx expo export --platform web`: passed.
- Public web URL returned HTTP 200: `https://listingos.expo.app`.
- Public Worker health returned HTTP 200 and all configured service flags were true.
- Samsung A16 release APK launched after the queue action-sheet fix without a fatal crash in the validation window.
- The matrix tested 10 distinct product sets and produced 12 draft records: 9 ready and 3 review-gated.
- A separate real fixed-price eBay publish was verified with buyer-facing listing/media proof.
- Android publish notification delivery was verified on the physical A16.

## Release blockers

### P0: finish current-source store verification

EAS finished current-source production builds from `47edac7`: Android build `08382635-6cc9-4655-9734-bdd15d6eacff` (`1.0.1 (10)`) and iOS build `94b24fd2-6008-4529-935c-10e137251fe0` (`1.0.1 (16)`). The Android AAB is at `https://expo.dev/artifacts/eas/VkdCyMjuFRCIV0_0qgYyV3spjItzR4vSrrEFumOShyc.aab`; the iOS IPA is at `https://expo.dev/artifacts/eas/d8KsJ1-OSC9MgYxCSlEjRS0FrIr51m_feSFbPimiy_w.ipa`. Android was submitted to the internal draft track and iOS was submitted to App Store Connect; store processing, installation, and final console smoke verification remain.

### P0: restore GitHub Actions

Recent `ListingOS quality` runs fail before the job starts because the GitHub account is locked due to a billing issue. This is an account-level blocker, not a code failure. Do not call CI green until a new run executes all quality steps successfully.

### P0: finalize production billing

The production EAS environment listing reported only `GOOGLE_SERVICES_JSON`. The app defaults to RevenueCat production mode, so production iOS and Android public SDK keys, the production offering, store products, and server-side RevenueCat verification/webhook configuration must be confirmed before charging users.

### P1: known product correctness issues resolved

Resolved in `8c1ef03` and deployed in Worker version `6cd9846b-c166-49c3-9997-481632ea83e9`:

- Category reconciliation now cross-checks AI category/search/title signals against multiple eBay taxonomy suggestions.
- Duplicate submission of the same photo set reuses an active draft job through a persisted fingerprint.
- Unavailable pricing is explicitly locked and requires a positive seller-confirmed price before verification.

Live regression should still be run against a representative white-camera item and a no-comps item after the store builds are installed.

### P1: complete device/store proof

- Re-verify notifications on a physical iPhone.
- Confirm App Store Connect and Google Play internal-track status from the store consoles.
- Confirm store screenshots, support/privacy links, review notes, subscription products, and release metadata are final.
- Upload the public demo video and attach its URL to Devpost, then submit the OpenAI Build Week entry.

## Capabilities that are intentionally not launch claims

- Auction publishing is not verified; the MVP claim is fixed-price eBay publishing.
- Sold-comps pricing is not implemented; pricing uses qualified active eBay comparables.
- Automatic image enhancement variants are not generated yet.
- Background processing after OS termination is not fully proven on both platforms.
- Full automated unit, integration, and device E2E suites do not exist yet.
- Sony camera live-view/PTP integration remains a documented post-hackathon provider.

## Rotato audit

Rotato is installed locally at `/Applications/Rotato.app` (version `158beta7`). Reusable mockup templates are available in `/Users/jonathangan/Documents/Rotato Library/`, including `Fast 3 Phones.rotato`, `Phone - Fast Cut Energy.rotatotemplate`, and `Phone - Five-Label Story.rotatotemplate`. The bundled Rotato renderer successfully injected the real master into the three-phone `Fast 3 Phones (Autosaved).rotato` template and produced `ListingOS-Hackathon-Demo-Assets/rotato-exports/listingos-rotato-3phone-demo.mp4`. The final composite is `ListingOS-Hackathon-Demo-Assets/final-renders/listingos-horizontal-demo-rotato-enhanced-20260718.mp4`.

## Final release gate

The release becomes production-grade after all of these are true:

1. Current-source Android and iOS production builds are installed and smoke-tested.
2. RevenueCat production products, public keys, offering, webhook, and server verification pass a real sandbox purchase/restore test.
3. GitHub Actions completes successfully on the release commit.
4. Category reconciliation, duplicate idempotency, and unavailable-price UI are fixed and retested.
5. iOS notification delivery is verified on a physical device.
6. The public demo is uploaded, attached to Devpost, and the submission is actually submitted.
