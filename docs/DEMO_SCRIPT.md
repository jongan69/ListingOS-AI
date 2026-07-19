# Demo Recording Script

Target length: 2:15 to 2:45. Devpost requires a public YouTube video under 3 minutes with audio that explains what was built, how Codex was used, and how GPT-5.6 was used.

## Shot List

1. Start on the ListingOS home screen.
2. Show connected eBay seller state and publish readiness.
3. Pick product photos from the Android gallery.
4. Show upload/background processing screen.
5. Open the generated draft review screen.
6. Show AI-filled title, price strategy, category, condition, item specifics, description, confidence, and comps.
7. Show inline eBay blocker handling if a blocker exists, or explain that this item verified cleanly.
8. Show verify/publish path.
9. Show live listing proof or the already-published listing result.
10. End on the Devpost-ready value prop: photos in, verified eBay listing out.

## Voiceover

```text
This is ListingOS, the camera-first AI listing machine for eBay sellers.

The problem is simple: taking product photos is fast, but turning those photos into a complete eBay listing is still slow. Sellers have to research a title, choose a category, fill item specifics, write copy, price the item, check policies, and fix publish blockers.

ListingOS compresses that into one flow. I sign in with my own eBay account, choose photos of one product, pick whether I care more about speed or profit, and the app uploads them to a Cloudflare backend. The Worker stores the images in R2, creates queue jobs, and asks GPT-5.6 through the OpenAI Responses API to generate structured listing intelligence.

GPT-5.6 returns the title, category guess, condition notes, buyer-ready description, item specifics, confidence score, pricing ladder, and recommended strategy. The app presents it as one review page, not a giant form. I can edit anything, but the default is that AI picks strong options unless eBay requires input.

Before publishing, ListingOS verifies the draft against eBay requirements. If eBay needs a seller policy, location, or required aspect, the app surfaces that blocker inline and can send the fix back through the backend. The publish path is fixed-price first and uses the eBay Inventory API.

Codex was used as the main build partner for this project. It helped plan the architecture, implement the Expo mobile app, build the Cloudflare Worker, wire eBay OAuth and publishing, debug Android crashes, fix public image delivery for eBay, polish the UI, and produce the documentation and submission package.

The result is a real seller workflow: photos in, AI-generated draft out, verify, fix blockers, and publish to eBay from the phone. ListingOS is not another seller dashboard. It is the start of an AI seller agent for turning raw product media into safe marketplace action.
```

## Recording Commands

Use the physical Samsung Android device when possible:

```bash
adb devices -l
adb -s R5CY51SFSDL shell screenrecord --bit-rate 12000000 --time-limit 170 /sdcard/listingos-demo.mp4
adb -s R5CY51SFSDL pull /sdcard/listingos-demo.mp4 ./listingos-demo.mp4
```

The built-in Android screen recorder does not capture Mac microphone narration. Record narration separately and combine with the phone capture before uploading to YouTube.

## Safety Notes

- Avoid creating duplicate production eBay listings during recording.
- If demonstrating publish, use a deliberate test item or the already-published listing result.
- Do not show API keys, OAuth codes, private tokens, or `.env` files.
- Keep the video focused on the working product, not setup steps.
