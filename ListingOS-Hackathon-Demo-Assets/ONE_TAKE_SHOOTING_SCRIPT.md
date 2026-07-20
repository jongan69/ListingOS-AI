# One-Take Shooting Script

**Printable version: [`ONE_TAKE_SHOOTING_SCRIPT.pdf`](ONE_TAKE_SHOOTING_SCRIPT.pdf)** — same content, laid out for paper. Take that one to the shoot.

Format: single continuous take · 3 camera angles + separate phone screen recording · live publish
Target: 2:45–2:55 · Narration: live, in your own voice

This replaces `DEMO_VIDEO_SCRIPT_V2.md` for this shoot. That script was written for
post-production voiceover over screen capture; this one is written for the mouth, live,
with the demo actually running.

---

## 1. Pre-Flight — do all of this before anyone rolls

**The item — decide this first**

Both paths are legitimate. They fail differently.

| | Safe path — unbranded item | Stronger path — graded card |
| --- | --- | --- |
| Use | Leather wallet or sunglasses | Wartortle PSA 10 (3 exact comps, scored 0.87 `ready`) |
| Why | `BrandMPN` auto-repair covers you. It fires only for US marketplace, non-card, unbranded evidence — all true here. | The refusal beat is the most impressive thing the product does. |
| Risk | Low. Cleanest publish. Slightly less memorable. | Pricing locks if fewer than 2 exact comps are live at that moment. Comp data shifts hour to hour. |
| If it fails | Cut to the pre-published listing tab. | Set a manual price — that clears the publish gate — then continue. |

- [ ] **Settle it before you light anything.** Run your chosen item through the app now.
      Comes back `ready` with a real price → shoot it. Comes back `needs_input` → use the wallet.
- [ ] Four photos, already in the gallery, already indexed by the picker.
      ADB-pushed images need a MediaStore scan first or the picker won't see them.

**The device**

- [ ] Do Not Disturb ON. No notification banners mid-take.
- [ ] eBay account connected — confirm the seller state on Home *before* rolling.
- [ ] Battery above 50%, screen brightness up, auto-lock long or off.
- [ ] App opened once already so there's no cold-start delay.
- [ ] Screen recording started **before** the cameras roll.

**The fallback**

- [ ] A previously published eBay listing open in a browser tab, off camera.
      If the live publish fails on something auto-repair doesn't cover, you cut to this.
- [ ] Know the expected price before you start so nothing on screen surprises you.

**Sync**

- [ ] Clap once, in frame, visible to all three cameras, after the screen recording is
      already running. That clap is your sync point for four separate media files.

**The final sixty seconds**

Three things kill this take. Check them last, in this order:

1. **Is the screen recording running?** Four media files are useless if the one carrying the
   UI never started. Confirm it visually, not from memory.
2. **Is Do Not Disturb on?** A banner across the review screen means a reshoot, because that
   is the one frame you cannot cut around.
3. **Have you clapped?** After the screen recording starts, before you speak.

Then go straight into "I'm Jon." No warm-up line, no countdown on camera — you'll cut the
head off anyway.

---

## 2. The Script

Stage directions in *italics*. Say the rest.

### Beat 1 — Cold open · to camera · ~15s

*Straight to camera. No preamble, no "hi guys."*

> I'm Jon. I built ListingOS. It turns product photos into a live eBay listing.
>
> The hard part of selling something was never the photo. It's the listing. Title, category, item specifics, condition, price, policy checks. That's the part nobody wants to do.
>
> So watch.

### Beat 2 — Intake · phone angle · ~30s

*Pick up the phone. Screen recording is the hero here; the phone angle is texture.*

> This is my real eBay account, connected through OAuth.

*Open the picker. Select the four photos.*

> I pick photos of one product.

*Hit the strategy control.*

> And I pick one thing — sell fast, or sell high.
>
> That's the whole input. Photos, and one preference.

*Tap create.*

> I could put the phone down here and start the next item — it builds in the background. But let's watch it work.

### Beat 3 — The wait · back to camera · ~40s

**This is the beat that saves the take.** Draft generation ran ~40 seconds in prior tests.
Don't stare at a spinner — turn and explain. If the draft lands early, cut yourself off at
the nearest sentence end and move to Beat 4. If it runs long, the last line is your buffer.

> While that runs — here's what's actually happening.
>
> The photos go up to Cloudflare R2 and land on a queue. A Cloudflare Worker picks up the job.
>
> It sends the images to GPT-5.6 through the OpenAI Responses API, and asks for strict structured output against a JSON Schema. Not prose — a typed object.
>
> The Worker validates that before anything is persisted. If the model returns something malformed, it never reaches the database.
>
> Then it gets intersected with real eBay evidence — category from the Taxonomy API, item specifics, and active comparable listings from Browse.
>
> So the price isn't the model's opinion. It's evidence.
>
> For graded cards it goes further — PSA cert lookup, catalog resolution, eBay image search. And when identity is weak, it locks the price instead of guessing.

*Buffer line, only if still processing:*

> All of it runs on Cloudflare — Workers, D1, R2, KV, and Queues.

### Beat 4 — Review · screen · ~35s

*Scroll slowly and deliberately. One continuous scroll reads better than jumping.*

> And there it is. One screen.
>
> Title — built out of the words a buyer actually types into eBay search.
>
> Category. Condition. Item specifics. Every field editable. None of it typed by me.

*Punch in on pricing.*

> Price, with the comparables it used. These are active listings — what this thing is being asked for right now.
>
> And a confidence score. Because sometimes the honest answer is "I'm not sure."

### Beat 5 — Verify and publish · screen · ~25s

> Before it publishes, it verifies against eBay.

*If the BrandMPN blocker appears — this is a feature, not a failure. Slow down:*

> And there — eBay wants Brand and MPN. This item has neither, so it applies eBay's supported values for exactly that case. I fix it without leaving the page.

*Verify. Publish. Let the success state land before you speak.*

> That's a real fixed-price listing. On my own eBay account. Published through eBay's Inventory API.

### Beat 6 — Close · to camera · ~20s

> I built this with Codex. The Expo app, the Cloudflare Worker, the eBay OAuth and publish path, the upload queue, the Android debugging.
>
> I made the product calls — what it should do, and what it should refuse to do.
>
> Photos in. Listing out.
>
> The hard part was never the photo. It was the listing. That part's finished.

*Hard stop. No fade, no "thanks for watching," no outro.*

**Word count: ~420. At 150 wpm that's 2:48 of speech, plus the demo pauses.**

---

## 3. Recovery Lines

One take means something will go sideways. Have these ready so you don't freeze — every one
of them is truthful and several make the product look *better* than a clean run.

| If this happens | Say this | Then |
| --- | --- | --- |
| Draft comes back `needs_input` | "And there's the gate. It didn't have enough evidence to be confident, so it's asking me instead of guessing. That's the behavior I want." | Walk the blocker, then publish anyway if it's resolvable. This is a strong beat. |
| Price comes back unavailable or $0 | "No exact comparables — so it won't invent a price. I'd set this one myself." | Set a price manually, continue. |
| Publish rejects on something auto-repair doesn't cover | "eBay's rejecting this one — and that's the point of the verify step. It caught it before the listing went out wrong." | Cut to the pre-published listing tab. Do **not** claim the live one succeeded. |
| Queue runs much longer than expected | "This is real infrastructure, not a canned demo — sometimes it takes a beat." | Use the Cloudflare buffer line, then keep going on architecture. |
| You fumble a line | Say nothing. Pause. Start the sentence again. | You have three angles — the cut hides it completely. **Do not restart the take.** |

---

## 4. Claim Guardrails

Everything in the script above is inside `../docs/CLAIMS.md`. Watch these live:

- Say **"active comparables"** or "what it's being asked for." Never "sold for" — sold-comps
  pricing is not implemented.
- Say **"fixed-price."** Never "auction" — no verified auction adapter exists.
- Don't promise speed. "In this run" is fine; "always under a minute" is not.
- Don't claim automated test coverage. It isn't there.
- Don't mention iOS notifications. Android delivery was verified; iOS wasn't.
- Don't say the AI enhances photos. It recommends; it doesn't transform.
- No account identifiers, tokens, emails, or `.env` contents in any frame or on any monitor
  behind you.

## 5. After The Take

- [ ] Stop the screen recording **last**, after the cameras.
- [ ] Confirm the published listing is live and the images are buyer-reachable.
- [ ] Decide whether to end the test listing — it's a real one on your account.
- [ ] Pull all four files (3 cameras + screen recording) into the edit and sync on the clap.
- [ ] Watch once for anything on screen that shouldn't be public.
- [ ] If you time-compress the queue wait in the edit, say so in the video description.
- [ ] Upload under 3:00, verify in an incognito window, attach the URL to Devpost, then
      accept the final agreement box — the submission isn't complete without it.
