import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatusPill } from "@/components/status-pill";
import { SurfaceCard } from "@/components/surface-card";
import { proofModeEntries } from "@/lib/proof-mode";
import type { Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

export function ProofModeSection({ onOpen }: { onOpen: (scenarioId: string) => void }) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <SurfaceCard
      eyebrow="Proof mode"
      title="Judge-safe replay of the strongest flows"
      subtitle="Replay stored publish evidence, trust-gated pricing, and blocker repair without touching a live seller account. Proof Mode does not claim this device performed the original publish."
    >
      <View style={styles.stack}>
        {proofModeEntries.map((entry) => (
          <Pressable
            accessibilityRole="button"
            key={entry.id}
            onPress={() => onOpen(entry.id)}
            style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
          >
            <View style={styles.copy}>
              <View style={styles.top}>
                <StatusPill label={entry.badge} tone="accent" />
                <Text selectable style={styles.action}>Open proof</Text>
              </View>
              <Text selectable style={styles.title}>{entry.title}</Text>
              <Text selectable style={styles.body}>{entry.subtitle}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </SurfaceCard>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  stack: {
    gap: 12,
  },
  card: {
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(142,208,255,0.18)",
    backgroundColor: "rgba(142,208,255,0.08)",
    padding: 16,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    backgroundColor: "rgba(142,208,255,0.12)",
  },
  copy: {
    gap: 8,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  action: {
    color: palette.cyan,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  body: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
