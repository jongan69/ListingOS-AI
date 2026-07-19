import { useCallback, useEffect, useRef, useState } from "react";
import { Appearance, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import type { ThemeToggleProps } from "@/components/theme-toggle.types";
import { confirmHaptic } from "@/lib/haptics";
import { setThemePreference } from "@/lib/storage";
import { useColorSchemePreference, usePalette } from "@/theme/theme";

// Simpler cross-fade sibling to the iOS ink-flood animation: a plain
// full-screen opacity veil covers the content, the scheme flips
// underneath it, then the veil clears to reveal the new theme.
export function ThemeToggle({ style }: ThemeToggleProps) {
  const scheme = useColorSchemePreference();
  const palette = usePalette();
  const [animating, setAnimating] = useState(false);
  const [veilColor, setVeilColor] = useState(palette.background);
  const veilOpacity = useSharedValue(0);
  const pendingSchemeRef = useRef<"light" | "dark" | null>(null);

  const cleanup = useCallback(() => {
    pendingSchemeRef.current = null;
    setAnimating(false);
  }, []);

  const flipScheme = () => {
    const next = pendingSchemeRef.current;
    pendingSchemeRef.current = null;
    if (!next) return;
    Appearance.setColorScheme(next);
    void setThemePreference(next);
    veilOpacity.value = withDelay(
      40,
      withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) runOnJS(cleanup)();
      })
    );
  };

  useEffect(() => {
    if (!animating) return;
    // Ensure an interrupted animation never leaves a modal input window alive.
    const watchdog = setTimeout(cleanup, 1_500);
    return () => clearTimeout(watchdog);
  }, [animating, cleanup]);

  const press = () => {
    if (animating) return;
    setAnimating(true);
    setVeilColor(palette.background);
    void confirmHaptic();
    pendingSchemeRef.current = scheme === "light" ? "dark" : "light";
    veilOpacity.value = 0;
    veilOpacity.value = withTiming(
      1,
      { duration: 220, easing: Easing.in(Easing.quad) },
      (done) => {
        if (done) runOnJS(flipScheme)();
      }
    );
  };

  const veilStyle = useAnimatedStyle(() => ({ opacity: veilOpacity.value }));

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
        <View style={[styles.glyphShell, { backgroundColor: palette.cardStrong, borderColor: palette.border }]}>
          <Text allowFontScaling={false} style={styles.glyph}>{scheme === "dark" ? "☀️" : "🌙"}</Text>
        </View>
      </Pressable>
      <Modal
        animationType="none"
        onRequestClose={cleanup}
        presentationStyle="overFullScreen"
        transparent
        visible={animating}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: veilColor }, veilStyle]}
          />
        </View>
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
  glyphShell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    fontSize: 18,
  },
});
