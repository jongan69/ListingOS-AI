# ListingOS Sony Camera Module

Android and iOS internal integration for the Sony A7 III (`ILCE-7M3`). It implements
Sony Camera Control PTP 2 over Android USB host APIs and Apple's ImageCaptureCore
PTP pass-through. It does not bundle Sony SDK binaries, documentation, or sample source.

## Build gate

Set `EXPO_PUBLIC_SONY_REMOTE_ENABLED=true` only for development or preview builds.
Production remains disabled until the physical acceptance checklist below passes.

## Camera setup

1. Turn **Ctrl w/ Smartphone** off.
2. Set **USB Connection** to **PC Remote**.
3. Configure PC Remote still-image save so a JPEG is transferred to the host.
4. Connect the A7 III directly to an Android USB-host phone with a data-capable cable.
5. Choose ListingOS in Android's USB attachment dialog and allow access.

On iOS, open ListingOS before or after connecting the camera and allow camera-control
access when prompted. iOS detects the USB camera while the app is running, but unlike
Android it does not provide an app-owned USB attachment intent that guarantees ListingOS
will launch automatically from a terminated state.

## Physical acceptance

- Record the A7 III USB product ID and narrow the manifest filter if required.
- Confirm both Lightning and USB-C iPhone connection paths that are intended for support.
- Live view appears within five seconds and stays at 10 fps or better for five minutes.
- One ListingOS shutter tap produces one exposure and one JPEG in the photo tray.
- Ten photos can be captured, reordered, completed, and submitted as one
  `sony_remote` batch without publishing a live eBay listing.
- Permission denial, wrong USB mode, background/foreground, power-off, and cable
  removal recover without a crash; removal returns to the phone camera.

Protocol behavior was implemented from the local Sony Camera Remote Command 2.02
reference. Review Sony's current terms before enabling public distribution.

## USB diagnostics

Local physical release builds enable the Sony integration automatically. Build and
install one with `npm run device:android:release`, then move the phone's USB cable from
the Mac to the camera. The camera screen includes a collapsed **USB DEBUG** panel with
a **COPY** action. Its last 80 Android USB/PTP events are persisted across app restarts,
so a failed camera session can be copied after reconnecting the phone to the Mac.

The same events are available over ADB under the `ListingOSSonyCamera` logcat tag:

```bash
adb logcat -s ListingOSSonyCamera:I '*:S'
```
