# Final Shot Plan (Devpost cut, < 3:00)

Source of truth: docs/DEMO_SCRIPT.md + docs/DEMO_RECORDING.md. This file maps each
shot to its capture surface, Rotato treatment, and caption beat.

## Beats

| # | Shot | Surface | Length | Rotato treatment | Caption beat |
|---|------|---------|--------|------------------|--------------|
| 1 | Cold open: hero photo fills frame, badge "N photos selected" | app capture | 0:04 | phone pop-up entrance | "Photos in. Listing out." |
| 2 | Home screen, connected seller pill + readiness | app capture | 0:10 | slow dolly | "Sign in with your real eBay account" |
| 3 | Photo intake: pick 3-8 shots | app capture | 0:15 | straight-on | "Pick one product" |
| 4 | Queue / background processing | app capture | 0:15 | slight tilt | "Cloudflare Workers + R2 + Queues do the heavy lifting" |
| 5 | Review screen: AI title, price ladder, specifics, confidence | app capture | 0:35 | slow zoom on fields | "GPT-5.6 writes the draft. You review the exceptions." |
| 6 | Blocker handling or clean-verify state | app capture | 0:15 | straight-on | "eBay requirements checked before publish" |
| 7 | Verify -> publish path | app capture | 0:15 | dolly | "Fixed-price publish via eBay Inventory API" |
| 8 | Published listing proof (existing listing) | app capture | 0:15 | phone rotate flourish | "A real listing. Not a mockup." |
| 9 | End card: brand + value prop | still/art | 0:08 | logo hero | "ListingOS — photos in, verified eBay listing out." |

## Rules

- First 3 seconds must be product, not logos (per assets README).
- No secrets/tokens/emails on screen.
- Do NOT imply a fresh live publish unless the recording proves it; use the
  existing published listing as proof (docs/CLAIMS.md).
- Keep total under 3:00 for Devpost; target 2:15-2:45.

## Recording rig

- Surface: physical Android (preferred, per docs) or web build at 375x812.
- Android: `adb shell screenrecord --bit-rate 12000000 --time-limit 170` per shot,
  pull to raw-screen-recordings/ with the listingos-raw-*.mov naming convention.
- Narration recorded separately; captions carry the story if VO slips.
