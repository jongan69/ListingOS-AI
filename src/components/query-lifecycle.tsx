import { focusManager } from "@tanstack/react-query";
import { type PropsWithChildren, useEffect } from "react";
import { AppState } from "react-native";

export function QueryLifecycle({ children }: PropsWithChildren) {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
    });
    return () => subscription.remove();
  }, []);

  return children;
}
