# OpenAI Build Week Audit

Audit date: 2026-07-18
Submission deadline: Tuesday, July 21, 2026 at 5:00 PM PT
Audit target: public GitHub repo plus the current working tree

Official sources:

- Challenge page: `https://openai.devpost.com/`
- FAQ: `https://openai.devpost.com/details/faqs`
- Rules: `https://openai.devpost.com/rules`

This audit is Build Week-first. App Store and Play readiness are useful supporting signals, but they are not the primary pass or fail gate for the hackathon submission.

## Scorecard

| Section | Status | Evidence | Required next action |
| --- | --- | --- | --- |
| Repo access | Green | `https://github.com/jongan69/ListingOS-AI` is public, `main` is the default branch, and the repository already includes an MIT license and submission-oriented docs. | Keep the repo public through judging, or if you later make it private, share it with `testing@devpost.com` and `build-week-event@openai.com` before the deadline. |
| README and judge instructions | Green | [README.md](../README.md) already explains setup, running the app, how Codex was used, how GPT-5.6 was used, and that publishing is a real eBay marketplace mutation. | Keep public claims inside the boundaries in [CLAIMS.md](CLAIMS.md), especially fixed-price only, active comparables only, and qualified iOS notification language. |
| Demo video compliance | Red | Local candidate renders are all under three minutes, but no final public YouTube URL is documented in the repo and the strongest current master still uses synthetic narration. | Upload the final cut to YouTube, confirm audio covers what was built plus Codex and GPT-5.6 usage, and verify visibility in an incognito window before submission. |
| Codex and GPT-5.6 evidence | Green | [README.md](../README.md), [DEVPOST_SUBMISSION.md](DEVPOST_SUBMISSION.md), [DEMO_SCRIPT.md](DEMO_SCRIPT.md), and [CLAIMS.md](CLAIMS.md) consistently describe Codex workflow contribution and GPT-5.6 usage through the OpenAI Responses API. | Reuse that same wording in Devpost so the judges see one consistent story across the repo, video, and form fields. |
| Runnable proof | Green | `npm run check`, `npm run worker:check`, and `npm run export:android` passed on the audited working tree after scoping lint away from the non-product demo workbench, and the public web, health, privacy, and support endpoints returned HTTP 200 on 2026-07-18. | Retest the compatible iCloud/private-photo picker path in `src/lib/camera/capture.ts` on a physical iPhone before calling the mobile tree frozen. |
| Public links | Green | The README, checklist, store copy, and submission docs consistently point at the public repo, Devpost page, web app, support page, and privacy page, and each URL responded successfully during this audit. | Keep these URLs identical in the Devpost form and final gallery captions so judges do not see conflicting entry points. |
| Risk of accidental live mutation | Yellow | The app intentionally uses real eBay OAuth and fixed-price publishing, and the repo already warns that pressing Publish can create a real listing. | Put the same warning into the Devpost judge instructions, prefer demo video over live publish testing, and only hand judges a sandbox or disposable seller path if one actually exists. |
| Final admin steps | Red | The repo records the `/feedback` Codex Session ID `019f6944-d662-7d11-8a6d-5ecc9906c817`, but the final YouTube URL, final Devpost submit action, and any teammate invite acceptance still require manual confirmation outside the codebase. | Confirm the Devpost entry contains the repo URL, category, contribution statement, judge instructions, feedback session ID, thumbnail and gallery assets, final video URL, and final submit confirmation before Tuesday, July 21, 2026 at 5:00 PM PT. |

## Verification Snapshot

- GitHub repo visibility checked on 2026-07-18: `PUBLIC`
- Default branch checked on 2026-07-18: `main`
- Health endpoint checked on 2026-07-18: HTTP 200 with OpenAI, eBay, storage, queue, D1, and analytics configured
- Privacy endpoint checked on 2026-07-18: HTTP 200
- Support endpoint checked on 2026-07-18: HTTP 200
- Web app checked on 2026-07-18: HTTP 200
- `/feedback` session ID documented in [DEVPOST_SUBMISSION.md](DEVPOST_SUBMISSION.md): `019f6944-d662-7d11-8a6d-5ecc9906c817`
- Local final render durations checked on 2026-07-18:
  - `listingos-horizontal-demo-20260718.mp4`: `125.32s`
  - `listingos-horizontal-demo-rotato-enhanced-20260718.mp4`: `132.57s`
  - `listingos-horizontal-demo-remotion-v1.mp4`: `132.63s`
  - `listingos-devpost-android-continuous-synthetic-v1.mp4`: `135.20s`

## Notes

- The official rules page currently says the demo must be uploaded to YouTube and made publicly visible; if you choose an unlisted video based on organizer guidance, verify the link works in an incognito window and keep the safer fallback of making it public.
- The original lint failure came from `ListingOS-Hackathon-Demo-Assets/remotion`, which is a local demo-editing workbench rather than the shipping app or Worker. The quality gate excludes that folder so `npm run check` measures submission code instead of video tooling.
- The repo is strong on truthfulness. Keep that advantage by avoiding any new claims around auction publishing, sold-comps pricing, or universal iOS notification delivery.
