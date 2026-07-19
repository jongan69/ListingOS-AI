# ListingOS Hackathon Demo Assets

Production workbench for the ListingOS demo video: script, fixtures, capture plan,
composition source, and local output folders.

The app's judge-facing runtime fixtures live separately in
[`../assets/proof-mode`](../assets/proof-mode). This workbench is for demo production,
not application runtime behavior.

## Start Here

1. **[`PRODUCTION_PLAN.md`](PRODUCTION_PLAN.md)** — the two-track model, beat map, open
   blockers, and remaining shot list. Read this first; it organizes everything else.
2. **[`DEMO_VIDEO_SCRIPT_V2.md`](DEMO_VIDEO_SCRIPT_V2.md)** — the current script:
   narration, on-screen text, timing, and compliance self-check.
3. **[`DEMO_TESTING_NOTES.md`](DEMO_TESTING_NOTES.md)** — device QA and the test matrix
   behind every number quoted on screen.
4. **[`notes/README.md`](notes/README.md)** — QA evidence and archived planning history.

Before publishing, clear the gates in [`../docs/BUILD_WEEK_AUDIT.md`](../docs/BUILD_WEEK_AUDIT.md)
and [`../docs/SUBMISSION_CHECKLIST.md`](../docs/SUBMISSION_CHECKLIST.md).

## Current State

The video is **in pre-production.** There is no current master render.

The demo is built as two tracks: live-action evidence (Track A) with automated overlay
material layered on top (Track B). `PRODUCTION_PLAN.md` §1 defines how they divide.

An earlier fully-automated approach produced Remotion and Rotato masters. Those were
rendered while the product was incomplete and the required footage did not exist; they
are superseded and retained only as tooling references. See
[`archive/automated-pass/`](archive/automated-pass/).

**Open blocker:** the strongest beats in the script depend on footage of a successful
eBay publish, and the existing recording ends in a `BrandMPN` validation failure.
`PRODUCTION_PLAN.md` §4 covers the reconciliation and the three ways forward. Nothing
in the cold open should be shot until it is resolved.

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
| `final-renders/` | Assembled videos | Outputs ignored | Empty |
| `rotato-exports/` | Device-mockup renders | Outputs ignored | Empty |

Every Track B asset above is regenerable from checked-in source. Track A material —
device recordings, the published-listing capture, on-camera footage — is not.
`PRODUCTION_PLAN.md` §5 has the regeneration table.

## Workflow

1. Resolve the publish blocker (`PRODUCTION_PLAN.md` §4).
2. Decide the on-camera slots (`PRODUCTION_PLAN.md` §2) — this gates the shoot.
3. Capture Track A per the shot list (`PRODUCTION_PLAN.md` §6).
4. Build Track B overlays from the checked-in composition and fixture sources.
5. Assemble against the beat map (`PRODUCTION_PLAN.md` §3).
6. Review for duration, audio, privacy, truthful claims, and incognito playback.

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
- [`../docs/DEMO_SCRIPT.md`](../docs/DEMO_SCRIPT.md)
- [`../docs/DEMO_RECORDING.md`](../docs/DEMO_RECORDING.md)
- [`../docs/BUILD_WEEK_AUDIT.md`](../docs/BUILD_WEEK_AUDIT.md)
