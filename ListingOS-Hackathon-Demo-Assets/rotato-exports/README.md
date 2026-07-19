# Rotato Exports

Local output directory for device-mockup renders. **Empty in a fresh checkout** — all
`.mp4` files here are gitignored. The render source is checked in, so everything below
is reproducible.

Rotato material is Track B (overlay). Under the two-track model it may open or punctuate
the video but must never stand in for device evidence. See `PRODUCTION_PLAN.md` §1.

## Status: superseded, reproducible

The renders described below were produced during the earlier fully-automated pass, while
the product was incomplete and the footage required for a functional demo did not exist.
**They were not accepted into a deliverable and should not be reused as-is.** The
templates, settings, and QA gate are recorded here because they remain the right starting
point for a re-render against current footage.

## Reproducing the opener

Source project: [`../rotato-project-inputs/Fast 3 Phones (Autosaved).rotato`](../rotato-project-inputs/) — checked in.

The pass injected a horizontal ListingOS master into all three device screens via
Rotato's bundled renderer. Output settings were H.264, 1920x1080, 30 fps, ~7.2 seconds.

The template library used was a local desktop collection, not part of this repo. The
opener came from `Esssential Mix v2.3/Phone - Fast 3 Phones/Fast 3 Phones.rotato`; the
variant board drew on `Mega-Multi 1.0` and
`Esssential Mix v2.3/Phone - Simple All-Screen Tour`. Only the packaged project above is
checked in — the wider library must be present locally to re-render other templates.

`DEMO_VIDEO_SCRIPT_V2.md` calls for this opener at 0:10–0:16, slowed 20%.

## Variants explored

A board of alternates was rendered at 1920x1080 with source media matched to each scene's
screen orientation. **None of these files are in the repo.** The list is retained so the
same set can be re-derived rather than rediscovered:

| Variant | Intended scene role | Source treatment |
| --- | --- | --- |
| 2-phone side-by-side, portrait | Two-device hero or comparison | Portrait Android camera footage on both screens |
| 3-phone side-by-side, portrait | Fast montage transition | Portrait Android capture on all three |
| 4-phone side-by-side, portrait | Feature montage / scale proof | Portrait Android capture on all four |
| Simple tour, portrait | Single-device product intro | Portrait Android footage fills the screen |

These passed technical review at the time but were rendered against the incomplete
product. Treat the list as a menu of template choices, not as approved assets.

## QA gate for any future Rotato render

Three renders were rejected during the pass because scenes retained unrelated template
content or Rotato's own upload placeholder. That failure mode defines the gate:

> No template placeholder, unrelated app UI, or unverified screen may survive into a
> ListingOS deliverable. Inspect every phone screen in every frame before accepting a render.

## Known limitation

Several files in the desktop library are `.rotatotemplate` rather than editable `.rotato`
projects. The Rotato CLI cannot render those directly — they must be opened and saved in
the Rotato app first. Any plan that names a `.rotatotemplate` requires that conversion
step before it can be automated.
