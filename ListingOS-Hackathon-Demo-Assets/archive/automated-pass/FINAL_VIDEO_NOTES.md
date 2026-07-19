> **SUPERSEDED — records renders made against an incomplete product; measurements describe files that no longer exist**
> Not a current plan. See [`PRODUCTION_PLAN.md`](../../PRODUCTION_PLAN.md) and [`../README.md`](../README.md).

# Final Video Notes

## Master

The current presentation master is:

`final-renders/listingos-horizontal-demo-remotion-v1.mp4`

The Rotato-enhanced presentation master is:

`final-renders/listingos-horizontal-demo-rotato-enhanced-20260718.mp4`

The Remotion master is a true 1920x1080 horizontal H.264 export with AAC audio. It preserves the Rotato opener and real Android/eBay evidence, then adds animated chapters, lower-thirds, a progress rail, synthetic narration, and a low-volume music bed. The phone recording fills the left side at full height, while the right side uses ListingOS brand copy, test metrics, and a product grid so vertical source footage does not appear as a small phone surrounded by empty space.

ClipCaptionAI also produced a reviewed captioned alternate at `clipcaption-projects/listingos-caption-pass-v1-speech-only-v3/final/listingos-horizontal-demo-remotion-v1.captioned.mp4`. It uses the same horizontal source, a ListingOS-branded caption style, and a reusable cleanup script that removes Whisper's non-speech music cue. Keep the Remotion master as the primary submission candidate; use the captioned alternate when burned-in captions are wanted.

The master uses the strongest real Android release footage. It is not a claim of raw sub-minute wall-clock interaction: queue processing is accelerated in the presentation source, while the verified backend timestamps and live publish proof are documented in `README.md`.

Verified base export on 2026-07-18: H.264, 1920x1080, 125.32 seconds, 4.1 MB. The enhanced master adds a 7.23-second Rotato three-device opener and is H.264, 1920x1080, 132.57 seconds, 7.8 MB. Thumbnail: `thumbnails/listingos-horizontal-demo-thumbnail.jpg`.

Verified Remotion export on 2026-07-18: H.264, 1920x1080, 30 fps, 132.63 seconds, AAC stereo audio, 18.6 MB.

## Story

1. Photo intake and AI listing creation.
2. Review with title, category, condition, specifics, pricing, confidence, and comps.
3. Return to the queue while processing continues.
4. Publish confirmation and live eBay state.
5. Product-grid proof that the workflow was tested beyond one curated item.

## Production decisions

- Exported horizontal rather than placing a narrow vertical recording in a black canvas.
- Kept the phone footage at readable scale and used the right panel for context instead of fabricated UI.
- Used only measured test results: 12 draft records, 10 distinct intended product sets, 9 ready, and 3 review gates.
- Added a real Rotato device-mockup opener rendered from the packaged `rotato-project-inputs/Fast 3 Phones (Autosaved).rotato` source with the base master injected into all three phone screens.
- Did not show secrets, API keys, or developer dashboards.
- Added a reusable Remotion composition at `remotion/listingos-demo-entry.tsx` with chapter and lower-third components.
- Added locally generated synthetic narration and a ClipCaptionAI music-library bed. The narration is not Jonathan Gan's voice and must be described as synthetic in any public upload metadata.

## Tool inventory

- `ffmpeg` and `ffprobe`: used for the horizontal composition and technical validation.
- ImageMagick: used for the product-grid still.
- Rotato: `/Applications/Rotato.app` version `158beta7`; its bundled renderer injected the real master into the three-phone template and created `rotato-exports/listingos-rotato-3phone-demo.mp4`.
- ClipCaptionAI: used at `/Users/jonathangan/Desktop/ClipCaptionAI` for the Remotion render, local voice-generation handoff, and music-bed source. Its 70-test suite and TypeScript checks passed before rendering.
- ClipCaptionAI caption QA: local Whisper produced the source word timings, then the horizontal caption renderer was run with `clipcaption-projects/listingos-horizontal-caption-style.json`. The first raw pass exposed a `[MUSIC PLAYING]` transcription artifact; `clipcaption-projects/clean-caption-json.mjs` removes that class of cue before the reviewed v3 alternate.

## QA commands

The master must pass:

```sh
ffprobe -v error -show_entries stream=width,height,codec_name:format=duration \
  -of default=nw=1 final-renders/listingos-horizontal-demo-remotion-v1.mp4
```

Expected video dimensions are `1920x1080`; the export passed this check. The full-speed source and raw screen recordings remain beside the master so every accelerated or composited segment can be audited.

## Recommended final edit pass

For a public-facing cut, replace the synthetic narration with a human-approved recording if available. The current render is ready for internal review and can be uploaded only with the synthetic-voice disclosure. Keep the underlying real-device master as the technical fallback.
