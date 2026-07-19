import { Platform } from "react-native";

import { ThemeToggle as AndroidThemeToggle } from "@/components/theme-toggle.android";
import { ThemeToggle as IosThemeToggle } from "@/components/theme-toggle.ios";
import type { ThemeToggleProps } from "@/components/theme-toggle.types";
import { ThemeToggle as WebThemeToggle } from "@/components/theme-toggle.web";

export function ThemeToggle(props: ThemeToggleProps) {
  if (Platform.OS === "web") return <WebThemeToggle {...props} />;
  if (Platform.OS === "ios") return <IosThemeToggle {...props} />;
  return <AndroidThemeToggle {...props} />;
}
