# ListingOS — Demo Video Script (OpenAI Build Week)

> **Status: current script.** Production spine is [`PRODUCTION_PLAN.md`](PRODUCTION_PLAN.md).
>
> Two things must be resolved before shooting:
> 1. **Publish footage blocker** — this script opens on `REAL LISTING · REAL ACCOUNT` and
>    narrates a successful publish at 2:00. The existing recording ends in a `BrandMPN`
>    validation failure. See `PRODUCTION_PLAN.md` §4.
> 2. **No on-camera founder beat exists in this script.** It is written as voiceover over
>    screen capture. If you need to appear on camera, see `PRODUCTION_PLAN.md` §2 for the
>    proposed slots.

Runtime target: 2:40–2:55 · Narration: founder's real voice · Edit: hard cuts, no fades

---

## 1. Script Table

| Time | Voiceover | Visual / Edit note |
| --- | --- | --- |
| 0:00–0:04 | "Photo. Listing. Live on eBay." | HARD CUT IN, no title card. `raw-screen-recordings/listingos-full-demo-a16.mp4` — thumb hits shutter, then whip-cut to the published eBay listing page on desktop. Two shots, 2s each. On-screen text: **REAL LISTING · REAL ACCOUNT** |
| 0:04–0:07 | *(silence — 1.0s hold on the live listing, then 2s of the eBay item page scrolling)* | PATTERN INTERRUPT. Let the price and item ID sit on screen unnarrated. On-screen text: item title + price overlay (redact account identifiers) |
| 0:07–0:10 | "The hard part was never the photo." | Cut to black. White text card, single line. **OPEN LOOP — resolves at 2:47.** |
| 0:10–0:16 | "Most people still don't know what to use AI for. They treat it like a toy." | `rotato-exports/listingos-rotato-3phone-demo.mp4` opener, slowed 20%. Register change: device mockup, clean background. |
| 0:16–0:22 | "The point of using AI is to make money. That's it. That's the whole reason it matters to a normal person." | Cut to full-frame text card, black on white. On-screen text: **USE AI TO MAKE MONEY** |
| 0:22–0:30 | "And AI doesn't make money by being brilliant. It makes money by being consistent." | PATTERN INTERRUPT — `product-image-sets/` montage, 12 real product sets, 6 frames per second, hard grid. |
| 0:30–0:40 | "A person can do a job perfectly. A person cannot do that job perfectly ten thousand times in a row. Machines can." | Grid montage continues, then freezes on a single frame. On-screen text: **PERFECT ≠ CONSISTENTLY PERFECT** |
| 0:40–0:50 | "That gap is the opportunity. Not intelligence. Repetition without drift." | Slow push-in on the frozen product grid. Hold 0.5s of silence on the last word. |
| 0:50–0:58 | "There are two ways to make money. Sell a service, or sell a product." | Register change: simple two-column on-screen diagram, no stock footage. On-screen text: **SERVICE / PRODUCT** |
| 0:58–1:05 | "A service needs trust, a conversation, a delivery date. A product needs one thing — somebody sees it and wants it." | Left column dims out. Right column fills frame. On-screen text: **TIME TO VALUE** |
| 1:05–1:10 | "Most people already own things worth money. What stops them is the listing. So point a camera at it." | Cut to hand raising a phone toward a real object on a table. `NEW CAPTURE NEEDED` — 4s locked-off shot. On-screen text: **ListingOS · Photos in. Listing out.** |
| 1:10–1:17 | "I pick photos. Then I pick one thing — sell fast, or sell high." | Real device footage, `listingos-full-demo-a16.mp4`. Photo picker → strategy toggle. Screen-only, no face. |
| 1:17–1:24 | "And then I leave. The draft builds in the background while I go do something else." | Seller navigates back to Home. Cut away mid-action to a wide shot of the phone face-down on a table. PATTERN INTERRUPT. |
| 1:24–1:27 | *(silence — 1.0s)* | Push notification lands on the lock screen. No narration. On-screen text: **DRAFT READY** |
| 1:27–1:36 | "It comes back as one screen. Title, category, condition, item specifics, price. Every field editable. None of it typed by me." | Review screen, single continuous scroll. Lower-third from `remotion/listingos-demo-entry.tsx`: **ONE REVIEW SCREEN** |
| 1:36–1:44 | "The title isn't clever. It's built out of the words a buyer actually types into eBay search." | Tight punch-in on the title field. Do not narrate the generation animation. |
| 1:44–1:52 | "Price comes from active eBay comparables and image-search candidates — evidence, not vibes." | Punch-in on the pricing block with the comparables list visible. On-screen text: **ACTIVE COMPARABLES** |
| 1:52–2:00 | "Anything eBay would reject shows up right here as a blocker. Policy, location, aspects. I fix it without leaving the page." | `assets/proof-mode/` blocker-repair fixture. Show the inline fix resolving. |
| 2:00–2:10 | "Verify. Publish. That's a live fixed-price listing on my own eBay account, published through eBay's Inventory API." | Verify → publish → success state. Then hard cut to the live eBay item page. On-screen text: **12 DRAFTS · 10 PRODUCT SETS · 9 READY · 3 REVIEW GATES** |
| 2:10–2:18 | "GPT-5.6 reads the photos through the OpenAI Responses API and returns strict structured output against a JSON Schema. The Worker validates it before anything is persisted." | Register change: architecture diagram, animated left to right. `NEW CAPTURE NEEDED`. On-screen text: **Responses API → JSON Schema → validate → D1** |
| 2:18–2:24 | "Then it gets intersected with real eBay evidence — category, aspects, comparables. Model output alone never reaches the database." | Diagram continues; eBay evidence node lights up. On-screen text: **Cloudflare Workers · D1 · R2 · KV · Queues** |
| 2:24–2:33 | "Graded cards get cross-checked against PSA, the Pokémon catalog, and eBay image search. When identity is weak, it locks the price for review instead of guessing." | Cut to the trust-gated graded card fixture on a real device. HOLD on the locked price state. On-screen text: **IT REFUSES TO GUESS** |
| 2:33–2:38 | "Codex built this with me. Expo app, Cloudflare Worker, eBay OAuth, the upload queue, the publish path. I kept the product calls." | Fast montage: Expo app, Worker code, device test rig. On-screen text: **Expo SDK 57 · React Native · Expo Router** |
| 2:38–2:44 | "Photos in. Listing out. Anything you own, priced with evidence, published to your own account." | Return to the product grid from 0:22, now with listing cards over each item. |
| 2:44–2:52 | "The hard part was never the photo. It was the listing. That part is finished — for anyone on earth who owns something." | Slow cut back to the opening 0:07 text card, now completed. **CLOSES THE OPEN LOOP.** |
| 2:52–2:53 | *(hard stop)* | Cut to black on the word "something." No fade, no outro, no music tail. Single frame: **listingos.expo.app** |

---

## 2. Three Alternate Cold Opens

**Option A — "Proof cut" (RECOMMENDED)**
> "Photo. Listing. Live on eBay." → 1s silence on the live item page → "The hard part was never the photo."
> *Optimizes for:* fastest possible evidence, and it plants the open loop the close pays off. Three-word opening line survives a muted autoplay because the on-screen text carries it.

**Option B — "The refusal"**
> Open on the graded card screen with pricing locked. "This is the AI deciding it doesn't know enough to price something. That's the feature."
> *Optimizes for:* judge respect on frame one. Riskier — it's the most sophisticated idea in the video and lands better after the viewer knows what the product does.

**Option C — "The pile"**
> Wide shot of twelve real objects on a table. "Every one of these is worth money. None of them are listed." → cut to all twelve as live listings.
> *Optimizes for:* relatability and scale. Slowest of the three to first proof, and it costs ~4 seconds you need in the thesis.

**Recommendation: A.** It's the only one that satisfies "proof before promise" *and* opens the loop.

---

## 3. On-Screen Text List

| Time | Text |
| --- | --- |
| 0:00 | REAL LISTING · REAL ACCOUNT |
| 0:05 | *(item title + price overlay)* |
| 0:07 | The hard part was never the photo. |
| 0:16 | USE AI TO MAKE MONEY |
| 0:34 | PERFECT ≠ CONSISTENTLY PERFECT |
| 0:50 | SERVICE / PRODUCT |
| 1:00 | TIME TO VALUE |
| 1:07 | ListingOS — Photos in. Listing out. |
| 1:25 | DRAFT READY |
| 1:29 | ONE REVIEW SCREEN |
| 1:46 | ACTIVE COMPARABLES |
| 2:05 | 12 DRAFTS · 10 PRODUCT SETS · 9 READY · 3 REVIEW GATES |
| 2:12 | Responses API → JSON Schema → validate → D1 |
| 2:20 | Cloudflare Workers · D1 · R2 · KV · Queues |
| 2:28 | IT REFUSES TO GUESS |
| 2:35 | Expo SDK 57 · React Native · Expo Router |
| 2:52 | listingos.expo.app |

---

## 4. B-Roll / Capture Shot List

**New capture needed:**

1. **Phone raised toward a real object** (1:05) — 4s, locked-off, natural light, hand entering frame from bottom right. Shoot 3 takes with different objects.
2. **Architecture diagram animation** (2:10–2:24) — Remotion composition, extend `listingos-demo-entry.tsx`. Nodes: Expo app → OAuth → R2 → Queue → Responses API → eBay evidence → D1 → review → publish. Reveal left to right, ~14s.
3. **Phone face-down on table during async draft** (1:17–1:27) — 10s, includes the push notification arriving on the lock screen. Must be a real notification, not a mockup.
4. **Product grid with listing cards overlaid** (2:38) — render from `product-image-sets/`, static composition.
5. **Code/device montage** (2:33) — 6s: Expo app running, Worker source, physical device on the test rig. Blur or crop any path containing account identifiers.

**Cut from existing assets:** everything else. Primary source `raw-screen-recordings/listingos-full-demo-a16.mp4`; blocker and graded-card beats from `assets/proof-mode/`; opener from `rotato-exports/`.

**Edit compliance:** if the queue-processing footage between 1:17 and 1:27 is time-compressed, the YouTube description must state that the wall-clock timing is documented in the repo rather than represented in the cut.

---

## 5. Word Count and Runtime

- **Voiceover word count: 399**
- At 150 wpm: **2 minutes 40 seconds** of narration
- Plus ~4.5s of marked silence and ~8s of breathing room distributed across cuts
- **Estimated total runtime: 2:53** (the beat grid runs to 2:53 and the read paces into it with margin) — under the 2:55 cap and the 3:00 Devpost limit
- Slightly under the 400–430 target, which is deliberate: it leaves room to slow the delivery on the thesis lines at 0:22–0:40 without pushing past 2:55

---

## 6. NEEDS VERIFICATION

Claims I wanted and did not use, because they are not on the approved list:

1. **"Built in five days" / any Build Week timeline claim.** No build duration is in the fact pack. Would strengthen the Codex beat considerably — verify and I'll add it.
2. **A concrete accuracy or acceptance rate** (e.g. "9 of 12 drafts published without edits"). The fact pack gives 12 drafts / 9 ready / 3 review gates as counts, but not a stated accuracy interpretation. I used them only as raw on-screen counts.
3. **Any dollar figure for a real sale.** No sold-through or realized-revenue data is approved, so no "sold for $X" moment exists in this cut.
4. **Number of eBay categories or item types supported.** Would justify the "generalizes" claim in the montage more strongly than the 12 product sets alone.
5. **"Under a minute" as a general expectation.** Deliberately excluded — the approved wording restricts it to the recorded run only, and it doesn't fit in the tightened narration without an awkward qualifier. Available if you want it back at 1:27 as an on-screen text card reading `RECORDED RUN: DRAFT READY IN <60s`.

---

## 7. Compliance Self-Check

| Requirement | Status |
| --- | --- |
| Under 3:00 | ✅ 2:53 estimated, 399 words at 150 wpm |
| States what was built | ✅ 1:05–2:10 — camera-first eBay seller agent, photos to published listing |
| States how GPT-5.6 was used | ✅ 2:10–2:24 — Responses API, strict JSON Schema output, Worker validates before persistence, intersected with eBay evidence |
| States how Codex was used | ✅ 2:33–2:38 — Expo app, Worker, eBay OAuth, upload queue, publish path; human kept product decisions |
| No sold-comps claim | ✅ 1:44 says "active eBay comparables and image-search candidates" |
| No auction claim | ✅ 2:00 says "fixed-price listing" explicitly |
| No image enhancement claim | ✅ not mentioned |
| No subscription/revenue claim | ✅ not mentioned |
| No universal speed promise | ✅ no time figure appears in narration at all |
| No automated-test claim | ✅ not mentioned |
| No eBay affiliation implied | ✅ "my own eBay account," "through eBay's Inventory API" — usage, not partnership |
| No upload-resume-after-termination claim | ✅ not mentioned |
| No secrets or account identifiers | ✅ flagged for redaction at 0:05 and 2:33; publish beat uses proof mode or the already-published result |
| Banned phrases | ✅ zero instances; no opening rhetorical question; no sentence begins with "So" *(1:05 "So point a camera at it" — flagged, use "Point a camera at it.")* |
| No open-source/OpenAI-business beat | ✅ cut as instructed |
| Human narration | ✅ script written for the founder's voice; no synthetic narration, no disclosure required |

**One fix before recording:** line 1:05 as written contains "So point a camera at it." Drop the "So." Final read is **"Most people already own things worth money. What stops them is the listing. Point a camera at it."** Word count above already reflects the corrected line.
