import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { QueryLifecycle } from "@/components/query-lifecycle";
import { ToastProvider } from "@/components/toast-provider";
import { appConfig } from "@/config/app";
import { brand } from "@/config/brand";
import { useNotificationNavigation } from "@/hooks/use-notification-navigation";
import { createQueryClient } from "@/lib/query-client";
import { useColorSchemePreference, usePalette } from "@/theme/theme";

export default function RootLayout() {
  if (appConfig.proofModeEnabled) {
    return <AppProviders enableSellerLifecycle={false} />;
  }

  return <SellerRootLayout />;
}

function SellerRootLayout() {
  useNotificationNavigation();
  return <AppProviders enableSellerLifecycle />;
}

function AppProviders({ enableSellerLifecycle }: { enableSellerLifecycle: boolean }) {
  const palette = usePalette();
  const scheme = useColorSchemePreference();
  const [queryClient] = useState(createQueryClient);

  const app = (
    <SafeAreaProvider>
      <ToastProvider>
        <StatusBar
          backgroundColor={palette.header}
          barStyle={scheme === "light" ? "dark-content" : "light-content"}
          translucent={false}
        />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: palette.background,
            },
          }}
        >
          <Stack.Screen name="index" options={{ title: brand.name }} />
          <Stack.Screen name="batches/[batch-id]" options={{ title: "Draft Queue" }} />
          <Stack.Screen name="drafts/[draft-id]" options={{ title: "Draft Review" }} />
          <Stack.Screen name="app-support" options={{ title: "Support" }} />
          <Stack.Screen name="privacy" options={{ title: "Privacy Policy" }} />
          <Stack.Screen name="terms" options={{ title: "Terms" }} />
          <Stack.Screen name="support" options={{ title: "Support" }} />
          <Stack.Screen name="legal/terms" options={{ title: "Terms" }} />
        </Stack>
      </ToastProvider>
    </SafeAreaProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        {enableSellerLifecycle ? <QueryLifecycle>{app}</QueryLifecycle> : app}
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
