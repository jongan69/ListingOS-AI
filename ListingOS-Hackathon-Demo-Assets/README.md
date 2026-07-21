# ListingOS Hackathon Demo Assets

Production workbench for the ListingOS demo video: script, fixtures, capture plan,
composition source, and local output folders.

The app's judge-facing runtime fixtures live separately in
[`../assets/proof-mode`](../assets/proof-mode). This workbench is for demo production,
not application runtime behavior.

## Start Here

1. **[`final-renders/README.md`](final-renders/README.md)** — the intended 2:30 YouTube
   replacement, checksum, media QA, and external handoff.
2. **[`DEMO_TESTING_NOTES.md`](DEMO_TESTING_NOTES.md)** — device QA and the test matrix
   behind every number quoted on screen.
3. **[`PRODUCTION_PLAN.md`](PRODUCTION_PLAN.md)** and
   **[`DEMO_VIDEO_SCRIPT_V2.md`](DEMO_VIDEO_SCRIPT_V2.md)** — pre-publication planning
   records. They are no longer the current submission state.
4. **[`notes/README.md`](notes/README.md)** — QA evidence and archived planning history.

Before publishing, clear the gates in [`../docs/SUBMISSION_CHECKLIST.md`](../docs/SUBMISSION_CHECKLIST.md)
and [`../docs/CLAIMS.md`](../docs/CLAIMS.md).

## Current State

As verified on 2026-07-21, Devpost embeds the public YouTube video
`I67o7B2JfYQ`. YouTube reports that upload as exactly **3:00**. The polished presentation
ends on its `Thank you` frame at 2:30, but an unfinished duplicate/raw take then starts and
runs to the end.

A clean **2:30** replacement is present locally at
`final-renders/listingos-openai-build-week-final-2m30s.mp4`. It preserves the complete
polished presentation and removes only the accidental tail. Its exact verification data is
tracked in [`final-renders/README.md`](final-renders/README.md).

**External gate:** upload the 2:30 file publicly, verify it signed out, then replace the
Devpost video URL. Keep the current upload until the replacement embed is confirmed.

The old two-track plan and automated masters remain as provenance only. They do not
describe the currently published video.

## Asset Status

All `.mp4` files here are gitignored. Absence from a fresh checkout is expected and does
not mean the file was never produced.

| Path | Contents | In Git | Present locally |
| --- | --- | --- | --- |
| `product-image-sets/` | 12 four-photo product fixture sets | Tracked | Yes |
| `notes/` | QA evidence and creative direction | Tracked | Yes |
| `remotion/` | Composition source `listingos-demo-entry.tsx` | Tracked | Yes |
| `clipcaption-projects/` | Caption style, manifest, caption JSON, cleanup script | Tracked | Yes |
| `rotato-project-inputs/` | `Fast 3 Phones (Autosaved).rotato` project source | Tracked | Yes |
| `video-assets/` | `demo-panel.png`, `product-grid.jpg` | Tracked | Yes |
| `thumbnails/` | `listingos-horizontal-demo-thumbnail.jpg` | Tracked | Yes |
| `archive/` | Superseded plans and automated-pass records | Tracked | Yes |
| `raw-screen-recordings/` | Device recordings | Outputs ignored | Empty |
| `final-renders/` | Intended 2:30 replacement plus tracked handoff metadata | Videos ignored; metadata tracked | Yes |
| `rotato-exports/` | Device-mockup renders | Outputs ignored | Empty |

Every Track B asset above is regenerable from checked-in source. Track A material —
device recordings, the published-listing capture, on-camera footage — is not.
`PRODUCTION_PLAN.md` §5 has the regeneration table.

## Submission Workflow

1. Finish code and deployment verification.
2. Upload the intended 2:30 replacement described in `final-renders/README.md`.
3. Confirm public, signed-out playback and the processed duration.
4. Replace the Devpost video URL and re-open the public project page.
5. Confirm the description qualifies recorded-run timing and Proof Mode fixture data.
6. Confirm music and third-party visual rights before final lock.

## Safety Rules

- Never commit seller tokens, OAuth codes, `.env` files, service-account JSON, private
  keys, or unredacted account data.
- Do not use a production eBay publish as a routine recording test. Use a controlled
  test listing.
- Keep claims aligned with [`../docs/CLAIMS.md`](../docs/CLAIMS.md): fixed-price eBay
  publishing is supported; auction publishing, sold-comps pricing, and universal iOS
  notification proof are not.
- Keep recordings and exports local unless intentionally published as the final artifact.

## Related Documentation

- [`../docs/CLAIMS.md`](../docs/CLAIMS.md) — binding claim boundary
- [`../docs/DEVPOST_SUBMISSION.md`](../docs/DEVPOST_SUBMISSION.md)
- [`../docs/DEMO_RECORDING.md`](../docs/DEMO_RECORDING.md)
- [`../docs/SUBMISSION_CHECKLIST.md`](../docs/SUBMISSION_CHECKLIST.md)
