import { LinearGradient } from "expo-linear-gradient";
import { createContext, type PropsWithChildren, use, useCallback, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { confirmHaptic, errorHaptic, tapHaptic } from "@/lib/haptics";
import { type Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  title: string;
  message?: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastState = Required<Pick<ToastInput, "title" | "tone">> & {
  id: number;
  message?: string;
};

const ToastContext = createContext<{
  showToast: (input: ToastInput) => void;
} | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-16));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -16,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const showToast = useCallback((input: ToastInput) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const nextToast = {
      id: Date.now(),
      title: input.title,
      message: input.message,
      tone: input.tone ?? "info",
    };
    setToast(nextToast);
    opacity.setValue(0);
    translateY.setValue(-16);
    if (nextToast.tone === "success") {
      void confirmHaptic();
    } else if (nextToast.tone === "error") {
      void errorHaptic();
    } else {
      void tapHaptic();
    }
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 7,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
    timeoutRef.current = setTimeout(hideToast, input.durationMs ?? (nextToast.tone === "error" ? 5_500 : 3_800));
  }, [hideToast, opacity, translateY]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastLayer,
            {
              paddingTop: Math.max(insets.top, 16) + 8,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={hideToast}>
            <LinearGradient
              colors={toastGradient(toast.tone)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.toast}
            >
              <View style={[styles.iconBubble, toast.tone === "error" ? styles.errorBubble : toast.tone === "success" ? styles.successBubble : styles.infoBubble]}>
                <Text style={styles.iconText}>{toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "•"}</Text>
              </View>
              <View style={styles.copy}>
                <Text selectable style={styles.title}>{toast.title}</Text>
                {toast.message ? <Text selectable numberOfLines={3} style={styles.message}>{toast.message}</Text> : null}
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext>
  );
}

export function useToast() {
  const context = use(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

function toastGradient(tone: ToastTone): [string, string] {
  if (tone === "success") return ["rgba(107,227,165,0.96)", "rgba(102,225,209,0.92)"];
  if (tone === "error") return ["rgba(255,143,143,0.98)", "rgba(243,154,177,0.94)"];
  return ["rgba(142,208,255,0.96)", "rgba(102,225,209,0.88)"];
}

const createStyles = (palette: Palette) => StyleSheet.create({
  toastLayer: {
    left: 16,
    position: "absolute",
    right: 16,
    top: 0,
    zIndex: 1000,
  },
  toast: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.42)",
    borderCurve: "continuous",
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: `0 24px 60px ${palette.shadow}`,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  iconBubble: {
    alignItems: "center",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  successBubble: {
    backgroundColor: "rgba(4,67,44,0.28)",
  },
  errorBubble: {
    backgroundColor: "rgba(86,9,22,0.26)",
  },
  infoBubble: {
    backgroundColor: "rgba(7,34,58,0.24)",
  },
  iconText: {
    color: "#06111B",
    fontSize: 20,
    fontWeight: "900",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#06111B",
    fontSize: 16,
    fontWeight: "900",
  },
  message: {
    color: "rgba(6,17,27,0.78)",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
});
