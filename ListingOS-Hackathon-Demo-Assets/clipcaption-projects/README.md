# ClipCaptionAI Projects

This directory contains the reproducible caption pass for the ListingOS horizontal demo.

## Inputs

- `listingos-caption-pass-v1-speech-only-v3/` contains the final cleaned caption JSON and run manifest.
- `listingos-horizontal-caption-style.json` defines the 16:9 ListingOS caption treatment.
- `clean-caption-json.mjs` is retained as a reusable cleanup utility; the superseded raw transcription run remains local-only.

## Reviewed Output

- `listingos-caption-pass-v1-speech-only-v3/` contains the final cleaned transcript, manifest, and captioned render.
- The MP4 is intentionally ignored by Git because final video renders remain local; the manifest and caption JSON remain reproducible source artifacts.

From the ClipCaptionAI repository, run:

```sh
npm run caption:auto -- \
  --video /Users/jonathangan/Documents/ListingOS-AI/ListingOS-Hackathon-Demo-Assets/final-renders/listingos-horizontal-demo-remotion-v1.mp4 \
  --captions /Users/jonathangan/Documents/ListingOS-AI/ListingOS-Hackathon-Demo-Assets/clipcaption-projects/listingos-caption-pass-v1-speech-only-v3/assets/listingos-horizontal-demo-remotion-v1.captions.json \
  --style-config /Users/jonathangan/Documents/ListingOS-AI/ListingOS-Hackathon-Demo-Assets/clipcaption-projects/listingos-horizontal-caption-style.json \
  --run-name listingos-caption-pass-v1-speech-only-v3 \
  --out-dir /Users/jonathangan/Documents/ListingOS-AI/ListingOS-Hackathon-Demo-Assets/clipcaption-projects \
  --fps 30 --width 1920 --height 1080 --fit cover --position center-bottom
```

The captioned alternate is not a claim that the synthetic narration is the user's voice. Public upload metadata should disclose the synthetic voice unless it is replaced with an approved human recording.
