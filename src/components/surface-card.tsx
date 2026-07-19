import { LinearGradient } from "expo-linear-gradient";
import { PropsWithChildren } from "react";
import { Text, View } from "react-native";

import { AppGlass } from "@/components/app-glass";
import { useGradients, usePalette } from "@/theme/theme";

export function SurfaceCard({
  children,
  title,
  subtitle,
  eyebrow,
}: PropsWithChildren<{ title: string; subtitle?: string; eyebrow?: string }>) {
  const palette = usePalette();
  const gradients = useGradients();

  return (
    <View
      style={{
        borderRadius: 28,
        borderCurve: "continuous",
        boxShadow: `0 18px 60px ${palette.shadow}`,
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={gradients.card as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        }}
      />
      <AppGlass
        intensity={70}
        style={{
          borderRadius: 28,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: palette.card,
          borderColor: palette.border,
          borderWidth: 1,
          padding: 20,
          gap: 12,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -48,
            right: -36,
            width: 150,
            height: 150,
            borderRadius: 999,
            backgroundColor: "rgba(142, 208, 255, 0.1)",
          }}
        />
        {eyebrow ? (
          <Text
            style={{
              color: palette.cyan,
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 1.1,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text style={{ color: palette.text, fontSize: 20, fontWeight: "700" }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: palette.textMuted, fontSize: 14, lineHeight: 21 }}>{subtitle}</Text>
        ) : null}
        <View style={{ gap: 12 }}>{children}</View>
      </AppGlass>
    </View>
  );
}
