# Submission Checklist

Use this file as the final polish gate before pushing ListingOS through Devpost, store-review prep, or public demo distribution.

## 1. Brand And Naming

- App name is `ListingOS` everywhere user-facing.
- Bundle/package identifiers remain `com.jongan69.listingos`.
- Deep-link scheme remains `listingos://`.
- Logo assets are current and centered across Android adaptive icon, iOS icon, favicon, splash, and README hero.
- Public links are consistent across README, store copy, Devpost copy, and app metadata:
  - Web: `https://listingos.expo.app`
  - Devpost: `https://devpost.com/software/listingos`
  - GitHub: `https://github.com/jongan69/ListingOS`
  - Support: `https://seller-ai-platform.jonathang132298.workers.dev/app-support`
  - Privacy: `https://seller-ai-platform.jonathang132298.workers.dev/privacy`

## 2. Public Claims

- Review [`docs/CLAIMS.md`](CLAIMS.md) before editing any public-facing copy.
- Do not claim sold-comps pricing unless it is live.
- Do not claim auction publishing unless the Trading API publish path is verified.
- Do not claim iOS notification delivery unless it has been re-verified on a physical iPhone.
- Keep latency claims framed as demo evidence, not universal guarantees.

## 3. Demo Package

- Demo narration matches [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md).
- Screen capture plan matches [`docs/DEMO_RECORDING.md`](DEMO_RECORDING.md).
- Marketplace execution and team ownership are documented in [`docs/LISTINGOS_MARKETPLACE_PLAN.md`](LISTINGOS_MARKETPLACE_PLAN.md).
- Working files live under [`ListingOS-Hackathon-Demo-Assets`](../ListingOS-Hackathon-Demo-Assets).
- Final gallery assets include:
  - Home hero
  - Photo intake
  - Queue / processing
  - Review screen
  - Blocker resolution or verify state
  - Published proof
- Final video is uploaded to YouTube, under 3 minutes, and visible to judges without requiring a login.
- Audio clearly explains what was built, how Codex was used, and how GPT-5.6 was used.
- If the upload is unlisted rather than public, verify it in an incognito/private window before submitting.

## 4. Devpost Fields

- Title: `ListingOS`
- Elevator pitch: current value from [`docs/DEVPOST_SUBMISSION.md`](DEVPOST_SUBMISSION.md)
- Built-with tags reflect the real stack only.
- Project URL points to `https://listingos.expo.app`
- Repo URL points to `https://github.com/jongan69/ListingOS`
- Repo remains public through judging, or if it becomes private it is shared with `testing@devpost.com` and `build-week-event@openai.com`.
- Judge instructions clearly warn that publish is a real marketplace mutation.
- Contribution statement is present and accurate.
- `/feedback` Codex Session ID is attached and matches the main build thread.
- Thumbnail and gallery images are uploaded.
- Demo video URL is attached.

## 5. Store Prep

- App Store / Play copy is sourced from [`docs/APP_STORE_COPY.md`](APP_STORE_COPY.md).
- `store.config.json` matches canonical title, subtitle, URLs, and description.
- Support and privacy URLs return HTTP 200.
- Store screenshots use the final branded UI, not placeholder builds.
- Review notes warn that production credentials can create real eBay listings.

## 6. Technical Readiness

- `npm run lint`
- `npm run typecheck`
- `npm run worker:check`
- `npm run doctor`
- Verify any remaining `expo install --check` drift is intentionally accepted or patched before release.
- Deployed Worker health endpoint returns HTTP 200:
  - `https://seller-ai-platform.jonathang132298.workers.dev/health`
- If demonstrating publish, verify buyer-facing listing media after publish.

## 7. Final Sanity Check

- No API keys, OAuth codes, seller tokens, or `.env` values appear in screenshots, docs, or the video.
- No placeholder art, dummy icons, or dead links remain.
- Copy is crisp, product-led, and consistent with the actual app.
- Submission story leads with the working loop:
  - photos
  - AI draft
  - review
  - verify
  - publish

If one thing is still soft, fix the product proof before polishing the marketing around it.
