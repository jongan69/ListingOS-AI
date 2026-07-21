import { useCallback, useEffect, useState } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";

import { getThemePreference, setThemePreference, THEME_PREFERENCE_KEY } from "@/lib/storage";
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
let webThemePreference: ColorScheme | null = null;

const webThemeSubscribers = new Set<(next: ColorScheme | null) => void>();
const WEB_STORAGE_KEY = THEME_PREFERENCE_KEY;

function readWebThemePreference() {
  // Runs in a useState initializer on every platform. Native has `window` but
  // no `localStorage`, so gate on the platform rather than on `window`.
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    return normalizeStoredTheme(window.localStorage?.getItem(WEB_STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
}

function getSystemScheme(raw: ReturnType<typeof useColorScheme>): ColorScheme {
  return raw === "light" ? "light" : "dark";
}

function normalizeStoredTheme(raw: string | null): ColorScheme | null {
  return raw === "light" || raw === "dark" ? raw : null;
}

function setWebTheme(next: ColorScheme | null) {
  if (webThemePreference === next) return;

  webThemePreference = next;
  for (const listener of webThemeSubscribers) {
    listener(next);
  }
}

function useWebThemePreference(systemSchemeRaw: ReturnType<typeof useColorScheme>) {
  const systemScheme = getSystemScheme(systemSchemeRaw);
  const [manualScheme, setManualScheme] = useState<ColorScheme | null>(() =>
    webThemePreference ?? readWebThemePreference(),
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const onChange = (next: ColorScheme | null) => {
      setManualScheme(next);
    };

    webThemeSubscribers.add(onChange);

    void getThemePreference().then((stored) => {
      const normalized = normalizeStoredTheme(stored);
      setWebTheme(normalized);
    });

    if (typeof window !== "undefined") {
      const storageHandler = (event: StorageEvent) => {
        if (event.key !== THEME_PREFERENCE_KEY) return;
        setWebTheme(normalizeStoredTheme(event.newValue));
      };
      window.addEventListener("storage", storageHandler);

      return () => {
        webThemeSubscribers.delete(onChange);
        window.removeEventListener("storage", storageHandler);
      };
    }

    return () => {
      webThemeSubscribers.delete(onChange);
    };
  }, [systemSchemeRaw]);

  if (Platform.OS !== "web") {
    return getSystemScheme(systemSchemeRaw);
  }

  return manualScheme ?? systemScheme;
}

export function useColorSchemePreference(): ColorScheme {
  const systemScheme = useColorScheme();
  const [ready, setReady] = useState(hydrated);
  const webScheme = useWebThemePreference(systemScheme);

  useEffect(() => {
    if (Platform.OS === "web") {
      // Deliberate one-time flip after mount. The static web export prerenders
      // with no `window`, so localStorage-backed theme is unknown server-side.
      // Rendering "dark" until mounted keeps the first client render identical
      // to the prerendered HTML and avoids a hydration mismatch; deriving this
      // during render instead would reintroduce that mismatch for users whose
      // stored preference is "light". Not a cascading-render bug.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true);
      return;
    }
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

  if (Platform.OS === "web") return ready ? webScheme : "dark";

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
    if (Platform.OS === "web") {
      setWebTheme(next);
      void setThemePreference(next);
      return;
    }

    Appearance.setColorScheme(next);
    void setThemePreference(next);
  }, []);

  const toggleScheme = useCallback(() => {
    setScheme(scheme === "light" ? "dark" : "light");
  }, [scheme, setScheme]);

  return { scheme, setScheme, toggleScheme };
}
