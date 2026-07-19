import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { type PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useColorSchemePreference } from "@/theme/theme";

export function AppGlass({
  children,
  disableBlur = false,
  intensity = 60,
  style,
}: PropsWithChildren<{
  disableBlur?: boolean;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}>) {
  const scheme = useColorSchemePreference();
  const isLight = scheme === "light";
  const containerStyle = [
    styles.glass,
    {
      backgroundColor: Platform.select({
        android: isLight ? "rgba(255, 255, 255, 0.72)" : "rgba(10, 24, 38, 0.76)",
        default: isLight ? "rgba(255, 255, 255, 0.42)" : "rgba(10, 24, 38, 0.48)",
      }),
    },
    style,
  ];
  const gradient = (
    <LinearGradient
      colors={
        isLight
          ? ["rgba(255,255,255,0.5)", "rgba(255,255,255,0.12)", "rgba(14,168,148,0.05)"]
          : ["rgba(255,255,255,0.105)", "rgba(255,255,255,0.028)", "rgba(102,225,209,0.045)"]
      }
      end={{ x: 1, y: 1 }}
      pointerEvents="none"
      start={{ x: 0, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  );

  if (disableBlur) {
    return <View style={containerStyle}>{children}</View>;
  }

  return (
    <BlurView
      blurReductionFactor={3}
      intensity={intensity}
      style={containerStyle}
      tint={isLight ? "systemUltraThinMaterialLight" : "systemUltraThinMaterialDark"}
    >
      {gradient}
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  glass: {
    // iOS BlurView renders its own compositing layer and ignores a
    // parent's overflow: hidden, so it must clip itself to match
    // whatever borderRadius the caller passes in via `style`.
    overflow: "hidden",
  },
});
