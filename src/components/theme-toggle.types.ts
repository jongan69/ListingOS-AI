import type { StyleProp, ViewStyle } from "react-native";

export type ThemeToggleProps = {
  // Styles the in-flow trigger. The full-screen transition is rendered
  // separately, so positioning this control never positions the overlay.
  style?: StyleProp<ViewStyle>;
};
