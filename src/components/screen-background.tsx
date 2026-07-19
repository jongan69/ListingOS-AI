import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePalette } from "@/theme/theme";

export function ScreenBackground() {
  const palette = usePalette();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  // Scale blob sizes responsively
  const scale = Math.min(width, height) / 420;
  const blobBaseSize = 260 * scale;
  const smallBlobSize = 220 * scale;
  
  // Responsive positioning that accounts for safe areas
  const blobOneSize = blobBaseSize;
  const blobTwoSize = blobBaseSize;
  const blobThreeSize = smallBlobSize;
  
  const dynamicStyles = {
    blobOne: {
      top: insets.top + blobOneSize * 0.1,
      left: -blobOneSize * 0.32,
      width: blobOneSize,
      height: blobOneSize,
    },
    blobTwo: {
      top: height * 0.35,
      right: -blobTwoSize * 0.23,
      width: blobTwoSize,
      height: blobTwoSize,
    },
    blobThree: {
      bottom: height * 0.12,
      left: width * 0.05,
      width: blobThreeSize,
      height: blobThreeSize,
    },
  };

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.container]}>
      <LinearGradient
        colors={[palette.background, palette.backgroundAlt, palette.header]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.grid} />
      <LinearGradient
        colors={["rgba(55,119,177,0.26)", "rgba(55,119,177,0.08)", "rgba(55,119,177,0)"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
        style={[styles.blob, dynamicStyles.blobOne]}
      />
      <LinearGradient
        colors={["rgba(104,224,211,0.22)", "rgba(104,224,211,0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.blob, dynamicStyles.blobTwo]}
      />
      <LinearGradient
        colors={["rgba(250,200,116,0.18)", "rgba(250,200,116,0)"]}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
        style={[styles.blob, dynamicStyles.blobThree]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.95,
  },
  grid: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255,255,255,0.015)",
    opacity: 0.35,
  },
});
