# ListingOS Hackathon Demo Assets

This directory is the reproducible workbench for the ListingOS Build Week demo. It contains the source footage plan, fixture photos, narration, composition code, and local output folders used to produce the final video.

The app's judge-facing runtime fixtures live separately in [`../assets/proof-mode`](../assets/proof-mode). This workbench is for demo production, not application runtime behavior.

## Start Here

1. Read [`DEMO_TESTING_NOTES.md`](DEMO_TESTING_NOTES.md) for device QA, product coverage, and evidence from the verified Android run.
2. Read [`FINAL_VIDEO_NOTES.md`](FINAL_VIDEO_NOTES.md) for the current edit, caption, and review decisions.
3. Use [`notes/README.md`](notes/README.md) to find shot planning, creative direction, and cut QA.
4. Use [`product-image-sets/README.md`](product-image-sets/README.md) to select repeatable product fixtures.
5. Use the submission gates in [`../docs/BUILD_WEEK_AUDIT.md`](../docs/BUILD_WEEK_AUDIT.md) and [`../docs/SUBMISSION_CHECKLIST.md`](../docs/SUBMISSION_CHECKLIST.md) before publishing.

## Current Source Of Truth

- Primary edit candidate: `final-renders/listingos-horizontal-demo-remotion-v1.mp4`
- Captioned alternate: `final-renders/listingos-horizontal-demo-remotion-v1-captioned-v3.mp4`
- Thumbnail: [`thumbnails/listingos-horizontal-demo-thumbnail.jpg`](thumbnails/listingos-horizontal-demo-thumbnail.jpg)
- Composition entry point: [`remotion/listingos-demo-entry.tsx`](remotion/listingos-demo-entry.tsx)
- Caption configuration and cleanup script: [`clipcaption-projects/`](clipcaption-projects/)

The MP4 files are local production outputs and are ignored by Git. Do not treat an old local render as the submitted video without checking its duration, visibility, voiceover, and current product flow.

## Folder Layout

| Folder | Purpose | Git policy |
| --- | --- | --- |
| `product-image-sets/` | Repeatable product-photo fixtures for capture and edit work | Tracked |
| `captions/` | Narration, beat sheet, and caption source text | Tracked |
| `notes/` | QA, story, shot, and editing decisions | Tracked |
| `remotion/` | Remotion composition source | Tracked |
| `clipcaption-projects/` | Caption styling, manifests, and local tooling | Tracked |
| `rotato-project-inputs/` | Rotato source project used for device mockups | Tracked |
| `video-assets/` | Still graphics used by the edit | Tracked |
| `thumbnails/` | Preview image for the demo package | Tracked |
| `raw-screen-recordings/` | Local device recordings | Outputs ignored |
| `final-renders/` | Local assembled videos | Outputs ignored |
| `rotato-exports/` | Local device-mockup exports | Outputs ignored |

## Production Workflow

1. Capture or select a verified flow using the fixtures in `product-image-sets/`.
2. Follow the shot and QA guidance in `notes/` and `DEMO_TESTING_NOTES.md`.
3. Assemble the edit with the Remotion entry point and still assets.
4. Apply captions using the configuration in `clipcaption-projects/`.
5. Review the final file for duration, voiceover, privacy, truthful feature claims, and incognito playback before submitting.

## Safety Rules

- Never commit seller tokens, OAuth codes, `.env` files, service-account JSON, private keys, or unredacted account data.
- Do not use a production eBay publish as a routine recording test. Use the documented verified evidence or a controlled test listing.
- Keep claims aligned with the app truth boundary: fixed-price eBay publishing is supported; auction publishing, sold-comps pricing, and universal iOS notification proof are not.
- Keep recordings and exports local unless they are intentionally published as the final demo artifact.

## Related Documentation

- [`../docs/DEVPOST_SUBMISSION.md`](../docs/DEVPOST_SUBMISSION.md)
- [`../docs/DEMO_SCRIPT.md`](../docs/DEMO_SCRIPT.md)
- [`../docs/DEMO_RECORDING.md`](../docs/DEMO_RECORDING.md)
- [`../docs/BUILD_WEEK_AUDIT.md`](../docs/BUILD_WEEK_AUDIT.md)
