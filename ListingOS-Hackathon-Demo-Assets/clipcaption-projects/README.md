# Caption Pass

Reproducible caption configuration for the demo. Captions are **Track B (overlay)** —
see `PRODUCTION_PLAN.md` §1.

## Contents

| Path | What it is | In Git |
| --- | --- | --- |
| `listingos-horizontal-caption-style.json` | 16:9 ListingOS caption treatment | Tracked |
| `listingos-caption-pass-v1-speech-only-v3/manifest.json` | Run manifest for the v3 pass | Tracked |
| `listingos-caption-pass-v1-speech-only-v3/assets/*.captions.json` | Cleaned word timings | Tracked |
| `clean-caption-json.mjs` | Reusable cleanup utility | Tracked |

No `.mp4` is present. Captioned renders are gitignored and absent from a fresh checkout.

## Status

The v3 caption pass was run against the superseded automated master. The **style config
and cleanup script remain current** and should be reused. The caption JSON is timed to
a video that no longer exists — it will need regenerating once the new cut is assembled.

`clean-caption-json.mjs` exists because the raw Whisper pass emitted a `[MUSIC PLAYING]`
non-speech cue into the transcript. It strips that class of artifact. Keep it in the
pipeline; the same artifact will recur.

## Regenerating

From the ClipCaptionAI repository:

```sh
export LISTINGOS="/Users/jonathangan/Documents/ListingOS-AI"
export ASSETS="$LISTINGOS/ListingOS-Hackathon-Demo-Assets"

npm run caption:auto -- \
  --video "$ASSETS/final-renders/<current-cut>.mp4" \
  --captions "$ASSETS/clipcaption-projects/<run>/assets/<name>.captions.json" \
  --style-config "$ASSETS/clipcaption-projects/listingos-horizontal-caption-style.json" \
  --run-name <run> \
  --out-dir "$ASSETS/clipcaption-projects" \
  --fps 30 --width 1920 --height 1080 --fit cover --position center-bottom
```

Run `clean-caption-json.mjs` over the output before rendering captions.

## Note on narration

The v3 pass captioned a synthetic narration track. The current plan uses the founder's
real voice, so the next pass captions a human recording and requires no synthetic-voice
disclosure. See `PRODUCTION_PLAN.md` §7.
