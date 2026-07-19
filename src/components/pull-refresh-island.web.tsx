import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { PullRefreshIslandProps } from "@/components/pull-refresh-island.types";
import { type Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

export function PullRefreshIsland({
  children,
  contentContainerStyle,
  keyboardDismissMode,
  keyboardShouldPersistTaps,
  onRefresh,
  onScrollOffsetChange,
  scrollRef,
}: PullRefreshIslandProps) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={styles.container}>
      <View pointerEvents="box-none" style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          disabled={refreshing}
          onPress={refresh}
          style={({ pressed }) => [
            styles.refreshPill,
            pressed && styles.refreshPillPressed,
            refreshing && styles.refreshPillDisabled,
          ]}
        >
          <Text style={styles.refreshText}>{refreshing ? "Refreshing..." : "Refresh"}</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        onScroll={(event) => {
          onScrollOffsetChange?.(event.nativeEvent.contentOffset.y);
        }}
        ref={scrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.container}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    alignItems: "flex-end",
    paddingHorizontal: 18,
    paddingTop: 10,
    pointerEvents: "box-none",
  },
  refreshPill: {
    backgroundColor: "rgba(102, 225, 209, 0.16)",
    borderColor: "rgba(102, 225, 209, 0.28)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  refreshPillPressed: {
    transform: [{ scale: 0.98 }],
  },
  refreshPillDisabled: {
    opacity: 0.62,
  },
  refreshText: {
    color: palette.cyan,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
