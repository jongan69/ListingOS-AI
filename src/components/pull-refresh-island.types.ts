import type { ReactNode } from "react";
import type { ScrollView, StyleProp, ViewStyle } from "react-native";

export type PullRefreshIslandProps = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardDismissMode?: "none" | "interactive" | "on-drag";
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
  onRefresh: () => Promise<void> | void;
  onScrollOffsetChange?: (offsetY: number) => void;
  scrollRef?: React.RefObject<ScrollView | null>;
  threshold?: number;
};
