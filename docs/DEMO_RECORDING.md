# Demo Recording Checklist

This is the capture and upload safety checklist. The current submission handoff is
[`final-renders/README.md`](../ListingOS-Hackathon-Demo-Assets/final-renders/README.md);
the old script and production plan are retained only as historical planning records.

## Requirement

The Official Rules say the video should be **less than three minutes**, with audio explaining
what was built, how Codex was used, and how GPT-5.6 was used.

The current public upload is exactly 3:00 and contains an accidental second take after the
polished ending. The intended replacement is a verified 2:30 H.264/AAC file described in
the final-render handoff above. Do not record a new demo unless that replacement is unusable.

## Before recording

- Install the standalone release APK and open it once before capture.
- Turn on Do Not Disturb. No notification noise in frame.
- No debug overlays or dev menus.
- Confirm the eBay seller state you intend to show is already connected.
- Prepare one product set from [`../ListingOS-Hackathon-Demo-Assets/product-image-sets/`](../ListingOS-Hackathon-Demo-Assets/product-image-sets/).
- ADB-pushed images require a MediaStore scan before the native picker will see them.

## Capture

Phone's built-in screen recorder gives the cleanest result and captures microphone audio.

Via ADB (no microphone audio):

```sh
adb devices -l
adb shell screenrecord --bit-rate 12000000 --time-limit 170 /sdcard/listingos-demo.mp4
adb pull /sdcard/listingos-demo.mp4 ./ListingOS-Hackathon-Demo-Assets/raw-screen-recordings/
```

Record narration separately and combine in the edit. `raw-screen-recordings/` is gitignored.

## Privacy gate

- No API keys, OAuth codes, seller tokens, or `.env` values in frame.
- Crop or blur account identifiers that are not needed to prove the workflow.
- Blur any file path containing account identifiers in code montages.

## Publish safety

- Do not create duplicate production eBay listings while recording.
- If demonstrating publish, use a deliberate test item or an already-published result.
- Proof Mode must label review/pricing data as illustrative and historical publish metadata
  as evidence from a separate verified run.

## Upload

1. Upload `ListingOS-Hackathon-Demo-Assets/final-renders/listingos-openai-build-week-final-2m30s.mp4`
   to YouTube as **public**.
2. Wait for HD processing and verify duration, audio, captions, and the final frame signed out.
3. Add the replacement URL to Devpost, then verify the embedded player in a private window.
4. Keep the prior upload until the replacement embed works.
5. Qualify under-one-minute timing as one recorded run, disclose fixture-backed Proof Mode,
   and state that ListingOS is independent and not endorsed by eBay.
6. Confirm music and third-party visual rights before final lock.
