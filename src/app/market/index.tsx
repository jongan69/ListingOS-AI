import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { AppButton } from "@/components/app-button";
import { AppScreen, AppTextInput } from "@/components/app-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { SurfaceCard } from "@/components/surface-card";
import { WebPageHead } from "@/components/web-page-head";
import { appConfig } from "@/config/app";
import { brand } from "@/config/brand";
import { api } from "@/lib/api";
import { type Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

const TITLE = "Local listings | ListingOS";
const DESCRIPTION = "Browse nearby listings and message sellers fast in the ListingOS web marketplace.";

type LocationPoint = {
  lat: number;
  lng: number;
};

export default function MarketIndexRoute() {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<LocationPoint | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 4_000 },
    );
  }, []);

  const apiContext = useMemo(() => ({ apiBaseUrl: appConfig.apiBaseUrl }), []);
  const feedQuery = useQuery({
    queryKey: ["market-feed", appConfig.apiBaseUrl, query, location?.lat, location?.lng],
    queryFn: () => api.getPublicMarketFeed(apiContext, {
      q: query.trim() || undefined,
      lat: location?.lat,
      lng: location?.lng,
      radiusMiles: 80,
    }),
  });

  return (
    <AppScreen>
      <WebPageHead title={TITLE} description={DESCRIPTION} />
      <ScreenToolbar title="Local marketplace" onBack={() => router.back()} />
      <SurfaceCard eyebrow="Fast local deals" title="Browse nearby listings" subtitle="Search nearby items and open a thread with the seller in seconds.">
        <AppTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search for bikes, gear, furniture..."
          placeholderTextColor={palette.textSoft}
          style={styles.input}
          selectionColor={palette.cyan}
        />
        <View style={styles.pillRow}>
          <Text style={styles.pillText}>{location ? "Using your location" : "Using a local default"}</Text>
          <Text style={styles.pillText}>Fast messaging • no extra tokens</Text>
        </View>
      </SurfaceCard>

      {feedQuery.isLoading ? (
        <SurfaceCard eyebrow="Loading" title="Gathering local listings" subtitle="The web marketplace is fetching nearby items right now." />
      ) : feedQuery.isError ? (
        <SurfaceCard eyebrow="Could not load" title="The listing feed is unavailable" subtitle="Refresh and try again in a moment." />
      ) : !feedQuery.data?.items.length ? (
        <SurfaceCard eyebrow="Empty" title="Nothing nearby yet" subtitle="Try another search or publish a draft to make this feed active." />
      ) : (
        <View style={styles.listStack}>
          {feedQuery.data.items.map((item) => (
            <SurfaceCard key={item.id} eyebrow="Local listing" title={item.title} subtitle={`${item.price ? `$${item.price.toFixed(0)}` : "Free"} · ${item.locationLabel ?? "Local pickup"}`}>
              <Text style={styles.bodyText}>{item.description}</Text>
              <View style={styles.row}>
                <AppButton
                  label="Open"
                  tone="secondary"
                  onPress={() => router.push(`/market/${item.slug}` as never)}
                />
                <AppButton
                  label="Message"
                  onPress={() => router.push(`/market/${item.slug}` as never)}
                />
              </View>
            </SurfaceCard>
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.text,
    backgroundColor: palette.cardStrong,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pillText: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  listStack: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
});
