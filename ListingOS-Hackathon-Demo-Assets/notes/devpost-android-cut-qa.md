# Devpost Android Cut QA

Superseded artifact: `final-renders/listingos-devpost-android-v1.mp4`

This cut is not the final demo. It uses screenshot-style editing and ends before a complete publish outcome. Do not upload it as proof of end-to-end publishing.

Current source of truth: `raw-screen-recordings/listingos-full-demo-a16.mp4`

- Duration: approximately 135 seconds
- Video: H.264, 1080x2340, continuous Android screen recording
- Device: Samsung A16, standalone release APK
- Flow: camera-first home, three-photo intake, queue, generated review, publish attempt, return to queue
- Publish result: the live attempt remained failed with an eBay `BrandMPN` validation blocker; this is preserved as honest QA evidence, not presented as a success

The raw file is intentionally kept outside Git because it is a large generated upload artifact.

## Narrated QA Candidate

`final-renders/listingos-devpost-android-continuous-synthetic-v1.mp4` is a continuous 135.2-second encode of the same source with a synthetic macOS voice track. Technical QA passed with a score of 96/100; the only warning is that the source contains long UI waits and reads as a slideshow during those waits. This file is suitable for internal review, not the final public upload until it has a human-voice track and a tighter dead-time treatment.

The narration is not Jonathan Gan's voice. ClipCaptionAI has no voice-cloning provider configured in this repo, so no claim should suggest otherwise.

Remaining external step: upload the file to YouTube as public or unlisted, attach the URL to the live Devpost project, then submit OpenAI Build Week.
