import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { AppButton } from "@/components/app-button";
import { AppScreen, AppTextInput } from "@/components/app-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { SurfaceCard } from "@/components/surface-card";
import { WebPageHead } from "@/components/web-page-head";
import { appConfig } from "@/config/app";
import { api } from "@/lib/api";
import { type Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

const TITLE = "Public listings | ListingOS";
const DESCRIPTION = "Browse public listings and record a verified inquiry in the ListingOS Market demo.";

export default function MarketIndexRoute() {
  if (appConfig.proofModeEnabled) {
    return <Redirect href="/" />;
  }

  return <MarketIndexScreen />;
}

function MarketIndexScreen() {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const router = useRouter();
  const [query, setQuery] = useState("");

  const apiContext = useMemo(() => ({ apiBaseUrl: appConfig.apiBaseUrl }), []);
  const feedQuery = useQuery({
    queryKey: ["market-feed", appConfig.apiBaseUrl, query],
    queryFn: () => api.getPublicMarketFeed(apiContext, {
      q: query.trim() || undefined,
    }),
  });

  return (
    <AppScreen>
      <WebPageHead title={TITLE} description={DESCRIPTION} />
      <ScreenToolbar title="ListingOS Market beta" onBack={() => router.back()} />
      <SurfaceCard eyebrow="Public beta" title="Browse public listings" subtitle="Search the beta feed and record a verified marketplace inquiry.">
        <AppTextInput
          accessibilityLabel="Search public listings"
          value={query}
          onChangeText={setQuery}
          placeholder="Search for bikes, gear, furniture..."
          placeholderTextColor={palette.textSoft}
          style={styles.input}
          selectionColor={palette.cyan}
        />
        <View style={styles.pillRow}>
          <Text style={styles.pillText}>Public listing feed</Text>
          <Text style={styles.pillText}>Verified inquiry demo</Text>
        </View>
      </SurfaceCard>

      {feedQuery.isLoading ? (
        <SurfaceCard eyebrow="Loading" title="Gathering public listings" subtitle="The Market beta is loading its public feed." />
      ) : feedQuery.isError ? (
        <SurfaceCard
          eyebrow="Could not load"
          title="The listing feed is unavailable"
          subtitle={feedQuery.error instanceof Error ? feedQuery.error.message : "Refresh and try again in a moment."}
        >
          <AppButton label="Try again" tone="secondary" onPress={() => void feedQuery.refetch()} loading={feedQuery.isFetching} />
        </SurfaceCard>
      ) : !feedQuery.data?.items.length ? (
        <SurfaceCard eyebrow="Empty" title="No public listings yet" subtitle="Try another search or publish a reviewed draft to the Market beta." />
      ) : (
        <View style={styles.listStack}>
          {feedQuery.data.items.map((item) => (
            <SurfaceCard key={item.id} eyebrow="Public listing" title={item.title} subtitle={marketListingSubtitle(item)}>
              {item.photoUrls[0] ? (
                <Image
                  accessibilityLabel={`Photo of ${item.title}`}
                  accessibilityRole="image"
                  contentFit="cover"
                  source={{ uri: item.photoUrls[0] }}
                  style={styles.listingPhoto}
                  transition={180}
                />
              ) : null}
              <Text selectable numberOfLines={3} style={styles.bodyText}>{item.description}</Text>
              <View style={styles.row}>
                <AppButton
                  label="Open"
                  tone="secondary"
                  onPress={() => router.push(`/market/${item.slug}` as never)}
                />
                <AppButton
                  label="Record interest"
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
  listingPhoto: {
    width: "100%",
    aspectRatio: 1.5,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: palette.cardStrong,
  },
});

function marketListingSubtitle(item: {
  locationLabel: string | null;
  price: number;
}) {
  const price = item.price > 0 ? `$${item.price.toFixed(0)}` : "Free";
  return `${price} · ${item.locationLabel ?? "Pickup details not provided"}`;
}
