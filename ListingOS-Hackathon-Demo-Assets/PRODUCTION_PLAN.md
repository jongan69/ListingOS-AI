# ListingOS Demo — Production Plan

Status: superseded planning record · Last reconciled 2026-07-21

> The video described below is not the current submission artifact. Devpost now embeds
> YouTube video `I67o7B2JfYQ`. The intended replacement is the verified 2:30 cut documented
> in [`final-renders/README.md`](final-renders/README.md). Use
> [`../docs/SUBMISSION_CHECKLIST.md`](../docs/SUBMISSION_CHECKLIST.md) for the remaining
> deadline gates. Keep this file only as production provenance.

This was the organizing document for the planned demo video. It exists because the folder
previously held two incompatible plans — a fully automated Remotion render and a
live-narrated script — with nothing describing how they combine.

They combine as **two tracks**, not two videos.

---

## 1. The Two-Track Model

| | Track A — Live | Track B — Automated |
| --- | --- | --- |
| What it is | Founder on camera, real device screen recording, real eBay pages | Rotato device mockups, Remotion cards/lower-thirds/diagrams, burned-in captions, product-grid stills |
| What it carries | **Evidence.** Things that must be true. | **Abstraction.** Things that must be clear. |
| Source of truth | Yes. Track A is the demo. | No. Track B annotates Track A. |
| May it stand alone on screen? | Yes, indefinitely | Yes, but only during argument beats — never during a proof beat |

**The rule that resolves the organization problem:** Track B may *annotate* evidence
but never *replace* it. If the viewer is being asked to believe something happened,
Track A is on screen. If the viewer is being taught an idea, Track B can own the frame.

This is a register separation, not a timing problem. The two tracks do not need to
blend smoothly — they need to alternate legibly. Visible register changes are the
edit's rhythm, which is why `DEMO_VIDEO_SCRIPT_V2.md` calls for hard cuts and no fades.

### Why the earlier automated-only approach failed

The Remotion/Rotato masters described in `FINAL_VIDEO_NOTES.md` were rendered while
the product was incomplete and the required footage did not exist. Track B was doing
Track A's job: polish standing in for proof. Those renders are retained as tooling
references only. See [`archive/automated-pass/`](archive/automated-pass/) for the record.

---

## 2. Open Problem: You Are Not In The Script Yet

`DEMO_VIDEO_SCRIPT_V2.md` is written as voiceover over screen capture. There is **no
on-camera founder beat anywhere in it.** If you need to appear in the video, the script
requires an edit pass before shooting.

Under the register rule, you belong on the **argument** beats — not the proof beats.
Recommended slots, in priority order:

| Slot | Time | Currently | Proposal | Why |
| --- | --- | --- | --- | --- |
| 1 | 0:07–0:10 | Black text card | You, to camera: *"The hard part was never the photo."* | Opens the loop with a human face right after the cold-open proof. Highest impact, lowest risk. |
| 2 | 2:33–2:38 | Code/device montage | You, to camera: *"Codex built this with me. I kept the product calls."* | A credibility claim about your own judgment should come from you, not a voiceover. |
| 3 | 2:44–2:52 | Return to 0:07 text card | You, to camera, closing the loop | Pays off slot 1 with the same framing. Strongest possible close. |
| 4 | 0:50–1:05 | SERVICE / PRODUCT diagram | You, to camera, with the diagram as overlay | Pure thesis, zero evidence. Safe to hold on a person. Optional — costs ~15s of screen time. |

Slots 1 + 3 alone give you a bookended on-camera presence for roughly 11 seconds and
require **one lighting setup and one framing**. That is the minimum viable version of
"I need to be in it" and it does not disturb the proof spine at all.

If you take slots 1, 2, and 3: one setup, three takes, ~17s total on camera.

**Decision needed before any shooting.** Everything downstream depends on it.

---

## 3. Beat Map

Track A = live/evidence · Track B = automated/overlay · Times from `DEMO_VIDEO_SCRIPT_V2.md`

| Time | Beat | Track | Asset | Status |
| --- | --- | --- | --- | --- |
| 0:00–0:04 | Photo → listing → live | A | Device recording + published eBay page | ⚠️ **Blocked** — see §4 |
| 0:04–0:07 | Hold on live listing | A | eBay item page capture | ⚠️ **Blocked** — see §4 |
| 0:07–0:10 | "The hard part was never the photo" | B *(or A — slot 1)* | Text card or on-camera | Not built |
| 0:10–0:16 | Three-phone device opener | B | Rotato render | Absent — regenerate, see §5 |
| 0:16–0:22 | USE AI TO MAKE MONEY | B | Full-frame text card | Not built |
| 0:22–0:30 | Product montage, 6 fps | B | `product-image-sets/` | ✅ Fixtures present (12 sets) |
| 0:30–0:40 | Montage freezes | B | Same | ✅ Present |
| 0:40–0:50 | Push-in on frozen grid | B | Same | ✅ Present |
| 0:50–0:58 | SERVICE / PRODUCT | B *(or A — slot 4)* | Two-column diagram | Not built |
| 0:58–1:05 | TIME TO VALUE | B | Same diagram, right column | Not built |
| 1:05–1:10 | Phone raised toward object | A | New capture, 4s locked-off | ❌ **Needs capture** |
| 1:10–1:17 | Picker → strategy toggle | A | `listingos-full-demo-a16.mp4` | ⚠️ Gitignored, not in checkout |
| 1:17–1:24 | Navigate away, phone face-down | A | New capture, 10s | ❌ **Needs capture** |
| 1:24–1:27 | Push notification lands | A | Real notification, not mockup | ❌ **Needs capture** |
| 1:27–1:36 | Review screen scroll | A + B | Device footage + lower-third | ⚠️ Footage gitignored |
| 1:36–1:44 | Title field punch-in | A | Same source | ⚠️ Footage gitignored |
| 1:44–1:52 | Pricing + comparables | A + B | Same source + ACTIVE COMPARABLES card | ⚠️ Footage gitignored |
| 1:52–2:00 | Blocker repair inline | A | `../assets/proof-mode/` | Verify fixture covers this |
| 2:00–2:10 | Verify → publish → live | A | Publish success capture | ⚠️ **Blocked** — see §4 |
| 2:10–2:18 | Architecture diagram | B | Extend `remotion/listingos-demo-entry.tsx` | ❌ **Needs build**, ~14s |
| 2:18–2:24 | eBay evidence node | B | Same composition | ❌ **Needs build** |
| 2:24–2:33 | Graded card, price locked | A | Trust-gated card fixture on device | Verify fixture exists |
| 2:33–2:38 | Codex beat | A *(slot 2)* | Montage or on-camera | ❌ **Needs capture** |
| 2:38–2:44 | Product grid + listing cards | B | Render from `product-image-sets/` | ❌ **Needs build** |
| 2:44–2:52 | Loop closes | B *(or A — slot 3)* | Callback to 0:07 | Not built |
| 2:52–2:53 | Hard stop | B | `listingos.expo.app` single frame | Not built |

**Track A beats: 13. Track B beats: 13.** Roughly even, which is correct — but note that
every *proof* beat is Track A and every *idea* beat is Track B. The rule holds throughout
the script as written.

---

## 4. Blocker: The Publish Success Footage

**This is the most important open item in the folder and it affects three beats.**

The documents disagree about whether a successful live eBay publish was ever recorded:

- `notes/devpost-android-cut-qa.md` states the recorded run's publish attempt **failed**
  with an eBay `BrandMPN` validation blocker, and that this was deliberately preserved as
  honest QA evidence rather than presented as success.
- `DEMO_TESTING_NOTES.md` lists "Live eBay publish proof: passed in the verified run."
- `DEMO_VIDEO_SCRIPT_V2.md` opens on **REAL LISTING · REAL ACCOUNT** and narrates a
  successful publish at 2:00–2:10.

The reconciliation, per `../docs/CLAIMS.md`: the *product* demonstrably publishes real
fixed-price listings — published D1 attempts contain real listing and offer IDs, and that
claim is rated High confidence and approved for public use. What is missing is **footage
of a successful publish**. The continuous demo recording ends in a failure state.

Three legitimate ways forward:

1. **Capture a new successful publish** on a controlled test item, verifying the
   `BrandMPN` aspect is satisfied beforehand. Cleanest — unblocks 0:00, 0:04, and 2:00 as written.
2. **Use a previously published listing as separate proof.** Show verify → publish → success
   state, then hard-cut to the already-live eBay item page. This is truthful as long as the
   edit does not imply one continuous take. This was the standing rule in the earlier
   planning notes and it remains sound.
3. **Restructure the cold open** away from publish proof. Costs the strongest opening in the script.

Option 1 is preferred. Option 2 is the fallback and must be disclosed in the video
description if the cut implies continuity.

**Do not shoot the cold open until this is resolved.** The entire compliance posture of the
submission rests on it, and `../docs/CLAIMS.md` is the binding authority.

---

## 5. Track B Assets: What Regenerates, What Does Not

All `.mp4` files in this workbench are gitignored. Absence from a fresh checkout is
expected and is **not** evidence the file was never made.

| Asset | Regenerable? | How |
| --- | --- | --- |
| Rotato three-phone opener | Yes | `rotato-project-inputs/Fast 3 Phones (Autosaved).rotato` is checked in — see `rotato-exports/README.md` |
| Remotion composition renders | Yes | `remotion/listingos-demo-entry.tsx` is checked in — see `remotion/README.md` |
| Caption pass | Yes | Style config, cleanup script, and caption JSON are checked in — see `clipcaption-projects/README.md` |
| Product montage / grid | Yes | `product-image-sets/` fixtures are checked in |
| Raw device recordings | **No** | Must be re-captured on device |
| Published-listing page capture | **No** | Must be re-captured |
| On-camera founder footage | **No** | Not yet shot |

Everything in the "no" column is Track A. That is the correct risk profile — the
irreplaceable material is the evidence, and it is the material that still needs shooting.

---

## 6. Shot List for Remaining Capture

Consolidated from §3. One device session, one camera session.

**Device session** (Samsung Galaxy A16, release APK, per `notes/a16-camera-flow-qa.md`):

1. Successful publish run, start to live listing — resolves §4 option 1
2. Published eBay item page, desktop browser, account identifiers redacted
3. Push notification arriving on the lock screen, real not mocked
4. Graded-card beat with price locked for review
5. Blocker repair resolving inline

**Camera session** (one lighting setup, one framing):

6. Phone raised toward a real object, 4s locked-off, natural light, hand entering from bottom right — 3 takes, different objects
7. Phone face-down on table during async draft, 10s
8. On-camera founder beats per §2 — slots 1 and 3 minimum, slot 2 if taken
9. Code/device montage: Expo app running, Worker source, device on test rig — 6s, blur any path containing account identifiers

**Build session** (no capture):

10. Architecture diagram, ~14s, extend the Remotion composition
11. Text cards: 0:07, 0:16, 0:50, 2:44, 2:52
12. Product grid with listing cards overlaid

---

## 7. Standing Rules

Carried forward from the earlier planning notes; these survived review and still apply.

- First three seconds are product, never a logo.
- No secrets, tokens, emails, or account identifiers on screen at any point.
- Do not imply a fresh live publish unless the footage proves it. See §4.
- Do not imply instant listing if the footage shows a wait. If queue processing is
  time-compressed, the video description must say wall-clock timing is documented in
  the repo rather than represented in the cut.
- Portrait capture for core mobile clips; slow, deliberate gestures.
- No debug overlays, dev menus, or notification noise in device captures.
- Keep the app's dark glassy look; do not over-warm. White UI text must stay crisp.
- Every public claim stays inside `../docs/CLAIMS.md`. Fixed-price publishing is approved;
  auction publishing, sold-comps pricing, and universal iOS notification delivery are not.
- Narration is the founder's real voice. If any synthetic narration is reintroduced, it
  must be disclosed in the upload metadata.

## 8. Compliance

`DEMO_VIDEO_SCRIPT_V2.md` §7 carries a self-check against the submission requirements.
It passes as written **provided §4 is resolved** — the "no sold-comps claim," "no auction
claim," and "no universal speed promise" lines are all satisfied by the current script,
but "REAL LISTING · REAL ACCOUNT" at 0:00 is only defensible with footage that supports it.

One outstanding line edit noted in that script: 1:05 reads "So point a camera at it."
Drop the "So."
