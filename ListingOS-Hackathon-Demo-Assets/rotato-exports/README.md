# Rotato Exports

## Rendered opener

`listingos-rotato-3phone-demo.mp4` is a real Rotato render from the packaged `../rotato-project-inputs/Fast 3 Phones (Autosaved).rotato` project. The same horizontal ListingOS master was injected into all three device screens through Rotato's bundled renderer.

`listingos-rotato-3phone-demo-repro.mp4` is the reproducibility render produced during the final demo sprint from the checked-in project source and the verified horizontal base master.

The source library for this pass was `/Users/jonathangan/Desktop/Rotato-Animation-Templates`. The final opener uses `Esssential Mix v2.3/Phone - Fast 3 Phones/Fast 3 Phones.rotato`; the approved variant board uses the viable `.rotato` projects from `Mega-Multi 1.0` and `Esssential Mix v2.3/Phone - Simple All-Screen Tour`.

- Output: H.264, 1920x1080, 30 fps
- Duration: 7.23 seconds
- Source template: `../rotato-project-inputs/Fast 3 Phones (Autosaved).rotato`
- Final composite: `../final-renders/listingos-horizontal-demo-rotato-enhanced-20260718.mp4`

The final composite starts with this device-mockup opener and then continues into the real Android listing flow. The original base master remains unchanged for technical fallback and auditability.

## Variant Board

All accepted variants below were rendered at 1920x1080 with the source media matched to the scene's screen orientation. They are intentionally separate from the final demo so future edits can choose the right energy for the beat.

| Export | Scene role | Source treatment | Status |
| --- | --- | --- | --- |
| `variants/listingos-2-phone-side-by-side-portrait-v1.mp4` | Two-device hero or comparison | Portrait Android camera footage applied to both phone screens | Approved |
| `variants/listingos-3-phone-side-by-side-portrait-v1.mp4` | Fast montage transition | Portrait Android capture applied to all three phones | Approved |
| `variants/listingos-4-phone-side-by-side-portrait-v1.mp4` | Feature montage / scale proof | Portrait Android capture applied to all four phones | Approved |
| `variants/listingos-simple-tour-portrait-v1.mp4` | Single-device product intro | Portrait Android camera footage fills the phone screen | Approved |

`variants/listingos-rotato-variant-reel-v1.mp4` is a short review reel assembled from the approved variants. Use the individual clips for final editing so the timing can follow the narration and the product story.

## Rejected Assets

`rejected/listingos-spiral-phones-portrait-v1-placeholder-rejected.mp4`, `rejected/listingos-middle-down-portrait-v1-placeholder-rejected.mp4`, and `rejected/listingos-phones-stacked-portrait-v1-placeholder-rejected.mp4` are retained for audit only. The scenes kept unrelated template content or Rotato's own upload placeholder, so they must not be used in a ListingOS deliverable. This is the visual QA gate for every future Rotato render: no template placeholder, unrelated app, or unverified screen may survive into an edit.

Several desktop files are `.rotatotemplate` files rather than editable `.rotato` projects. The local Rotato CLI cannot render those directly; they require opening and saving them in the Rotato app first. The current board therefore uses the viable `.rotato` projects and records this limitation instead of pretending the template files rendered successfully.
