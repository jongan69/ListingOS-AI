import {
  CameraView,
  useCameraPermissions,
  type CameraFocusResult,
  type CameraType,
  type FlashMode,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useData } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  type GestureResponderEvent,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { brand } from "@/config/brand";
import { appConfig } from "@/config/app";
import { analyzeEncodedImage } from "@/lib/vision/yolox";
import type { VisionFrameContext } from "@/shared/contracts";
import { usePalette } from "@/theme/theme";

type Props = {
  connected: boolean;
  queueCount: number;
  productNumber: number;
  onProductComplete: (assets: ImagePicker.ImagePickerAsset[], visionContext: VisionFrameContext | null) => void;
  onUseExistingPhotos: () => void;
  onOpenQueue: () => void;
};

type FocusPoint = {
  x: number;
  y: number;
};

type FocusVisualState = "idle" | "focusing" | "confirmed" | "failed" | "unsupported";
type PointFocusCapability = "unknown" | "available" | "unsupported";

const MAX_PRODUCT_ZOOM = 0.25;

export function CameraFirstSurface({
  connected,
  queueCount,
  productNumber,
  onProductComplete,
  onUseExistingPhotos,
  onOpenQueue,
}: Props) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const styles = createStyles(palette);
  const cameraRef = useRef<CameraView>(null);
  const previewSizeRef = useRef({ width: 0, height: 0 });
  const focusRequestRef = useRef(0);
  const focusAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [focusOpacity] = useState(() => new Animated.Value(0));
  const [focusScale] = useState(() => new Animated.Value(1.2));
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const [focusState, setFocusState] = useState<FocusVisualState>("idle");
  const [focusMessage, setFocusMessage] = useState<string | null>(null);
  const [pointFocusCapability, setPointFocusCapability] = useState<PointFocusCapability>("unknown");
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraInstanceKey, setCameraInstanceKey] = useState(0);
  const [pictureSize, setPictureSize] = useState<string>();
  const [visionUri, setVisionUri] = useState<string | null>(null);
  const [visionResult, setVisionResult] = useState<VisionFrameContext | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const compactLayout = windowHeight < 720;

  function resetFocusState() {
    focusRequestRef.current += 1;
    focusAnimationRef.current?.stop();
    focusAnimationRef.current = null;
    focusOpacity.setValue(0);
    focusScale.setValue(1.2);
    setFocusPoint(null);
    setFocusState("idle");
    setFocusMessage(null);
    setPointFocusCapability("unknown");
  }

  useEffect(() => () => {
    focusRequestRef.current += 1;
    focusAnimationRef.current?.stop();
  }, [focusOpacity, focusScale]);

  async function capturePhoto() {
    if (!cameraRef.current || !cameraReady || capturing) return;
    if (assets.length >= appConfig.maxPhotosPerSelection) {
      setCameraError(`This product already has the ${appConfig.maxPhotosPerSelection}-photo maximum. Finish it to keep listing.`);
      return;
    }
    setCapturing(true);
    setCameraError(null);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });
      if (!picture?.uri) throw new Error("The camera did not return a photo.");
      const nextAsset: ImagePicker.ImagePickerAsset = {
        uri: picture.uri,
        width: picture.width,
        height: picture.height,
        fileName: `listingos-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
      };
      setAssets((current) => [...current, nextAsset]);
      // Keep the live view stable after capture. Photo editing opens only when
      // the seller explicitly taps a thumbnail.
      setSelectedPhotoIndex(null);
      setReviewExpanded(false);
      // Analyze only the photo the seller explicitly captured. Calling
      // takePictureAsync on a timer triggers Android shutter events and can
      // activate the flash, so preview inference must never own the camera.
      setVisionResult(null);
      setVisionUri(picture.uri);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Could not capture that photo.");
    } finally {
      setCapturing(false);
    }
  }

  function finishProduct() {
    if (assets.length === 0) return;
    onProductComplete(assets, visionResult);
    setAssets([]);
    setSelectedPhotoIndex(null);
    setReviewExpanded(false);
    setCameraError(null);
    setVisionUri(null);
    setVisionResult(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function cycleFlash() {
    setFlash((current) => current === "off" ? "on" : current === "on" ? "auto" : "off");
  }

  function adjustZoom(delta: number) {
    setZoom((current) => Math.max(0, Math.min(MAX_PRODUCT_ZOOM, Number((current + delta).toFixed(2)))));
    void Haptics.selectionAsync();
  }

  function toggleFacing() {
    resetFocusState();
    setCameraReady(false);
    setPictureSize(undefined);
    setFacing((current) => current === "back" ? "front" : "back");
    setFlash("off");
    setTorchEnabled(false);
    setZoom(0);
  }

  function restartCamera() {
    resetFocusState();
    setCameraReady(false);
    setCameraError(null);
    setPictureSize(undefined);
    setTorchEnabled(false);
    setCameraInstanceKey((current) => current + 1);
  }

  function focusCamera(event: GestureResponderEvent) {
    if (Platform.OS === "web" || !cameraReady || capturing || !cameraRef.current) return;
    const { locationX: x, locationY: y } = event.nativeEvent;
    const { width, height } = previewSizeRef.current;
    if (width <= 0 || height <= 0) return;

    const requestId = focusRequestRef.current + 1;
    focusRequestRef.current = requestId;
    setCameraError(null);
    setFocusPoint({ x, y });
    setFocusState("focusing");
    setFocusMessage("Focusing on that point...");
    focusAnimationRef.current?.stop();
    focusOpacity.setValue(1);
    focusScale.setValue(1.25);
    focusAnimationRef.current = Animated.spring(focusScale, {
      damping: 15,
      mass: 0.5,
      stiffness: 220,
      toValue: 1,
      useNativeDriver: true,
    });
    focusAnimationRef.current.start();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

    const settleFocusVisual = (
      state: Exclude<FocusVisualState, "idle">,
      message: string,
      visibleFor: number,
    ) => {
      if (requestId !== focusRequestRef.current) return;
      setFocusState(state);
      setFocusMessage(message);
      focusAnimationRef.current?.stop();
      focusOpacity.setValue(1);
      focusScale.setValue(1);
      focusAnimationRef.current = Animated.sequence([
        Animated.delay(visibleFor),
        Animated.timing(focusOpacity, {
          duration: 220,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]);
      focusAnimationRef.current.start(({ finished }) => {
        if (!finished || requestId !== focusRequestRef.current) return;
        setFocusPoint(null);
        setFocusState("idle");
        setFocusMessage(null);
      });
    };

    const handleResult = (result: CameraFocusResult) => {
      if (requestId !== focusRequestRef.current) return;
      if (result.status === "focused") {
        setPointFocusCapability("available");
        settleFocusVisual("confirmed", "Focus confirmed.", 650);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        return;
      }
      if (result.status === "started") {
        setPointFocusCapability("available");
        settleFocusVisual("focusing", "Focus adjusting.", 850);
        return;
      }
      if (result.status === "unsupported") {
        const cameraNotReady = result.reason === "camera_unavailable" || result.reason === "preview_not_ready";
        if (!cameraNotReady) setPointFocusCapability("unsupported");
        settleFocusVisual(
          "unsupported",
          cameraNotReady ? "Camera is still starting. Try again." : "Continuous autofocus is active on this camera.",
          950,
        );
        return;
      }
      if (isQuietFocusFailure(result)) {
        focusAnimationRef.current?.stop();
        focusOpacity.setValue(0);
        setFocusPoint(null);
        setFocusState("idle");
        setFocusMessage(null);
        return;
      }
      setPointFocusCapability("available");
      settleFocusVisual("failed", "Move a little farther back and tap again.", 1_050);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    };

    void cameraRef.current.focusAtPoint(x / width, y / height)
      .then(handleResult)
      .catch(() => {
        if (requestId !== focusRequestRef.current) return;
        settleFocusVisual("failed", "Could not focus there. Move back and try again.", 1_050);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      });
  }

  async function handleCameraReady() {
    resetFocusState();
    setCameraError(null);
    setCameraReady(true);
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync();
      const largestSize = selectLargestPictureSize(sizes ?? []);
      if (largestSize) setPictureSize(largestSize);
    } catch {
      // The camera still captures at its native default if size discovery fails.
    }
  }

  function removeSelectedPhoto() {
    if (selectedPhotoIndex === null || !assets[selectedPhotoIndex]) return;
    const removedUri = assets[selectedPhotoIndex].uri;
    setAssets((current) => current.filter((_, index) => index !== selectedPhotoIndex));
    setSelectedPhotoIndex((current) => {
      if (current === null || assets.length <= 1) return null;
      return Math.min(current, assets.length - 2);
    });
    if (visionUri === removedUri) {
      setVisionUri(null);
      setVisionResult(null);
    }
    if (assets.length <= 1) setReviewExpanded(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  function moveSelectedPhoto(direction: -1 | 1) {
    if (selectedPhotoIndex === null) return;
    const nextIndex = selectedPhotoIndex + direction;
    if (nextIndex < 0 || nextIndex >= assets.length) return;
    setAssets((current) => {
      const next = [...current];
      [next[selectedPhotoIndex], next[nextIndex]] = [next[nextIndex], next[selectedPhotoIndex]];
      return next;
    });
    setSelectedPhotoIndex(nextIndex);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const captureHint = !cameraReady
    ? "Starting the camera..."
    : focusMessage
      ? focusMessage
      : visionResult?.primaryObject
        ? `Sees ${visionResult.primaryObject.label}. Add another useful angle.`
        : assets.length > 0
          ? "Captured. Add the reverse, label, and any visible wear."
          : connected
            ? compactLayout
              ? "Tap to focus, then capture."
              : "Tap the product to focus, then capture each useful angle."
            : "Capture now. Connect eBay before publishing.";

  const focusLabel = visionResult?.primaryObject
    ? "AI SEEING"
    : focusState === "focusing"
      ? "FOCUSING"
      : focusState === "confirmed"
        ? "FOCUS CONFIRMED"
        : focusState === "failed"
          ? "MOVE BACK & RETRY"
          : pointFocusCapability === "unsupported" || focusState === "unsupported"
            ? "CONTINUOUS FOCUS"
            : "TAP TO FOCUS";

  if (!permission) {
    return <View style={styles.permissionShell}><ActivityIndicator color={palette.teal} /></View>;
  }

  if (!permission.granted) {
    const canRequestPermission = permission.canAskAgain;
    return (
      <View style={[styles.permissionShell, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.permissionMark}>
          <Text style={styles.permissionMarkText}>CAM</Text>
        </View>
        <Text style={styles.permissionTitle}>Your listing camera</Text>
        <Text style={styles.permissionBody}>
          ListingOS uses the camera to capture every product view, keep the photos together, and build the eBay draft for you.
        </Text>
        <Pressable
          accessibilityLabel={canRequestPermission ? "Allow camera access" : "Open device settings for camera access"}
          accessibilityRole="button"
          onPress={() => void (canRequestPermission ? requestPermission() : Linking.openSettings())}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>{canRequestPermission ? "Allow camera access" : "Open device settings"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onUseExistingPhotos} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Use existing photos</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.previewShell}>
        <CameraView
          autofocus="off"
          enableTorch={torchEnabled}
          facing={facing}
          flash={flash}
          key={cameraInstanceKey}
          mirror={facing === "front"}
          mute
          onCameraReady={() => void handleCameraReady()}
          onMountError={(event) => {
            resetFocusState();
            setCameraReady(false);
            setCameraError(event.message);
          }}
          pictureSize={pictureSize}
          ref={cameraRef}
          responsiveOrientationWhenOrientationLocked
          style={StyleSheet.absoluteFill}
          zoom={zoom}
        />
        <View pointerEvents="none" style={styles.vignette} />
        {Platform.OS !== "web" ? (
          <Pressable
            accessibilityHint={pointFocusCapability === "unsupported"
              ? "This camera uses continuous autofocus and cannot focus at a selected point"
              : "Requests focus and exposure at the tapped point; confirmation depends on camera support"}
            accessibilityLabel="Camera preview. Tap the product to focus"
            accessibilityRole="button"
            accessibilityState={{ disabled: capturing || !cameraReady }}
            disabled={capturing || !cameraReady}
            onLayout={(event) => {
              previewSizeRef.current = event.nativeEvent.layout;
            }}
            onPress={focusCamera}
            style={[StyleSheet.absoluteFill, styles.focusOverlay]}
          />
        ) : null}

        {gridEnabled ? (
          <View pointerEvents="none" style={styles.gridOverlay}>
            <View style={[styles.gridLineVertical, { left: "33.333%" }]} />
            <View style={[styles.gridLineVertical, { left: "66.666%" }]} />
            <View style={[styles.gridLineHorizontal, { top: "33.333%" }]} />
            <View style={[styles.gridLineHorizontal, { top: "66.666%" }]} />
          </View>
        ) : null}

        {visionResult?.primaryObject ? (
          <View
            pointerEvents="none"
            style={[
              styles.detectionBox,
              {
                left: `${visionResult.primaryObject.bounds.x * 100}%`,
                top: `${visionResult.primaryObject.bounds.y * 100}%`,
                width: `${visionResult.primaryObject.bounds.width * 100}%`,
                height: `${visionResult.primaryObject.bounds.height * 100}%`,
              },
            ]}
          >
            <Text style={styles.detectionLabel}>{visionResult.primaryObject.label} {Math.round(visionResult.primaryObject.confidence * 100)}%</Text>
          </View>
        ) : null}

        {focusPoint ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.focusRing,
              focusState === "confirmed" ? styles.focusRingConfirmed : null,
              focusState === "failed" ? styles.focusRingFailed : null,
              focusState === "unsupported" ? styles.focusRingUnsupported : null,
              {
                left: focusPoint.x - 28,
                opacity: focusOpacity,
                top: focusPoint.y - 28,
                transform: [{ scale: focusScale }],
              },
            ]}
          >
            <View
              style={[
                styles.focusRingDot,
                focusState === "confirmed" ? styles.focusRingDotConfirmed : null,
                focusState === "failed" ? styles.focusRingDotFailed : null,
                focusState === "unsupported" ? styles.focusRingDotUnsupported : null,
              ]}
            />
          </Animated.View>
        ) : null}

        {visionUri ? <VisionSnapshotProbe onResult={setVisionResult} uri={visionUri} /> : null}
        <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <View style={styles.brandLockup}>
            <Image contentFit="contain" source={brand.mark} style={styles.brandMark} />
            <View>
              <Text style={styles.wordmark}>ListingOS</Text>
              <Text style={styles.eyebrow}>CAMERA LISTING MACHINE</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={onOpenQueue} style={styles.queueButton}>
            <Text style={styles.queueGlyph}>Q</Text>
            {queueCount > 0 ? <View style={styles.queueBadge}><Text style={styles.queueBadgeText}>{Math.min(queueCount, 99)}</Text></View> : null}
          </Pressable>
        </View>

        <View pointerEvents="none" style={styles.centerGuide}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{focusLabel}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.statusRow}>
          <View style={styles.statusCopy}>
            <Text style={styles.productLabel}>PRODUCT {productNumber}</Text>
            <Text numberOfLines={1} style={styles.statusTitle}>{assets.length === 0 ? "Frame the item" : `${assets.length} photo${assets.length === 1 ? "" : "s"} for this product`}</Text>
            <Text numberOfLines={1} style={styles.statusHint}>{captureHint}</Text>
          </View>
          {assets.length > 0 ? (
            <View style={styles.statusActions}>
              {!reviewExpanded && !compactLayout ? <Image contentFit="cover" source={{ uri: assets[assets.length - 1].uri }} style={styles.latestPreview} /> : null}
              <Pressable
                accessibilityLabel={reviewExpanded ? "Hide captured photos" : "Review captured photos"}
                accessibilityRole="button"
                onPress={() => {
                  setReviewExpanded((current) => !current);
                  setSelectedPhotoIndex(null);
                }}
                style={styles.reviewButton}
              >
                <Text style={styles.reviewButtonText}>{reviewExpanded ? "Hide" : "Review"}</Text>
              </Pressable>
              {!reviewExpanded ? (
                <Pressable accessibilityLabel="Done with this product" accessibilityRole="button" onPress={finishProduct} style={styles.compactDoneButton}>
                  <Text style={styles.compactDoneText}>Done</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {reviewExpanded && assets.length > 0 ? (
          <View style={styles.photoRailSlot}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip} contentContainerStyle={styles.photoStripContent}>
              {assets.map((asset, index) => {
                const selected = index === selectedPhotoIndex;
                return (
                  <Pressable
                    accessibilityLabel={`Select photo ${index + 1}`}
                    accessibilityRole="button"
                    key={`${asset.uri}-${index}`}
                    onPress={() => setSelectedPhotoIndex((current) => current === index ? null : index)}
                    style={[styles.photoThumbWrap, selected ? styles.photoThumbWrapSelected : null]}
                  >
                    <Image contentFit="cover" source={{ uri: asset.uri }} style={styles.photoThumb} />
                    {index === assets.length - 1 ? <View style={styles.latestDot} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {reviewExpanded && selectedPhotoIndex !== null ? (
          <View style={styles.photoToolbar}>
            <Text style={styles.photoToolbarLabel}>Photo {selectedPhotoIndex + 1} of {assets.length}</Text>
            <View style={styles.photoActions}>
              <Pressable
                accessibilityLabel="Move selected photo left"
                accessibilityRole="button"
                accessibilityState={{ disabled: selectedPhotoIndex === 0 }}
                disabled={selectedPhotoIndex === 0}
                onPress={() => moveSelectedPhoto(-1)}
                style={[styles.photoAction, selectedPhotoIndex === 0 ? styles.photoActionDisabled : null]}
              >
                <Text style={styles.photoActionGlyph}>{"<"}</Text>
              </Pressable>
              <Pressable accessibilityLabel="Remove selected photo" accessibilityRole="button" onPress={removeSelectedPhoto} style={[styles.photoAction, styles.removePhotoAction]}>
                <Text style={styles.removePhotoText}>Remove</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Move selected photo right"
                accessibilityRole="button"
                accessibilityState={{ disabled: selectedPhotoIndex === assets.length - 1 }}
                disabled={selectedPhotoIndex === assets.length - 1}
                onPress={() => moveSelectedPhoto(1)}
                style={[styles.photoAction, selectedPhotoIndex === assets.length - 1 ? styles.photoActionDisabled : null]}
              >
                <Text style={styles.photoActionGlyph}>{">"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {cameraError ? (
          <View accessibilityLiveRegion="assertive" style={styles.cameraErrorPanel}>
            <Text selectable style={styles.errorText}>{cameraError}</Text>
            <View style={styles.cameraErrorActions}>
              <Pressable accessibilityLabel="Restart camera" accessibilityRole="button" onPress={restartCamera} style={styles.cameraErrorButton}>
                <Text style={styles.cameraErrorButtonText}>Restart camera</Text>
              </Pressable>
              <Pressable accessibilityLabel="Use existing photos" accessibilityRole="button" onPress={onUseExistingPhotos} style={styles.cameraErrorButton}>
                <Text style={styles.cameraErrorButtonText}>Use photos</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.captureSettings}>
          <Pressable
            accessibilityLabel={`${gridEnabled ? "Hide" : "Show"} composition grid`}
            accessibilityRole="button"
            onPress={() => setGridEnabled((current) => !current)}
            style={[styles.settingButton, gridEnabled ? styles.settingButtonActive : null]}
          >
            <Text style={[styles.settingText, gridEnabled ? styles.settingTextActive : null]}>GRID</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`${torchEnabled ? "Turn off" : "Turn on"} continuous light`}
            accessibilityRole="button"
            accessibilityState={{ disabled: facing === "front" }}
            disabled={facing === "front"}
            onPress={() => setTorchEnabled((current) => !current)}
            style={[styles.settingButton, torchEnabled ? styles.settingButtonActive : null, facing === "front" ? styles.settingButtonDisabled : null]}
          >
            <Text style={[styles.settingText, torchEnabled ? styles.settingTextActive : null]}>LIGHT</Text>
          </Pressable>
          <View accessibilityLabel={`Zoom ${Math.round(zoom * 100)} percent`} style={styles.zoomControl}>
            <Pressable accessibilityLabel="Zoom out" accessibilityRole="button" disabled={zoom === 0} onPress={() => adjustZoom(-0.05)} style={styles.zoomButton}>
              <Text style={styles.zoomButtonText}>−</Text>
            </Pressable>
            <Text style={styles.zoomText}>ZOOM {Math.round(zoom * 100)}%</Text>
            <Pressable accessibilityLabel="Zoom in" accessibilityRole="button" disabled={zoom >= MAX_PRODUCT_ZOOM} onPress={() => adjustZoom(0.05)} style={styles.zoomButton}>
              <Text style={styles.zoomButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.controlsSide}>
              <Pressable accessibilityLabel="Use existing photos" accessibilityRole="button" onPress={onUseExistingPhotos} style={styles.toolButton}>
              <Text style={styles.toolGlyph}>+</Text>
              <Text style={styles.toolLabel}>Photos</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityLabel={assets.length >= appConfig.maxPhotosPerSelection
              ? "Maximum photos captured"
              : cameraReady ? "Take photo" : "Camera is starting"}
            accessibilityRole="button"
            accessibilityState={{ disabled: capturing || !cameraReady || assets.length >= appConfig.maxPhotosPerSelection }}
            disabled={capturing || !cameraReady || assets.length >= appConfig.maxPhotosPerSelection}
            onPress={() => void capturePhoto()}
            style={[styles.shutterOuter, !cameraReady || assets.length >= appConfig.maxPhotosPerSelection ? styles.shutterDisabled : null]}
          >
            <View style={styles.shutterInner}>{capturing ? <ActivityIndicator color="#07111B" /> : null}</View>
          </Pressable>
          <View style={[styles.controlsSide, styles.toolCluster]}>
            <Pressable accessibilityLabel="Toggle flash" accessibilityRole="button" onPress={cycleFlash} style={styles.toolButton}>
              <Text style={styles.toolGlyph}>{flash === "off" ? "OFF" : flash === "auto" ? "AUTO" : "ON"}</Text>
              <Text style={styles.toolLabel}>Flash</Text>
            </Pressable>
            <Pressable accessibilityLabel="Switch camera" accessibilityRole="button" onPress={toggleFacing} style={styles.toolButton}>
              <Text style={styles.toolGlyph}>FLIP</Text>
              <Text style={styles.toolLabel}>Flip</Text>
            </Pressable>
          </View>
        </View>

        {reviewExpanded ? (
          <Pressable accessibilityLabel="Done with this product" accessibilityRole="button" onPress={finishProduct} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>{`Done with product • ${assets.length} photo${assets.length === 1 ? "" : "s"}`}</Text>
            <Text style={styles.doneButtonArrow}>{">"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (palette: ReturnType<typeof usePalette>) => StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#050A0E" },
  previewShell: { flex: 1, minHeight: 220, overflow: "hidden", backgroundColor: "#050A0E" },
  vignette: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.08)" },
  gridOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  gridLineVertical: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.42)" },
  gridLineHorizontal: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.42)" },
  focusOverlay: { zIndex: 1 },
  focusRing: { position: "absolute", zIndex: 2, width: 56, height: 56, borderRadius: 12, borderWidth: 2, borderColor: palette.teal, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(5,10,14,0.08)" },
  focusRingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.teal },
  focusRingConfirmed: { borderColor: "#79E49A", backgroundColor: "rgba(20,76,44,0.12)" },
  focusRingFailed: { borderColor: "#FF9E9E", backgroundColor: "rgba(98,24,32,0.14)" },
  focusRingUnsupported: { borderColor: "rgba(255,255,255,0.72)", borderStyle: "dashed", backgroundColor: "rgba(5,10,14,0.18)" },
  focusRingDotConfirmed: { backgroundColor: "#79E49A" },
  focusRingDotFailed: { backgroundColor: "#FF9E9E" },
  focusRingDotUnsupported: { backgroundColor: "rgba(255,255,255,0.72)" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 3, paddingHorizontal: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 30, height: 30 },
  wordmark: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", letterSpacing: -0.4 },
  eyebrow: { color: "rgba(255,255,255,0.65)", fontSize: 8, fontWeight: "800", letterSpacing: 1.3, marginTop: 2 },
  queueButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(5,10,14,0.58)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  queueGlyph: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
  queueBadge: { position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: palette.teal },
  queueBadgeText: { color: "#07111B", fontSize: 10, fontWeight: "900" },
  centerGuide: { position: "absolute", left: "15%", right: "15%", top: "28%", bottom: "18%" },
  detectionBox: { position: "absolute", borderWidth: 2, borderColor: palette.teal, borderRadius: 10 },
  detectionLabel: { position: "absolute", top: -24, left: -2, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, overflow: "hidden", color: "#07111B", backgroundColor: palette.teal, fontSize: 10, fontWeight: "900" },
  cornerTopLeft: { position: "absolute", top: 0, left: 0, width: 28, height: 28, borderTopWidth: 2, borderLeftWidth: 2, borderColor: "rgba(255,255,255,0.8)", borderTopLeftRadius: 8 },
  cornerTopRight: { position: "absolute", top: 0, right: 0, width: 28, height: 28, borderTopWidth: 2, borderRightWidth: 2, borderColor: "rgba(255,255,255,0.8)", borderTopRightRadius: 8 },
  cornerBottomLeft: { position: "absolute", bottom: 0, left: 0, width: 28, height: 28, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: "rgba(255,255,255,0.8)", borderBottomLeftRadius: 8 },
  cornerBottomRight: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "rgba(255,255,255,0.8)", borderBottomRightRadius: 8 },
  livePill: { position: "absolute", top: -30, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(5,10,14,0.62)" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.teal },
  liveText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  bottomPanel: { flexShrink: 0, paddingHorizontal: 18, paddingTop: 10, backgroundColor: "#081015", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.13)" },
  statusRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  statusCopy: { flex: 1, minWidth: 0 },
  productLabel: { color: palette.teal, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  statusTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", marginTop: 2 },
  statusHint: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", marginTop: 2 },
  statusActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  latestPreview: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)" },
  reviewButton: { height: 34, paddingHorizontal: 11, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  reviewButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  compactDoneButton: { height: 34, paddingHorizontal: 12, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: palette.teal },
  compactDoneText: { color: "#07111B", fontSize: 11, fontWeight: "900" },
  photoRailSlot: { height: 54, justifyContent: "center", marginBottom: 8 },
  photoStrip: { maxHeight: 54 },
  photoStripContent: { flexDirection: "row", alignItems: "center", gap: 7 },
  photoThumbWrap: { position: "relative", padding: 2, borderRadius: 12, borderWidth: 1, borderColor: "transparent" },
  photoThumbWrapSelected: { borderColor: palette.teal, backgroundColor: "rgba(99,222,207,0.14)" },
  photoThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)" },
  latestDot: { position: "absolute", right: 3, bottom: 3, width: 6, height: 6, borderRadius: 3, backgroundColor: palette.teal },
  photoToolbar: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  photoToolbarLabel: { color: "rgba(255,255,255,0.62)", fontSize: 11, fontWeight: "800" },
  photoActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  photoAction: { minWidth: 34, height: 32, paddingHorizontal: 8, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  photoActionGlyph: { color: "#FFFFFF", fontSize: 18, lineHeight: 20, fontWeight: "900" },
  removePhotoAction: { flexDirection: "row", gap: 5, backgroundColor: "rgba(255,82,82,0.13)" },
  removePhotoText: { color: "#FFB4B4", fontSize: 11, fontWeight: "900" },
  photoActionDisabled: { opacity: 0.3 },
  captureSettings: { height: 36, flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 2 },
  settingButton: { height: 30, minWidth: 52, paddingHorizontal: 9, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  settingButtonActive: { backgroundColor: "rgba(99,222,207,0.16)", borderColor: palette.teal },
  settingButtonDisabled: { opacity: 0.34 },
  settingText: { color: "rgba(255,255,255,0.68)", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  settingTextActive: { color: palette.teal },
  zoomControl: { flex: 1, height: 30, minWidth: 126, paddingHorizontal: 3, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  zoomButton: { width: 30, height: 28, alignItems: "center", justifyContent: "center" },
  zoomButtonText: { color: "#FFFFFF", fontSize: 18, lineHeight: 20, fontWeight: "700" },
  zoomText: { color: "rgba(255,255,255,0.76)", fontSize: 9, fontWeight: "900", letterSpacing: 0.5, fontVariant: ["tabular-nums"] },
  controlsRow: { height: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between", position: "relative" },
  controlsSide: { flex: 1, minWidth: 88, flexDirection: "row", alignItems: "center" },
  toolCluster: { justifyContent: "flex-end", gap: 8 },
  toolButton: { minWidth: 48, alignItems: "center", justifyContent: "center", gap: 4 },
  toolGlyph: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  toolLabel: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "800" },
  shutterOuter: { position: "absolute", left: "50%", width: 68, height: 68, marginLeft: -34, borderRadius: 34, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#FFFFFF" },
  shutterDisabled: { opacity: 0.45 },
  shutterInner: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: palette.teal },
  doneButton: { height: 48, borderRadius: 16, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: palette.teal },
  doneButtonText: { color: "#07111B", fontSize: 14, fontWeight: "900" },
  doneButtonArrow: { color: "#07111B", fontSize: 22, lineHeight: 22, fontWeight: "900" },
  cameraErrorPanel: { gap: 7, marginBottom: 8 },
  cameraErrorActions: { flexDirection: "row", gap: 8 },
  cameraErrorButton: { minHeight: 32, paddingHorizontal: 11, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,177,177,0.12)", borderWidth: 1, borderColor: "rgba(255,177,177,0.24)" },
  cameraErrorButtonText: { color: "#FFD5D5", fontSize: 11, fontWeight: "900" },
  errorText: { color: "#FFB1B1", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  permissionShell: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, backgroundColor: palette.background },
  permissionMark: { width: 76, height: 76, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: palette.cardStrong, marginBottom: 20 },
  permissionMarkText: { color: palette.teal, fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  permissionTitle: { color: palette.text, fontSize: 26, fontWeight: "900", textAlign: "center" },
  permissionBody: { color: palette.textMuted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10, marginBottom: 26 },
  primaryButton: { width: "100%", minHeight: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: palette.teal },
  primaryButtonText: { color: "#07111B", fontSize: 15, fontWeight: "900" },
  secondaryButton: { paddingVertical: 16 },
  secondaryButtonText: { color: palette.cyan, fontSize: 14, fontWeight: "800" },
});

function selectLargestPictureSize(sizes: string[]) {
  let largestSize: string | undefined;
  let largestArea = 0;
  for (const size of sizes) {
    const match = /^(\d+)x(\d+)$/i.exec(size);
    if (!match) continue;
    const area = Number(match[1]) * Number(match[2]);
    if (area > largestArea) {
      largestArea = area;
      largestSize = size;
    }
  }
  return largestSize;
}

function isQuietFocusFailure(result: CameraFocusResult) {
  return result.status === "failed" && (
    result.reason === "superseded"
    || result.reason === "camera_changed"
    || result.reason === "canceled"
  );
}

function VisionSnapshotProbe({ uri, onResult }: { uri: string; onResult: (result: VisionFrameContext) => void }) {
  const data = useData(uri);
  useEffect(() => {
    if (!data) return;
    let canceled = false;
    void analyzeEncodedImage(data)
      .then((result) => {
        if (!canceled) onResult(result);
      })
      .catch(() => {
        // Model loading/decoding is deliberately non-blocking.
      });
    return () => {
      canceled = true;
    };
  }, [data, onResult]);
  return null;
}
