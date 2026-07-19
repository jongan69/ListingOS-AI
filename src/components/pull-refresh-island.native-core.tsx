/* eslint-disable react-hooks/immutability -- Reanimated SharedValue writes are the intended animation state model. */
import {
  Blur,
  Canvas,
  Circle,
  ColorMatrix,
  Group,
  Paint,
  Path,
  RoundedRect,
  Skia,
} from "@shopify/react-native-skia";
import { useCallback, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PullRefreshIslandProps } from "@/components/pull-refresh-island.types";
import { confirmHaptic } from "@/lib/haptics";
import { usePalette } from "@/theme/theme";

const ISLAND_WIDTH = 126;
const ISLAND_HEIGHT = 37;
const ANDROID_SOURCE_WIDTH = 58;
const ANDROID_SOURCE_HEIGHT = 30;
const DROP_RADIUS = 22;
const SPINNER_RADIUS = 9;
const SPRING = { damping: 14, stiffness: 160, mass: 0.8 };
const GOO_MATRIX = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 40, -18,
];

type NativePullRefreshIslandProps = PullRefreshIslandProps & {
  variant: "android" | "ios";
};

export function NativePullRefreshIsland({
  children,
  contentContainerStyle,
  keyboardDismissMode,
  keyboardShouldPersistTaps,
  onRefresh,
  onScrollOffsetChange,
  scrollRef,
  threshold = 104,
  variant,
}: NativePullRefreshIslandProps) {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const hasDynamicIslandOrigin = variant === "ios" && insets.top >= 59;
  const cx = width / 2;
  const islandTop = insets.top - 48;
  const islandCenterY = islandTop + ISLAND_HEIGHT / 2;
  const holdY = hasDynamicIslandOrigin ? insets.top + 52 : insets.top + 36;
  const canvasHeight = holdY + DROP_RADIUS + 64;
  const pull = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const refreshing = useSharedValue(0);
  const spin = useSharedValue(0);

  const finish = useCallback(() => {
    refreshing.value = 0;
    pull.value = withSpring(0, SPRING);
    cancelAnimation(spin);
  }, [pull, refreshing, spin]);

  const start = useCallback(async () => {
    void confirmHaptic();
    spin.value = 0;
    spin.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 900, easing: Easing.linear }),
      -1,
    );
    try {
      await onRefresh();
    } finally {
      finish();
    }
  }, [finish, onRefresh, spin]);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    if (onScrollOffsetChange) {
      runOnJS(onScrollOffsetChange)(event.contentOffset.y);
    }
  });

  const native = Gesture.Native();
  const pan = Gesture.Pan()
    .simultaneousWithExternalGesture(native)
    .onChange((event) => {
      if (refreshing.value === 1) return;
      if (pull.value > 0 || (scrollY.value <= 0 && event.changeY > 0)) {
        const resistance = pull.value > threshold ? 0.3 : 0.55;
        pull.value = Math.max(0, pull.value + event.changeY * resistance);
      }
    })
    .onEnd(() => {
      if (refreshing.value === 1) return;
      if (pull.value >= threshold) {
        refreshing.value = 1;
        pull.value = withSpring(threshold, SPRING);
        runOnJS(start)();
      } else {
        pull.value = withSpring(0, SPRING);
      }
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }));

  // On Dynamic Island devices the source shape must be solid black so it
  // visually fuses with the real hardware island; anything else reads as a
  // floating colored blob sitting next to it instead of coming out of it.
  const refreshBodyColor = hasDynamicIslandOrigin ? "#000000" : palette.background;
  const refreshInkColor = hasDynamicIslandOrigin ? "#FFFFFF" : palette.cyan;
  const sourceX = hasDynamicIslandOrigin ? cx - ISLAND_WIDTH / 2 : cx - ANDROID_SOURCE_WIDTH / 2;
  const sourceY = hasDynamicIslandOrigin ? islandTop : -ANDROID_SOURCE_HEIGHT * 0.82;
  const sourceWidth = hasDynamicIslandOrigin ? ISLAND_WIDTH : ANDROID_SOURCE_WIDTH;
  const sourceBaseHeight = hasDynamicIslandOrigin ? ISLAND_HEIGHT : ANDROID_SOURCE_HEIGHT;
  const sourceRadius = sourceBaseHeight / 2;
  const dropStartY = hasDynamicIslandOrigin ? islandCenterY : sourceY + sourceBaseHeight - 3;

  const refreshP = useDerivedValue(() => withTiming(refreshing.value, { duration: 250 }));
  const sourceHeight = useDerivedValue(() => {
    const stretch = interpolate(
      pull.value,
      [0, threshold],
      [0, hasDynamicIslandOrigin ? 10 : 20],
      Extrapolation.CLAMP,
    );
    return sourceBaseHeight + stretch * (1 - refreshP.value);
  });
  const dropCy = useDerivedValue(() =>
    interpolate(
      pull.value,
      [0, threshold, threshold * 3],
      [dropStartY, holdY, holdY + 40],
      Extrapolation.CLAMP,
    ),
  );
  const dropR = useDerivedValue(() =>
    interpolate(
      pull.value,
      [0, threshold * 0.35, threshold],
      [4, 12, DROP_RADIUS],
      Extrapolation.CLAMP,
    ),
  );
  const progressPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addArc(
      { x: -SPINNER_RADIUS, y: -SPINNER_RADIUS, width: SPINNER_RADIUS * 2, height: SPINNER_RADIUS * 2 },
      -90,
      359.9,
    );
    return path;
  }, []);
  const spinnerPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addArc(
      { x: -SPINNER_RADIUS, y: -SPINNER_RADIUS, width: SPINNER_RADIUS * 2, height: SPINNER_RADIUS * 2 },
      0,
      270,
    );
    return path;
  }, []);
  const progressEnd = useDerivedValue(() => interpolate(pull.value, [0, threshold], [0, 1], Extrapolation.CLAMP));
  const progressOpacity = useDerivedValue(() =>
    interpolate(pull.value, [threshold * 0.4, threshold * 0.75], [0, 1], Extrapolation.CLAMP) * (1 - refreshP.value),
  );
  const sourceOpacity = useDerivedValue(() =>
    hasDynamicIslandOrigin ? 1 : Math.max(refreshP.value, interpolate(pull.value, [0, 18], [0, 1], Extrapolation.CLAMP)),
  );
  const progressTransform = useDerivedValue(() => [{ translateX: cx }, { translateY: dropCy.value }]);
  const spinnerTransform = useDerivedValue(() => [{ translateX: cx }, { translateY: dropCy.value }, { rotate: spin.value }]);
  const spinnerOpacity = useDerivedValue(() => refreshP.value);

  return (
    <View style={styles.container}>
      <Canvas pointerEvents="none" style={[styles.canvas, { height: canvasHeight }]}>
        <Group
          opacity={sourceOpacity}
          layer={(
            <Paint>
              <Blur blur={6} />
              <ColorMatrix matrix={GOO_MATRIX} />
            </Paint>
          )}
        >
          <RoundedRect
            color={refreshBodyColor}
            height={sourceHeight}
            r={sourceRadius}
            width={sourceWidth}
            x={sourceX}
            y={sourceY}
          />
          <Circle color={refreshBodyColor} cx={cx} cy={dropCy} r={dropR} />
        </Group>
        <Group opacity={progressOpacity} transform={progressTransform}>
          <Path
            color={refreshInkColor}
            end={progressEnd}
            path={progressPath}
            start={0}
            strokeCap="round"
            strokeWidth={2.5}
            style="stroke"
          />
        </Group>
        <Group opacity={spinnerOpacity} transform={spinnerTransform}>
          <Path
            color={refreshInkColor}
            path={spinnerPath}
            strokeCap="round"
            strokeWidth={2.5}
            style="stroke"
          />
        </Group>
      </Canvas>

      <GestureDetector gesture={pan}>
        <GestureDetector gesture={native}>
          <Animated.ScrollView
            automaticallyAdjustKeyboardInsets
            bounces={false}
            // AppScreen already supplies the safe-area inset. Letting UIKit
            // add it again leaves an oversized gap above the iOS header.
            contentInsetAdjustmentBehavior={variant === "ios" ? "never" : "automatic"}
            contentContainerStyle={contentContainerStyle}
            keyboardDismissMode={keyboardDismissMode}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            onScroll={onScroll}
            overScrollMode="never"
            ref={scrollRef}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={[styles.container, styles.contentLayer, contentStyle]}
          >
            {children}
          </Animated.ScrollView>
        </GestureDetector>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentLayer: {
    zIndex: 1,
  },
  canvas: {
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 0,
  },
});
