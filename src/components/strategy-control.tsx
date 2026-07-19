import { useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { tapHaptic } from "@/lib/haptics";
import { type PricingStrategy } from "@/shared/contracts";
import { type Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

const STRATEGIES: { value: PricingStrategy; label: string; helper: string }[] = [
  { value: "fast_sale", label: "Fast", helper: "Lower price, quicker sell-through" },
  { value: "balanced", label: "Balanced", helper: "Best default mix of speed and margin" },
  { value: "max_profit", label: "Max Profit", helper: "Higher ask, more patience" },
];

export function StrategyControl({
  value,
  onChange,
}: {
  value: PricingStrategy;
  onChange: (value: PricingStrategy) => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const currentIndex = Math.max(0, STRATEGIES.findIndex((strategy) => strategy.value === value));
  const lastIndexRef = useRef(currentIndex);
  const currentStrategy = STRATEGIES[currentIndex] ?? STRATEGIES[1];

  function commitIndex(index: number) {
    const nextIndex = Math.max(0, Math.min(STRATEGIES.length - 1, Math.round(index)));
    if (nextIndex === lastIndexRef.current) return;
    lastIndexRef.current = nextIndex;
    void tapHaptic();
    onChange(STRATEGIES[nextIndex].value);
  }

  return (
    <View style={styles.shell}>
      <View style={styles.copyRow}>
        <View style={styles.copy}>
          <Text selectable style={styles.eyebrow}>Sell faster</Text>
          <Text selectable style={styles.title}>{currentStrategy.label}</Text>
          <Text selectable style={styles.helper}>{currentStrategy.helper}</Text>
        </View>
        <Text selectable style={styles.rightLabel}>Max profit</Text>
      </View>

      <View style={styles.chips}>
        {STRATEGIES.map((strategy, index) => {
          const selected = index === currentIndex;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={strategy.value}
              onPress={() => commitIndex(index)}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.chipSelected : null,
                pressed ? styles.chipPressed : null,
              ]}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
                {strategy.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  shell: {
    gap: 12,
  },
  copyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "900",
  },
  helper: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  rightLabel: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textAlign: "right",
    textTransform: "uppercase",
  },
  chips: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
  },
  chipSelected: {
    backgroundColor: "rgba(142,208,255,0.17)",
    borderColor: "rgba(142,208,255,0.42)",
  },
  chipPressed: {
    transform: [{ scale: 0.98 }],
  },
  chipText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  chipTextSelected: {
    color: palette.text,
  },
});
