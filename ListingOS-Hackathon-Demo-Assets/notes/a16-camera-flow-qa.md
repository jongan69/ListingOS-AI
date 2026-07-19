# Android Camera Flow QA

Date: 2026-07-18
Device: Samsung SM-A166U1 (serial `R5CY51SFSDL`)
Build: standalone Android release APK from commit `b65500e`
Recording: `raw-screen-recordings/listingos-camera-flow-a16.mp4`

## Verified

- App launches from the native Android launcher without a fatal exception.
- Camera preview opens with flash off and audio muted.
- Three explicit shutter taps create three photos; no timer-driven captures occur.
- Photo thumbnails are horizontally scrollable and selectable.
- Selected photos can be moved left or right without leaving capture.
- The selected photo can be removed immediately.
- The first photo in the ordered tray is the lead photo.
- `Done with product` exits capture and returns to the asynchronous listing workflow.

The clip is a raw device artifact without narration. It is evidence for the mobile capture UX, not the required public Devpost demo video.
