# ListingOS Remotion Composition

`listingos-demo-entry.tsx` is the motion-graphics layer for the demo. It is **Track B
(overlay)** under the two-track model — it annotates live evidence and carries abstract
beats, but it is no longer the master render. See `PRODUCTION_PLAN.md` §1.

## What it provides

- a branded opening title;
- animated chapter markers for capture, build, review, and publish;
- short motion lower-thirds that explain the product without covering evidence;
- a restrained progress rail.

The current script uses the lower-thirds (1:27, 1:44) and the text cards. It does **not**
use the composition as a full-frame master.

## Superseded: narration and music

Earlier versions of this composition carried a synthetic narration track generated with
macOS `say`, plus a music bed. **The current plan uses the founder's real voice.** Do not
reintroduce synthetic narration without adding a disclosure to the upload metadata — see
`PRODUCTION_PLAN.md` §7.

## Outstanding build

`PRODUCTION_PLAN.md` §3 requires a new architecture diagram for 2:10–2:24, roughly 14
seconds, built as an extension of this composition. Nodes, revealed left to right:

```
Expo app → OAuth → R2 → Queue → Responses API → eBay evidence → D1 → review → publish
```

This is the largest remaining Track B item.

## Rendering

Rendering uses a Remotion installation outside this repo. Set both paths before running:

```sh
export LISTINGOS="/Users/jonathangan/Documents/ListingOS-AI"
export CLIPCAPTION="/Users/jonathangan/Desktop/ClipCaptionAI"

cd "$CLIPCAPTION"
./node_modules/.bin/remotion render \
  "$LISTINGOS/ListingOS-Hackathon-Demo-Assets/remotion/listingos-demo-entry.tsx" \
  ListingOSDemo \
  "$LISTINGOS/ListingOS-Hackathon-Demo-Assets/final-renders/<output>.mp4"
```

Media referenced by the composition must be copied into the Remotion project's `public/`
directory before rendering. None of it is required by the mobile app at runtime.

Output lands in `../final-renders/`, which is gitignored.
