import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";

import { tapHaptic } from "@/lib/haptics";
import { usePalette } from "@/theme/theme";

export function SegmentedOptions<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const palette = usePalette();

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {options.map((option) => (
        <Pressable
          accessibilityLabel={option.label}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option.value }}
          key={option.value}
          onPress={() => {
            void tapHaptic();
            onChange(option.value);
          }}
          style={{
            borderRadius: 999,
            borderCurve: "continuous",
            paddingHorizontal: 16,
            paddingVertical: 11,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: value === option.value ? "rgba(255,255,255,0.18)" : palette.border,
            boxShadow: value === option.value ? `0 12px 36px ${palette.shadow}` : undefined,
            overflow: "hidden",
          }}
        >
          {value === option.value ? (
            <LinearGradient
              colors={["#F5FAFF", "#9FD7FF", "#72DFD2"]}
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
          ) : null}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: value === option.value ? palette.background : palette.textMuted,
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
