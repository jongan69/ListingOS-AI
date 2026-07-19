import { useCallback, useEffect, useState } from "react";
import { Appearance, useColorScheme } from "react-native";

import { getThemePreference, setThemePreference } from "@/lib/storage";
import {
  darkGradients,
  darkPalette,
  type Gradients,
  lightGradients,
  lightPalette,
  type Palette,
} from "@/theme/palette";

export type ColorScheme = "light" | "dark";

let hydrated = false;

export function useColorSchemePreference(): ColorScheme {
  const systemScheme = useColorScheme();
  const [ready, setReady] = useState(hydrated);

  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;
    getThemePreference().then((stored) => {
      if (cancelled) return;
      hydrated = true;
      if (stored) Appearance.setColorScheme(stored);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return "dark";
  return systemScheme === "light" ? "light" : "dark";
}

export function usePalette(): Palette {
  const scheme = useColorSchemePreference();
  return scheme === "light" ? lightPalette : darkPalette;
}

export function useGradients(): Gradients {
  const scheme = useColorSchemePreference();
  return scheme === "light" ? lightGradients : darkGradients;
}

export function useThemeToggle() {
  const scheme = useColorSchemePreference();

  const setScheme = useCallback((next: ColorScheme) => {
    Appearance.setColorScheme(next);
    void setThemePreference(next);
  }, []);

  const toggleScheme = useCallback(() => {
    setScheme(scheme === "light" ? "dark" : "light");
  }, [scheme, setScheme]);

  return { scheme, setScheme, toggleScheme };
}
