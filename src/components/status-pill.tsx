import { Text, View } from "react-native";

import { AppGlass } from "@/components/app-glass";
import { usePalette } from "@/theme/theme";

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  const palette = usePalette();
  const toneColors = {
    neutral: { background: "rgba(255,255,255,0.06)", color: palette.textMuted },
    success: { background: "rgba(107,227,165,0.14)", color: palette.green },
    warning: { background: "rgba(249,199,114,0.14)", color: palette.gold },
    danger: { background: "rgba(243,154,177,0.14)", color: palette.rose },
    accent: { background: "rgba(71,184,255,0.14)", color: palette.cyan },
  }[tone];

  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        borderCurve: "continuous",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)",
      }}
    >
      <AppGlass
        intensity={64}
        style={{
          borderRadius: 999,
          borderCurve: "continuous",
          overflow: "hidden",
          paddingHorizontal: 12,
          paddingVertical: 7,
          backgroundColor: toneColors.background,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 1,
            left: 10,
            right: 10,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.18)",
            opacity: 0.55,
          }}
        />
        <Text
          style={{
            color: toneColors.color,
            fontSize: 12,
            fontWeight: "800",
            letterSpacing: 0.35,
          }}
        >
          {label}
        </Text>
      </AppGlass>
    </View>
  );
}
