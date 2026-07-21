# Final Render Handoff

The `.mp4` files in this directory are intentionally gitignored. This metadata is tracked so the submission artifact can be identified and verified without committing a large binary.

## Intended YouTube Replacement

`listingos-openai-build-week-final-2m30s.mp4`

| Check | Result |
| --- | --- |
| Purpose | Replace the current 3:00 YouTube upload before judging |
| Edit | Removes the accidental unfinished/raw duplicate that begins at 2:30; the polished `Thank you` frame remains the ending |
| Duration | 150.002 seconds |
| Video | H.264, 1920×1080, 30 fps, yuv420p |
| Audio | AAC stereo, 48 kHz, 192 kbps target |
| Size | 22,110,845 bytes |
| SHA-256 | `7d0db82152e80a13660876fe35048238205fbded62590db7182df88660d39d0e` |
| Decode check | Passed with `ffmpeg -v error -i <file> -f null -` |

The file was derived from the public YouTube upload `I67o7B2JfYQ`; it does not add or rearrange claims. It only removes the trailing duplicate take.

## External Handoff

1. Upload the replacement as a **public** YouTube video.
2. Confirm the processed YouTube duration is below three minutes and playback works in a signed-out/private window.
3. Replace the video URL on Devpost; do not delete the old upload until the new embed works.
4. Use a description that qualifies the timing shown as one recorded run, not a universal SLA.
5. Confirm the music bed and every third-party visual are owned, licensed, or otherwise authorized for this submission.

Suggested description disclosure:

```text
ListingOS is an independent seller tool and is not affiliated with or endorsed by eBay. Any timing shown is from a recorded run and is not a guaranteed SLA. Proof Mode uses illustrative fixtures and never calls eBay; stored publish evidence comes from a separate verified Android run.
```
