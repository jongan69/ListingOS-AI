import { Image } from "expo-image";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { brand } from "@/config/brand";
import { tapHaptic } from "@/lib/haptics";
import { type Palette } from "@/theme/palette";
import { useGradients, usePalette } from "@/theme/theme";

export function ScreenToolbar({ title, onBack }: { title: string; onBack: () => void }) {
  const palette = usePalette();
  const gradients = useGradients();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.toolbar}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => {
          void tapHaptic();
          onBack();
        }}
        style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
      >
        <Text selectable={false} style={styles.backText}>Back</Text>
      </Pressable>
      <LinearGradient
        colors={gradients.card as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.titlePill}
      >
        <Image accessibilityLabel="ListingOS" accessibilityRole="image" contentFit="cover" source={brand.mark} style={styles.mark} transition={180} />
        <View style={styles.titleCopy}>
          <Text selectable={false} style={styles.eyebrow}>{brand.name}</Text>
          <Text aria-level={1} numberOfLines={1} role="heading" selectable style={styles.title}>{title.replace(/^ListingOS\s*/i, "")}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  toolbar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    minWidth: 64,
    minHeight: 48,
    borderRadius: 20,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  backButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.11)",
    transform: [{ scale: 0.98 }],
  },
  backText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "800",
  },
  titlePill: {
    flex: 1,
    minHeight: 56,
    borderRadius: 22,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  titleCopy: {
    flex: 1,
    gap: 1,
  },
  eyebrow: {
    color: palette.cyan,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: palette.text,
    fontSize: 17,
    fontWeight: "900",
  },
});
