import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { SurfaceCard } from "@/components/surface-card";
import type { Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

export function NotFoundScreen() {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const router = useRouter();

  return (
    <AppScreen>
      <SurfaceCard eyebrow="404" title="This page is not available" subtitle="The link may be old, or this draft may belong to another signed-in seller.">
        <View style={styles.stack}>
          <Text selectable style={styles.body}>Return home to reconnect eBay or open a draft from your current queue.</Text>
          <AppButton label="Return to ListingOS" onPress={() => router.replace("/")} />
        </View>
      </SurfaceCard>
    </AppScreen>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  stack: {
    gap: 18,
  },
  body: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});
