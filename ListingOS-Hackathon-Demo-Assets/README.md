# ListingOS Hackathon Demo Assets

This folder is the reproducible workbench for the final ListingOS hackathon demo. Runtime Proof Mode fixtures live separately in [`assets/proof-mode`](../assets/proof-mode/) so the app never depends on editing outputs.

## Purpose

Keep every demo artifact in one predictable place so recording, mockup generation, editing, and Devpost upload do not drift across the machine.

## Status

- Android recording surface is verified on the Samsung A16 using the standalone release APK
- `raw-screen-recordings/listingos-full-e2e-publish-a16-20260718.mp4` is the first full live run, including the Android picker, six-photo intake, queue, review, and live publish verification attempt. Android's screen-recording limit ended this source immediately before the publish tap.
- `raw-screen-recordings/listingos-complete-fast2-a16-20260718.mp4` is the second continuous run from selected photos through review, publish, and the green `Published to eBay` notification.
- `final-renders/listingos-end-to-end-a16-demo-cut-20260718.mp4` is the strongest review copy: it combines the real intake, continuous publish flow, ListingOS published state, and authenticated eBay active-listing proof. The queue segment is accelerated for presentation; the raw sources remain available for audit.
- `final-renders/listingos-end-to-end-a16-raw-cut-20260718.mp4` is the full-speed assembled source cut with no speed-up applied to the queue flow.
- `final-renders/listingos-horizontal-demo-20260718.mp4` is the verified 1920x1080 horizontal master. It uses a full-height phone treatment, a branded test-evidence panel, and the strongest real Android release flow. See `FINAL_VIDEO_NOTES.md` for the edit and claim boundaries.
- `final-renders/listingos-horizontal-demo-rotato-enhanced-20260718.mp4` is the Rotato-enhanced 1920x1080 presentation master. It opens with a real three-device Rotato render, then continues into the same auditable Android flow.
- `final-renders/listingos-horizontal-demo-remotion-v1.mp4` is the current production candidate. It is a 1920x1080 Remotion export with the Rotato opener, animated chapters, explanatory lower-thirds, synthetic narration, and music. It preserves the real Android/eBay evidence underneath.
- `clipcaption-projects/listingos-caption-pass-v1-speech-only-v3/final/listingos-horizontal-demo-remotion-v1.captioned.mp4` is the reviewed captioned alternate. It uses the same Remotion master, a horizontal ListingOS caption style, and non-speech cue cleanup.
- A technically valid narrated candidate is available at `final-renders/listingos-devpost-android-continuous-synthetic-v1.mp4`; it is a continuous 135.2-second encode with synthetic macOS narration and is QA-only until a human-voice/public-upload pass is completed
- `final-renders/listingos-devpost-android-v1.mp4` is a superseded local cut and must not be represented as the final demo because it uses screenshot-style editing and does not prove the complete publish outcome
- iOS recording remains deferred while the hackathon path is Android-first
- Source copy for the public story lives in [`docs/DEVPOST_SUBMISSION.md`](../docs/DEVPOST_SUBMISSION.md)
- Recording guidance lives in [`docs/DEMO_RECORDING.md`](../docs/DEMO_RECORDING.md)

## Folder Layout

- `raw-screen-recordings/`
  Raw captures from iOS simulator, Android device, or desktop capture.
- `rotato-project-inputs/`
  Clean source clips and screenshots intended for Rotato templates.
- `rotato-exports/`
  Device mockup renders, hero clips, and polished motion exports.
- `rotato-exports/rejected/`
  Render attempts that failed the no-placeholder visual QA gate; never use these in public edits.
- `clipcaption-projects/`
  ClipCaptionAI run configs, edit notes, and project-level inputs.
- `final-renders/`
  Submission-ready exports such as the 30s, 60s, and 90s cuts.
- `captions/`
  Subtitle files, caption text, and timing notes.
- `audio/`
  Selected music, SFX, and voiceover assets actually used in final edits.
- `remotion/`
  Reusable horizontal composition source and render instructions.
- `thumbnails/`
  Frame grabs, stills, and Devpost-ready preview images.
- `notes/`
  Shot lists, QA notes, timing notes, and cut decisions.

Large `.mp4` recordings, final renders, QA-attempt screenshots, and superseded caption runs remain local by repository policy. Product fixtures, the selected thumbnail, compositor sources, final caption metadata, and written evidence remain tracked for reproducibility. Local-only media is not required to build or run the app.

## Verified Live Run

The latest verified run used the Samsung A16 release APK and six wallet photos:

1. Photo batch created: `2026-07-18T11:27:45.306Z`
2. Draft ready: `2026-07-18T11:28:09.981Z` (about 25 seconds from batch creation)
3. Publish queued: `2026-07-18T11:29:39.626Z`
4. eBay published: `2026-07-18T11:29:51.144Z` (about 12 seconds after publish was queued)
5. eBay listing: `398187910808`
6. Buyer-facing URL recorded by the Worker: `https://www.ebay.com/itm/398187910808`

The app returned immediately to the camera workflow and displayed `Published to eBay`. The ListingOS queue then showed `Published` / `Live on eBay`, and the authenticated eBay app showed the active listing at `$12.74`.

The backend work measured under one minute from upload processing through draft readiness and publish completion when the operator does not pause for inspection. The recorded full-speed source is longer because it includes manual review and device interaction; use the clearly accelerated demo cut for presentation.

The demo should show:

- real photo intake
- real AI draft generation
- real review/edit UX
- real queue behavior
- real publish notification and published queue state
- authenticated eBay active-listing proof

The eBay response contained only the normal pending-funds warning (`25402`); the listing itself published successfully. Do not present the accelerated cut as raw elapsed time.

## Naming Convention

Use filenames in this format:

- `listingos-raw-home-queue-01.mov`
- `listingos-raw-review-publish-01.mov`
- `listingos-rotato-hero-phone-pop-up-v1.mp4`
- `listingos-devpost-60s-v1.mp4`

## Privacy And QA Rules

- Do not include secrets, tokens, `.env` contents, or developer dashboards.
- Avoid showing personal email addresses unless required for proof.
- Prefer seller-agnostic screens when possible.
- Verify text readability before treating an export as final.
- Keep the first 3 seconds strong and immediately product-relevant.

## Related Sources

- [Demo recording](../docs/DEMO_RECORDING.md)
- [Devpost submission](../docs/DEVPOST_SUBMISSION.md)
- [Claims ledger](../docs/CLAIMS.md)
- [Release guide](../docs/RELEASE.md)
- [Devpost thumbnail](../artifacts/devpost/listingos-home-3x2.png)

## Final Render QA

The production candidate passed these checks on 2026-07-18:

```text
H.264 video, 1920x1080, 30 fps, 132.63 seconds
AAC stereo audio, 48 kHz
```

The render was visually inspected at the Rotato opener, capture, queue, review, verify, and live-listing proof beats. The composition source and packaged Rotato project are in this folder so another developer can reproduce the finishing pass.

## ClipCaptionAI Pass

ClipCaptionAI was run locally with Whisper transcription and its caption renderer. The final cleaned caption JSON, style, and manifest are preserved in `clipcaption-projects/listingos-caption-pass-v1-speech-only-v3/`; the superseded raw transcription run remains local-only. The reviewed captioned candidate is H.264, 1920x1080, 30fps, 132.69 seconds, with AAC stereo audio.

The Remotion master remains the recommended primary submission file because its existing lower-thirds are part of the composition. The captioned render is a ready-to-use alternate when burned-in captions are preferred.
