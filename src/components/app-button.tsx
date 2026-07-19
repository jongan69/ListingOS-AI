import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { AppGlass } from "@/components/app-glass";
import { tapHaptic } from "@/lib/haptics";
import { usePalette } from "@/theme/theme";

export function AppButton({
  label,
  onPress,
  disabled,
  loading = false,
  tone = "primary",
  accessibilityHint,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  tone?: "primary" | "secondary";
  accessibilityHint?: string;
}) {
  const palette = usePalette();
  const primary = tone === "primary";
  const unavailable = disabled || loading;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      onPress={() => {
        void tapHaptic();
        void onPress();
      }}
      style={({ pressed }) => ({
        opacity: unavailable ? 0.52 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      {primary ? (
        <LinearGradient
          colors={unavailable ? ["#A6B2BF", "#8694A3"] : ["#F5FAFF", "#8ED0FF", "#66E1D1"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: 58,
            borderRadius: 22,
            borderCurve: "continuous",
            paddingHorizontal: 18,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: unavailable ? undefined : `0 20px 40px ${palette.shadow}`,
            flexDirection: "row",
            gap: 10,
          }}
        >
          {loading ? <ActivityIndicator color="#04111D" size="small" /> : null}
          <Text
            style={{
              color: "#04111D",
              fontSize: 15,
              fontWeight: "800",
              letterSpacing: 0.1,
            }}
          >
            {label}
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={{
            minHeight: 56,
            borderRadius: 22,
            borderCurve: "continuous",
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <AppGlass
            intensity={70}
            style={{
              borderRadius: 22,
              borderCurve: "continuous",
              overflow: "hidden",
              minHeight: 56,
              paddingHorizontal: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.05)",
              flexDirection: "row",
              gap: 10,
            }}
          >
            {loading ? <ActivityIndicator color={palette.cyan} size="small" /> : null}
            <Text
              style={{
                color: palette.text,
                fontSize: 15,
                fontWeight: "700",
                letterSpacing: 0.1,
              }}
            >
              {label}
            </Text>
          </AppGlass>
        </View>
      )}
    </Pressable>
  );
}
