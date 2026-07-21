# Demo Video Script Generation Prompt

> **Status: superseded prompt record.** It produced the pre-publication script, not the
> video currently attached to Devpost. Current media and replacement metadata live in
> [`../ListingOS-Hackathon-Demo-Assets/final-renders/README.md`](../ListingOS-Hackathon-Demo-Assets/final-renders/README.md).

Purpose: a single self-contained prompt for generating the OpenAI Build Week demo video script for ListingOS, plus the grounded fact pack that keeps the generated script inside verified claims.

How to use: paste everything between the `PROMPT START` and `PROMPT END` markers into a fresh model session. The fact pack is embedded inside the prompt on purpose — do not strip it, because it is the only thing preventing a generated script from inventing features ListingOS does not ship.

Companion docs: [Submission claims](CLAIMS.md), [Devpost submission pack](DEVPOST_SUBMISSION.md), [Demo recording checklist](DEMO_RECORDING.md), [Monetization plan](MONETIZATION.md).

**Historical output:** [`ListingOS-Hackathon-Demo-Assets/DEMO_VIDEO_SCRIPT_V2.md`](../ListingOS-Hackathon-Demo-Assets/DEMO_VIDEO_SCRIPT_V2.md) is the superseded script this prompt produced. Do not regenerate the current submission video from this prompt.

---

## PROMPT START

You are a senior YouTube script writer who specializes in technical product films for developer audiences. You write for retention first and credibility second, and you never trade one for the other. Your scripts get watched to the end by people with short attention spans and respected by people who read source code.

Write the complete voiceover script and shot plan for a demo video for **ListingOS**, submitted to the **OpenAI Build Week hackathon** on Devpost.

### Hard constraints

- **Total runtime: 2:40–2:55.** Devpost hard-caps at 3:00. Do not exceed 2:55 in estimated read time. Assume a natural speaking pace of ~150 words per minute, so the full script should land at roughly **400–430 words of voiceover**. Count them and report the count.
- The video must explicitly cover three things, because Devpost judging requires them:
  1. What was built.
  2. How **GPT-5.6** was used.
  3. How **Codex** was used.
- Every factual claim must come from the APPROVED CLAIMS list below. If a claim is not on that list, do not make it. If you want to say something not covered, flag it in a `NEEDS VERIFICATION` block at the end instead of putting it in the script.
- Narration will be recorded in the founder's real voice. Write for the mouth, not the page: short sentences, hard consonants, no clauses that require a breath mid-thought.

### Tone and style

Write like a confident builder talking to smart peers — not like a startup ad, not like a lecture, and not like a corporate explainer.

- **Banned:** "imagine a world where," "game-changer," "revolutionary," "seamlessly," "leverage," "unlock," "in today's fast-paced," "we're excited to," any rhetorical question that opens the video, any sentence starting with "So."
- **Wanted:** declarative sentences. Concrete nouns. Real numbers. One idea per sentence. Occasional deliberate fragments for rhythm.
- Confidence without arrogance. The product's honesty about its own limits is a feature — lean into it, do not hide it.

### The argument (this is the spine — do not paraphrase it away)

The video opens with a thesis, not a feature tour. The thesis is the founder's, and it must survive intact:

1. **Most people have no idea what to actually use AI for.** They treat it as a novelty or a chat toy.
2. **The point of using AI is to make money.** Say this plainly. It is the line that earns attention because nobody else says it.
3. **The reason AI makes money is consistency, not brilliance.** A human can achieve perfection. A human cannot achieve perfection *repeatedly, at volume, without drift*. AI can execute a repetitive task the same way the ten-thousandth time as the first time. That gap — perfection versus *consistent* perfection — is the entire economic opportunity.
4. **There are exactly two ways to make money: sell a service, or sell a product.**
5. **A product has a much faster path to realized perceived value.** A service requires trust, negotiation, delivery time, and a relationship before anyone pays. A product can be seen, wanted, and bought in seconds. Time-to-value is the whole game.
6. **Therefore: selling a product is the fastest thing AI can help a normal person do — if they have the right tool.** Most people already own things worth money. What stops them is not inventory. It is the friction of listing.
7. **That tool is ListingOS.** Point the camera. Get a real, priced, verified, publishable listing. This is for literally anyone on earth who owns something.

Do not include any argument about open-source models commoditizing AI, or about what OpenAI does or does not sell. That beat is deliberately cut.

The transition from thesis to product must be earned in a single sentence, not announced. Never write "that's why we built" or "which brings me to."

### Structure and beat budget

Produce the script in these beats, with the runtime for each. You may shift ±5 seconds between beats but not the totals.

| # | Beat | Time | Job |
| --- | --- | --- | --- |
| 1 | **Cold open** | 0:00–0:10 | Proof before promise. Open on the fastest, most visceral evidence: photo taken → finished eBay listing live. No talking about what's coming. One sentence max over it. |
| 2 | **Thesis** | 0:10–0:50 | Argument points 1–3. The money line and the consistency insight. This is the retention bet — it must be the most quotable part of the video. |
| 3 | **The turn** | 0:50–1:10 | Argument points 4–6. Service vs. product, time-to-value, anyone can sell. Ends by landing on ListingOS without a signpost phrase. |
| 4 | **The demo** | 1:10–2:10 | The proof. Real device footage, narrated as it happens. Photos in → async draft → one review page → blocker handling → verify → publish → live listing. Narrate *what the seller does*, not what the screen contains. |
| 5 | **Under the hood** | 2:10–2:38 | GPT-5.6 and Codex, specifically and technically. This is where judges decide whether to respect you. Name the actual APIs and the actual architecture. Include the honesty beat: the system refuses to price what it cannot identify. |
| 6 | **Close** | 2:38–2:55 | Return to the thesis. "Anyone on earth" lands here, not earlier. End on a hard stop, not a fade. No "thanks for watching." |

### Retention craft — apply these explicitly

This is edited like a high-engagement YouTube video, so write for the edit:

- **No throat-clearing.** The first frame is evidence. The first spoken word is load-bearing.
- **Open loop early, close it late.** Plant something in the cold open that only resolves in the close.
- **Pattern interrupt every 15–20 seconds** — a cut to a different visual register (device mockup, screen recording, product grid, on-screen text card, a hard silence). Mark each one in the shot column.
- **On-screen text carries the numbers so the voiceover doesn't have to.** Any statistic, price, or ID should be a text overlay while the VO says something more interesting.
- **Silence is a tool.** Mark at least two deliberate 0.5–1s beats of no narration where the footage does the talking.
- **Never narrate what is visibly on screen.** If the viewer can see the title generate, say something about *why it is a good title*, not that it appeared.

### Output format

Produce, in this order:

**1. Script table** — three columns, one row per beat of narration (roughly 5–9 seconds each):

| Time | Voiceover | Visual / Edit note |

The visual column must name the specific footage or asset, the cut type, and any on-screen text. Use only assets from the ASSET INVENTORY below, or explicitly mark `NEW CAPTURE NEEDED`.

**2. Three alternate cold opens** — the first 10 seconds, written three different ways, each with a one-line note on what it optimizes for. Label your recommendation.

**3. On-screen text list** — every text overlay, in order, with its timecode. Keep each under 7 words.

**4. B-roll / capture shot list** — everything that must be recorded or rendered that does not already exist.

**5. Word count and estimated runtime.**

**6. `NEEDS VERIFICATION` block** — any claim you wanted to make that is not in the approved list.

**7. Compliance self-check** — confirm line by line: under 3:00, states what was built, states how GPT-5.6 was used, states how Codex was used, contains zero forbidden claims, contains no secrets or account identifiers.

---

### FACT PACK

#### What ListingOS is

ListingOS is a camera-first AI seller agent for eBay. A seller connects their own eBay account, selects product photos, chooses whether they care more about selling fast or maximizing profit, and gets back a complete, priced, eBay-verified listing draft on a single review screen — then publishes it to eBay from the phone.

Positioning line: **Photos in. Listing out.**

The core insight to convey: sellers do not need another dashboard. They need a listing machine.

#### Architecture (safe to state, all verified)

- Mobile: **Expo SDK 57**, React Native, Expo Router, TanStack Query, Zod, SecureStore.
- Backend: **Cloudflare Workers** with Hono, **D1** (database), **R2** (media), **KV** (ephemeral state), **Queues** (background draft generation).
- AI: **GPT-5.6 via the OpenAI Responses API**.
- Marketplace: eBay **OAuth, Browse, Taxonomy, Account, Inventory, Identity, and Media** APIs.

Flow, in order: Expo app → eBay OAuth → upload session → R2 → Cloudflare Queue → OpenAI Responses API (product images + strict JSON Schema) → eBay category and comparable evidence → validated draft in D1 → one-page review with inline blocker fixes → verify → eBay Media API → eBay Inventory API publish → result in D1 + push notification.

#### How GPT-5.6 is used (must appear in the video)

GPT-5.6 receives the product photos plus marketplace context through the OpenAI Responses API and returns **strict structured output against a JSON Schema**: title options, category, condition notes, buyer-ready description, item specifics, pricing context and strategy, missing information, a confidence score, and predicted publish blockers. A second high-detail structured pass runs when graded-card label OCR is needed.

The Worker **validates model output before it is persisted**, then intersects it with real eBay evidence. The prompt is tuned for marketplace-honest copy: no invented accessories, no fake condition claims, no unsupported authenticity claims, no overconfident card identity guesses.

**The strongest technical beat in the whole video:** for graded trading cards, ListingOS cross-checks the model's reading against PSA cert lookup, Pokémon catalog resolution, and eBay image-search comparables. When identity or comparable evidence is weak, it **locks pricing for review instead of guessing**. A system that knows when to refuse is the thing that separates a demo from a product. Give this its own moment.

#### How Codex is used (must appear in the video)

Codex was the primary implementation partner: stack design, scaffolding the Expo app and the Cloudflare Worker, implementing eBay OAuth and the publish path, building the photo upload queue, debugging Android device crashes, fixing public image delivery so eBay could fetch listing photos, hardening card identification, polishing the mobile UI, writing documentation, and repeated physical-device validation loops.

The human decisions — and these should be stated, because they are the credible part: seller-first product direction, camera-style UX, the insistence on minimal seller input, the fixed-price MVP scope, visual taste, live eBay account decisions, and the requirement that publishing happen fully in-app against the seller's own account.

#### APPROVED CLAIMS — exact permitted wording

Use these claims. Prefer this wording.

- Built with Expo SDK 57, React Native, and Expo Router.
- GPT-5.6 analyzes product photos through the OpenAI Responses API.
- GPT-5.6 returns strict structured output that the Worker validates before persistence.
- Draft generation runs asynchronously while the seller continues from Home.
- Backed by Cloudflare Workers, D1, R2, KV, and Queues.
- Sellers connect with eBay OAuth and publish through their own account.
- Publishes verified fixed-price listings through eBay's Inventory API.
- Media is ingested by eBay before publish, so buyer-facing galleries use eBay-hosted images.
- Uses active eBay comparable listings and image-search candidates. *(Qualified — see forbidden list.)*
- Cross-checks graded cards against PSA, catalog, and eBay evidence; weak identity locks pricing for review.
- Surfaces eBay blockers inline and resolves supported policy, location, and aspect issues in-app. *(Qualified.)*
- One review screen keeps AI defaults editable before verify and publish.
- The fixed-price path has produced real eBay listing and offer identifiers through the Inventory API.
- In the recorded run, the draft reached review in under one minute. *(Only as a statement about the recording — never as a general promise.)*

Measured test results, safe to show as on-screen text: **12 draft records, 10 distinct product sets, 9 ready, 3 review gates.**

#### FORBIDDEN CLAIMS — do not write these under any phrasing

- ❌ Sold-comps or sold-item pricing data. Pricing uses **active** listings only. Never imply sold data or a calibrated time-to-sale model.
- ❌ Auction publishing. Fixed-price is the only verified path. Auction is roadmap.
- ❌ Automatic image enhancement or generated image variants. The AI returns an enhancement *plan* only.
- ❌ Live subscriptions or revenue. RevenueCat metering is implemented but production store products are not finalized. Do not state pricing tiers as available.
- ❌ Any universal speed promise ("listings in 30 seconds," "under a minute, every time"). The sub-minute figure describes one recorded run only.
- ❌ Automated test coverage. Unit, integration, and E2E suites are not in place. The real gates are strict lint and type checks, Expo Doctor, Worker dry-run, web export, and physical-device testing — say that instead if test rigor comes up.
- ❌ Any affiliation with, endorsement by, or partnership with eBay. ListingOS is an independent project.
- ❌ Uploads resuming after the OS terminates the app.
- ❌ Any API key, OAuth code, token, `.env` contents, developer dashboard, or personal seller account identifier on screen.

#### Required disclosures

- If any footage of queue processing is time-compressed in the edit, the video or its description must not present it as raw wall-clock speed. Verified backend timestamps and live publish proof are documented in the repo.
- The narration must be the founder's real voice. Any synthetic narration requires explicit disclosure in the upload metadata — so the final cut should simply use a human recording.

#### ASSET INVENTORY (what already exists to cut from)

Located in `ListingOS-Hackathon-Demo-Assets/`. Note that the video files below are gitignored by design — they exist only on the local editing machine, not in the repository:

- `raw-screen-recordings/listingos-full-demo-a16.mp4` — continuous real Android release footage, the technical fallback and source of truth.
- `final-renders/listingos-horizontal-demo-remotion-v1.mp4` — 1920×1080 H.264, 132s, with chapters, lower-thirds, progress rail.
- `rotato-exports/listingos-rotato-3phone-demo.mp4` — 7.2s three-device mockup opener.
- `product-image-sets/` — 12 real product sets (compact camera, electronics, two books, USB-C adapter, two graded cards, leather wallet, sunglasses, wireless earbuds, car charger, lighter). Excellent for a fast montage proving the workflow generalizes beyond one curated item.
- `thumbnails/listingos-horizontal-demo-thumbnail.jpg`
- `remotion/listingos-demo-entry.tsx` — reusable Remotion composition for chapters and lower-thirds.
- Proof-mode fixtures in `assets/proof-mode/`: a published general item, a trust-gated graded card, a blocker-repair example. Non-mutating, safe to film.

Public surfaces: web app at `listingos.expo.app`, repo at `github.com/jongan69/ListingOS-AI`.

#### Recording safety

Do not create duplicate production eBay listings while recording. Use proof mode or the already-published result for the publish beat. Never show secrets or account identifiers.

## PROMPT END

---

## Notes for Jon

**Why the thesis works here.** The consistency argument is the strongest thing in your outline and it is genuinely underused — most people pitch AI on capability ("it can do X") when the real economic claim is reliability ("it does X the same way every time"). Keep that sentence short and let it sit. It is the most quotable line you have.

**The one structural risk.** A 50-second thesis before any product is a long time on Devpost. It is defensible *only* if the cold open shows real proof in the first ten seconds. If the opener is a logo or a title card, the thesis reads as stalling. Lead with the published eBay listing.

**Where the judges actually decide.** Beat 5. Most hackathon videos say "we used GPT-5.6." Very few can say "we constrained it to a JSON Schema, validated the output before persistence, intersected it with third-party evidence, and built a refusal path for low-confidence identity." That last part is the highest-value 8 seconds in the video — the card-pricing lock is the clearest signal that you built a product and not a demo.

**Timeline.** The Build Week window closes **July 21, 2026 at 5:00 PM Pacific** — roughly one day out. Remaining blockers per `DEVPOST_SUBMISSION.md`: record the human voiceover, cut the final edit, upload publicly to YouTube, add the URL to Devpost, accept the rules, and submit.
