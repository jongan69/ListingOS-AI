# Final Submission Checklist

<!-- CURRENT-STATE-AUTHORITY -->
> **Accuracy note, July 21, 2026:** The remaining gates are deployment/store/demo evidence, not additional feature claims. See [Current Implementation State](./CURRENT_STATE.md) for the authoritative implementation and deployment snapshot.

Use this as the single deadline checklist. Checked items were verified during the
2026-07-21 audit; unchecked items still require action or fresh confirmation.

## P0 — Must Finish Before The Deadline

- [ ] Merge the review-first publish safety changes.
- [ ] Run `npm run verify:submission` on the final merged worktree.
- [ ] Deploy the dedicated judge web build with `EXPO_PUBLIC_PROOF_MODE=true npm run web:deploy:production`.
- [ ] Verify all three Proof Mode scenarios signed out at `https://listingos.expo.app`.
- [ ] Upload the prepared 2:30 YouTube replacement documented in
      [`final-renders/README.md`](../ListingOS-Hackathon-Demo-Assets/final-renders/README.md).
- [ ] Replace the Devpost video URL and confirm the new embed signed out.
- [ ] Confirm rights or licenses for the music bed and third-party visuals.
- [ ] Re-open the final public Devpost page in a private window.

## Verified Public Submission State

- [x] `https://devpost.com/software/listingos` returns HTTP 200.
- [x] The public page is listed as submitted to OpenAI Build Week.
- [x] The public pitch says `publish them to eBay`, not `online marketplaces`.
- [x] The public page embeds a YouTube video.
- [x] Six gallery screenshots are present.
- [x] The repository link points to the public MIT-licensed
      `https://github.com/jongan69/ListingOS-AI` repository.
- [x] `https://listingos.expo.app` returns HTTP 200.
- [x] Worker `/health`, `/app-support`, and `/privacy` each return HTTP 200.
- [x] Worker health reports OpenAI, eBay, storage, queues, D1, analytics, RevenueCat server
      trust, and webhook authorization configured; billing enforcement reports `enforce`.
- [x] The public TestFlight link resolves to `Join the ListingOS AI beta`.
- [x] The Play internal-test link redirects a signed-out visitor to Google authentication;
      it is therefore not the primary judge path.

## Video Gate

The current public upload `I67o7B2JfYQ` is exactly 3:00. Its polished presentation ends at
2:30 and an unfinished duplicate take occupies the final 30 seconds. Do not leave that as
the final judge artifact.

- [x] Clean replacement created locally:
      `ListingOS-Hackathon-Demo-Assets/final-renders/listingos-openai-build-week-final-2m30s.mp4`.
- [x] Replacement verified at 150.002 seconds, 1920×1080, 30 fps, H.264/AAC, 22,110,845
      bytes, with a successful full decode.
- [ ] Replacement uploaded to YouTube as **public**.
- [ ] YouTube processed duration is below three minutes.
- [ ] Signed-out playback works with audio.
- [ ] Narration clearly covers what was built, how GPT-5.6 is integrated, and how Codex was
      used.
- [ ] Description says timing is from a recorded run, not a guaranteed SLA.
- [ ] Description says ListingOS is independent and not endorsed by eBay.
- [ ] Music and other third-party material satisfy the Official Rules rights requirement.

## Proof Mode Gate

- [x] Runtime code bypasses authenticated fetches for fixture draft and listing data.
- [x] eBay and ListingOS publish mutations throw or remain disabled in Proof Mode.
- [x] Blocker repair and edits remain local to the fixture state.
- [x] Fixture comparable rows no longer reuse a real eBay listing URL.
- [x] Fixture copy distinguishes illustrative review data from separate historical publish
      metadata.
- [ ] Public judge deployment visibly renders `Proof mode` on Home.
- [ ] Published scenario opens without seller OAuth.
- [ ] Graded-card scenario visibly locks weak pricing.
- [ ] Blocker scenario repairs locally and still shows `No live eBay mutation`.

Use the dedicated command:

```sh
EXPO_PUBLIC_PROOF_MODE=true npm run web:deploy:production
```

Do not enable Proof Mode in native production EAS profiles.

## Claim Gate

- [ ] Every public sentence still fits [`CLAIMS.md`](CLAIMS.md).
- [ ] Publish is described as an explicit seller action after review.
- [ ] Fixed-price only; no auction claim.
- [ ] Active comparable listings only; no sold-comps claim.
- [ ] Sony is import-only; no remote-control claim.
- [ ] On-device work is photo-quality scoring; no object-detection claim.
- [ ] ListingOS Market is labelled beta/prototype and omitted from the winning core.
- [ ] Buyer inquiry delivery and seller inbox/reply are not claimed as shipped.
- [ ] RevenueCat is described as metering/enforcement implementation, not live production
      subscriptions.
- [ ] Any under-one-minute statement is explicitly one recorded run.

## Technical Gate

```sh
npm run verify:submission
```

That command must cover:

- [ ] lint with zero warnings;
- [ ] app and Worker typecheck;
- [ ] safety invariant checks;
- [ ] documentation-link checks;
- [ ] Expo Doctor;
- [ ] Worker dry-run bundle;
- [ ] Android export.

Then perform the minimum smoke pass:

- [ ] Web Home and Proof Mode in a signed-out/private browser.
- [ ] Android launch, photo intake, queue, review, blocker state, and explicit publish button.
- [ ] No live eBay publish as a routine smoke test.
- [ ] No keys, OAuth codes, account identifiers, or private environment values in public
      media.

## External Gates That Code Cannot Complete

- YouTube upload and Devpost URL replacement.
- Final private-window submission review.
- Music/visual rights confirmation.
- Physical-device release behavior.
- App Store Connect and Google Play dashboard state.

Store approval and production subscriptions are not hackathon critical-path items. Do not
let them preempt the P0 list above.

<!-- CURRENT-SUBMISSION-GATES-2026-07-21 -->
## Current Submission Gates

- Green: public landing, support, privacy, terms, deletion, and Market shell routes return 200.
- Yellow: native billing source is implemented but requires store sandbox and webhook evidence.
- Red: deployed Market feed returns 500; omit the end-to-end Market claim unless repaired and reverified.
- External: final public under-three-minute video, store dashboards, selected builds, release artifacts, and accepted submission links require manual evidence.
