# Demo Recording Checklist

Target: public YouTube video under 3 minutes with audio explaining what was built, how Codex was used, and how GPT-5.6 was used.

## Recommended Story

1. Open the standalone `ListingOS` app from the phone launcher.
2. Show the camera-first home screen and brand.
3. Sign in with eBay or show the connected seller state.
4. Select product photos.
5. Show the background queue while AI builds the listing.
6. Open the review page.
7. Show AI-generated title, price strategy, category, condition, specifics, and description.
8. Show inline blocker handling or readiness state.
9. Show verify-before-publish.
10. Show the published listing result or an already-published proof screen.

## Voiceover Points

- ListingOS turns product photos into a structured eBay listing workflow.
- GPT-5.6 generates title, description, item specifics, category, condition notes, confidence, and pricing strategy through the OpenAI Responses API.
- Codex was used to build the Expo app, Cloudflare Worker, eBay OAuth, async uploads, Worker queues, publish flow, UI polish, docs, and Android release validation.
- The app is not just a mockup: it runs as a native Android release build and talks to deployed Cloudflare/eBay/OpenAI services.

## Recording Options

From the physical phone:

- Use Android's built-in screen recorder for the cleanest demo.
- Keep the app already installed and opened once before recording.
- Turn on Do Not Disturb.
- Use one product with clear photos.

From ADB:

```sh
adb shell screenrecord --bit-rate 12000000 --time-limit 170 /sdcard/listingos-demo.mp4
adb pull /sdcard/listingos-demo.mp4 ./dist/devpost/listingos-demo.mp4
```

ADB screen recording does not capture microphone audio. Use the phone recorder if you want direct narration.

## Final Upload

Upload the final video to YouTube as public or unlisted, then add the URL to Devpost.
