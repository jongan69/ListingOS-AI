import { Host, Picker } from "@expo/ui";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type Palette } from "@/theme/palette";
import { useColorSchemePreference, usePalette } from "@/theme/theme";

export function NativePickerField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const palette = usePalette();
  const scheme = useColorSchemePreference();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const pickerOptions = options.some((option) => option.value === value)
    ? options
    : [{ value, label: value }, ...options];

  return (
    <View style={styles.shell}>
      <Text selectable style={styles.label}>{label}</Text>
      <View style={styles.pickerShell}>
        <Host colorScheme={scheme} matchContents seedColor={palette.cyan} style={styles.host}>
          <Picker selectedValue={value} onValueChange={(nextValue) => onChange(nextValue as T)}>
            {pickerOptions.map((option) => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </Picker>
        </Host>
      </View>
    </View>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  shell: {
    gap: 8,
  },
  label: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  pickerShell: {
    minHeight: 48,
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(142,208,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.055)",
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 10,
  },
  host: {
    width: "100%",
    minHeight: 46,
  },
});
