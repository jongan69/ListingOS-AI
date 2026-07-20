import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ThemeToggleProps } from "@/components/theme-toggle.types";
import { useColorSchemePreference, usePalette, useThemeToggle } from "@/theme/theme";

export function ThemeToggle({ style }: ThemeToggleProps) {
  const { toggleScheme } = useThemeToggle();
  const scheme = useColorSchemePreference();
  const palette = usePalette();

  const press = useCallback(() => {
    toggleScheme();
  }, [toggleScheme]);

  return (
    <Pressable
      accessibilityLabel="Toggle light/dark theme"
      accessibilityRole="button"
      onPress={press}
      style={[styles.trigger, style]}
    >
      <View
        style={[
          styles.glyphShell,
          { backgroundColor: palette.cardStrong, borderColor: palette.border },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[styles.glyph, { color: palette.text }]}
        >
          {scheme === "dark" ? "☀️" : "🌙"}
        </Text>
      </View>
    </Pressable>
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
