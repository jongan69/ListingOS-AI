import {
  Blur,
  Canvas,
  Circle,
  ColorMatrix,
  Group,
  Image as SkiaImage,
  Paint,
  useImage,
} from "@shopify/react-native-skia";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Appearance,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View as RNView,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { captureScreen } from "react-native-view-shot";

import type { ThemeToggleProps } from "@/components/theme-toggle.types";
import { splashHaptic } from "@/lib/haptics";
import { setThemePreference } from "@/lib/storage";
import { useColorSchemePreference } from "@/theme/theme";

const HEAD_R = 14;
const TAIL_R = 7;

// Sharpens the blurred alpha back into a hard edge -- the metaball trick.
const GOO_MATRIX = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 40, -18,
];

// On tap we screenshot the current theme, flip the color scheme underneath
// it, then the liquid shapes ERASE the screenshot with a dstOut blend: the
// drop and the rising wave are literally windows into the new theme, so the
// wave front reveals the other color. No overlay to fade at the end: when
// the flood covers the screen the screenshot is fully erased.
export function ThemeToggle({ style }: ThemeToggleProps) {
  const { width, height } = useWindowDimensions();
  const scheme = useColorSchemePreference();
  const isDark = scheme === "dark";
  const [animating, setAnimating] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [shotUri, setShotUri] = useState<string | null>(null);
  const pendingRef = useRef<"light" | "dark" | null>(null);
  const animationIdRef = useRef(0);
  const iconRef = useRef<RNView>(null);
  const shot = useImage(shotUri);

  const originX = useSharedValue(width / 2);
  const originY = useSharedValue(height * 0.4);

  const sourceR = useSharedValue(0);
  const dropY = useSharedValue(0);
  const dropR = useSharedValue(0);
  // distance between the drop head and its trailing tail: the teardrop shape
  const stretch = useSharedValue(0);
  const poolR = useSharedValue(0);
  const iconScale = useSharedValue(1);

  const floorY = height - 8;
  const poolCy = height + 60;
  // reaches every corner no matter where the wave starts from
  const coverR = Math.hypot(width, height) + 120;

  const measure = () => {
    iconRef.current?.measureInWindow((x, y, w, h) => {
      originX.value = x + w / 2;
      originY.value = y + h / 2 + 52;
    });
  };

  const cleanup = useCallback(() => {
    animationIdRef.current += 1;
    pendingRef.current = null;
    setOverlayVisible(false);
    setShotUri(null);
    setAnimating(false);
  }, []);

  const runDrip = () => {
    sourceR.value = 0;
    dropR.value = 0;
    stretch.value = 0;
    poolR.value = 0;

    sourceR.value = withSequence(
      withTiming(11, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) })
    );
    dropR.value = withTiming(HEAD_R, {
      duration: 280,
      easing: Easing.out(Easing.quad),
    });
    stretch.value = withDelay(
      280,
      withSequence(
        withTiming(36, { duration: 200, easing: Easing.out(Easing.quad) }),
        withTiming(28, { duration: 120 }),
        withTiming(2, { duration: 60 })
      )
    );

    dropY.value = originY.value;
    dropY.value = withSequence(
      withTiming(originY.value + 16, {
        duration: 280,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(
        floorY,
        { duration: 380, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(splashHaptic)();
            dropR.value = withTiming(0, { duration: 90 });
            poolR.value = 60;
            poolR.value = withTiming(
              coverR,
              { duration: 650, easing: Easing.bezier(0.33, 0, 0.15, 1) },
              (done) => {
                if (done) runOnJS(cleanup)();
              }
            );
          }
        }
      )
    );
  };

  useEffect(() => {
    if (!shot || pendingRef.current === null) return;
    const next = pendingRef.current;
    pendingRef.current = null;
    setOverlayVisible(true);
    const frame = requestAnimationFrame(() => {
      Appearance.setColorScheme(next);
      void setThemePreference(next);
      runDrip();
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot]);

  useEffect(() => {
    if (!animating) return;
    // Reanimated callbacks can be interrupted by app backgrounding or a
    // resized window. Always release the modal and its input window.
    const watchdog = setTimeout(cleanup, 2_500);
    return () => clearTimeout(watchdog);
  }, [animating, cleanup]);

  const press = async () => {
    if (animating) return;
    const animationId = ++animationIdRef.current;
    setAnimating(true);
    iconScale.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 260 })
    );
    try {
      const uri = await captureScreen({ format: "jpg", quality: 0.9 });
      if (animationId !== animationIdRef.current) return;
      pendingRef.current = isDark ? "light" : "dark";
      setShotUri(uri.startsWith("file://") ? uri : `file://${uri}`);
    } catch {
      if (animationId !== animationIdRef.current) return;
      // no screenshot, flip without the liquid reveal
      const next = isDark ? "light" : "dark";
      Appearance.setColorScheme(next);
      void setThemePreference(next);
      setAnimating(false);
    }
  };

  const tailY = useDerivedValue(() => dropY.value - stretch.value);
  const tailR = useDerivedValue(() => Math.min(TAIL_R, 2 + stretch.value * 0.25));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  return (
    <>
      <Pressable
        accessibilityLabel="Toggle light/dark theme"
        accessibilityRole="button"
        accessibilityState={{ disabled: animating }}
        disabled={animating}
        onPress={press}
        style={[styles.trigger, style]}
      >
        <Animated.View onLayout={measure} ref={iconRef} style={[styles.icon, iconAnimStyle]}>
          <SymbolView
            name={isDark ? "sun.max.fill" : "moon.fill"}
            size={30}
            tintColor={isDark ? "#fafafa" : "#0a0a0a"}
          />
        </Animated.View>
      </Pressable>

      <Modal
        animationType="none"
        onRequestClose={cleanup}
        presentationStyle="overFullScreen"
        transparent
        visible={overlayVisible}
      >
        <RNView pointerEvents="none" style={StyleSheet.absoluteFill}>
          {/* The modal is mounted only after captureScreen and Skia image
              decoding complete. It unmounts as soon as the flood finishes. */}
          <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
            {shot ? (
              <>
                <SkiaImage image={shot} x={0} y={0} width={width} height={height} fit="cover" />
                <Group
                  layer={
                    <Paint blendMode="dstOut">
                      <Blur blur={8} />
                      <ColorMatrix matrix={GOO_MATRIX} />
                    </Paint>
                  }
                >
                  <Circle cx={originX} cy={originY} r={sourceR} color="black" />
                  <Circle cx={originX} cy={dropY} r={dropR} color="black" />
                  <Circle cx={originX} cy={tailY} r={tailR} color="black" />
                  <Circle cx={originX} cy={poolCy} r={poolR} color="black" />
                </Group>
              </>
            ) : null}
          </Canvas>
        </RNView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
