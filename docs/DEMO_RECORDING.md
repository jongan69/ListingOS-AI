# Demo Recording Checklist

Device-capture mechanics for the demo video. **Story, shot list, and narration are not
here** — they live in the demo workbench:

- Script: [`ListingOS-Hackathon-Demo-Assets/DEMO_VIDEO_SCRIPT_V2.md`](../ListingOS-Hackathon-Demo-Assets/DEMO_VIDEO_SCRIPT_V2.md)
- Production plan and shot list: [`ListingOS-Hackathon-Demo-Assets/PRODUCTION_PLAN.md`](../ListingOS-Hackathon-Demo-Assets/PRODUCTION_PLAN.md)

This file covers only how to get clean footage off the device.

## Requirement

Public YouTube video under 3:00 with audio explaining what was built, how Codex was used,
and how GPT-5.6 was used. Current script targets 2:53.

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
- See [`PRODUCTION_PLAN.md`](../ListingOS-Hackathon-Demo-Assets/PRODUCTION_PLAN.md) §4 —
  the publish-footage blocker is unresolved and gates the cold open.

## Upload

Upload to YouTube as public or unlisted, verify playback in an incognito window, then add
the URL to Devpost. Disclose any time-compression of queue processing in the description.
