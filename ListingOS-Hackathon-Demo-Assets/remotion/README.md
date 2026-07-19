# ListingOS Remotion Demo Composition

`listingos-demo-entry.tsx` is the reusable horizontal finishing layer for the ListingOS hackathon demo. It keeps the verified real Android/eBay footage as the source of truth and adds:

- a branded opening title;
- animated chapter markers for capture, build, review, and publish;
- short motion lower-thirds that explain the product without covering the evidence;
- a restrained progress rail;
- an explicitly synthetic narration track and licensed/owned music bed.

The composition is rendered with the Remotion installation in `/Users/jonathangan/Desktop/ClipCaptionAI`. The demo media is copied into that project's `public/` directory for rendering and is not required by the mobile app at runtime.

## Render

```sh
cd /Users/jonathangan/Desktop/ClipCaptionAI
./node_modules/.bin/remotion render \
  /Users/jonathangan/Documents/ListingOS-AI/ListingOS-Hackathon-Demo-Assets/remotion/listingos-demo-entry.tsx \
  ListingOSDemo \
  /Users/jonathangan/Documents/ListingOS-AI/ListingOS-Hackathon-Demo-Assets/final-renders/listingos-horizontal-demo-remotion-v1.mp4
```

The render command expects these files in ClipCaptionAI's `public/` folder:

- `listingos-horizontal-demo-rotato-enhanced-20260718.mp4`;
- `listingos-demo-narration-synthetic.wav`;
- `listingos-demo-music-bed.mp3`.

The narration is generated locally with macOS `say` and is not Jonathan Gan's voice. The final notes must identify it as synthetic narration.
