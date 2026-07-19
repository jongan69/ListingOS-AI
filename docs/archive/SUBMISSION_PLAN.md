# Submission Plan

## North Star

ListingOS should feel like the first genuinely useful AI seller tool: sellers photograph inventory, the app builds a marketplace-safe draft, and the seller reviews only the exceptions before publish.

The core success criterion is this sentence:

> ListingOS turns product photos into a real, eBay-ready listing draft with evidence-based pricing and publish safety, so sellers can move from capture to list without rebuilding the listing manually.

## Submission objectives

1. Demonstrate a working end-to-end flow using real eBay integration.
2. Show that AI is used responsibly: GPT-5.6 generates structured draft intelligence, not vague claims.
3. Make the demo safe for judges: a reusable proof path and clear disclosure about live publishing.
4. Keep the submission tight: video under 3 minutes, accurate copy, and a truthful product story.
5. Leave no submission checklist item incomplete.

## What this submission must prove

- Real mobile app built on Expo + React Native.
- Real Cloudflare Worker backend with D1/R2/KV/Queue architecture.
- Real eBay OAuth and fixed-price publish flow.
- Real AI intelligence from GPT-5.6 with structured output validation.
- Real review experience with editable listing fields and blocker handling.
- Real proof that listing media is buyer-reachable and publish-safe.

## Plan and priorities

### 1. Demo and proof package

- Record a public YouTube demo under 3 minutes.
- Use the final standalone Android/demo build.
- Include voiceover that covers:
  - what was built,
  - how Codex was used,
  - how GPT-5.6 was used.
- Capture one general item and one stricter vertical/example item.
- Preserve a real published proof result or a non-mutating proof path.
- Add final screenshots and hero assets to the submission gallery.

### 2. Submission copy and docs

- Finalize Devpost fields with the project name, category, URL, repo, and judge instructions.
- Ensure README and docs explain Codex and GPT-5.6 usage clearly.
- Keep claims narrow and backed by the evidence table in `docs/CLAIMS.md`.
- Confirm the feedback session ID is entered in the form.
- Confirm the private repo is shared with Devpost and OpenAI.

### 3. Technical verification

- Run `npm run check`.
- Run `npm run export:android`.
- Run `npm run worker:check`.
- Verify deployed Worker health if a live backend is part of the demo.
- Confirm the published proof URLs or export artifacts are accessible.

### 4. Submission admin finish line

- Add all team members and confirm invitations.
- Select the final category in Devpost.
- Ensure the project is not left as a draft.
- Upload the video, screenshots, and any required gallery assets.
- Double-check the form for the Devpost feedback session ID and repo access.

## Recommended sprint

1. Complete the demo recording and export.
2. Upload the video to YouTube and save the URL.
3. Finish the Devpost form fields and attachment assets.
4. Execute the final technical validation commands.
5. Submit the Devpost entry.

## Commit intention

This document is meant to be the working north star for the final submission push. It should remain visible in `docs/` so the team can focus on the exact proof points and avoid last-minute claim drift.
