import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { AppButton } from "@/components/app-button";
import { AppScreen, AppTextInput } from "@/components/app-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { SurfaceCard } from "@/components/surface-card";
import { WebPageHead } from "@/components/web-page-head";
import { appConfig } from "@/config/app";
import { api } from "@/lib/api";
import { type Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

const TITLE = "Listing details | ListingOS";
const DESCRIPTION = "Message the seller and coordinate a pickup or delivery for this local listing.";

export default function MarketListingRoute() {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = params.slug;
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const apiContext = useMemo(() => ({ apiBaseUrl: appConfig.apiBaseUrl }), []);

  const listingQuery = useQuery({
    queryKey: ["market-listing", slug],
    queryFn: () => api.getPublicMarketListing(apiContext, slug as string),
    enabled: Boolean(slug),
  });

  const inquiryMutation = useMutation({
    mutationFn: () => api.startMarketInquiry(apiContext, slug as string, { email, message }),
  });

  return (
    <AppScreen>
      <WebPageHead title={TITLE} description={DESCRIPTION} />
      <ScreenToolbar title="Listing details" onBack={() => router.back()} />
      {listingQuery.isLoading ? (
        <SurfaceCard eyebrow="Loading" title="Opening listing" subtitle="Preparing the seller thread for you." />
      ) : listingQuery.isError || !listingQuery.data ? (
        <SurfaceCard eyebrow="Unavailable" title="This listing is not ready" subtitle="Try going back and refreshing the feed." />
      ) : (
        <>
          <SurfaceCard eyebrow="Local item" title={listingQuery.data.title} subtitle={`${listingQuery.data.price ? `$${listingQuery.data.price.toFixed(0)}` : "Free"} · ${listingQuery.data.locationLabel ?? "Local pickup"}`}>
            <Text style={styles.bodyText}>{listingQuery.data.description}</Text>
            {listingQuery.data.photoUrls?.length ? (
              <View style={styles.photoRow}>
                {listingQuery.data.photoUrls.slice(0, 3).map((url) => (
                  <View key={url} style={styles.photoBox}>
                    <Text style={styles.photoText}>Photo</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </SurfaceCard>

          <SurfaceCard eyebrow="Message seller" title="Start a quick chat" subtitle="Share your email and a short message. The app stores the thread locally in the worker for follow-up.">
            <AppTextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Your email"
              placeholderTextColor={palette.textSoft}
              style={styles.input}
              selectionColor={palette.cyan}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <AppTextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Hi, is this still available?"
              placeholderTextColor={palette.textSoft}
              style={[styles.input, styles.multilineInput]}
              selectionColor={palette.cyan}
              multiline
            />
            <AppButton
              label={inquiryMutation.isPending ? "Sending..." : "Send message"}
              onPress={() => inquiryMutation.mutate()}
              loading={inquiryMutation.isPending}
            />
            {inquiryMutation.isSuccess ? (
              <Text style={styles.successText}>Your message is queued for the seller. They can reply from the ListingOS marketplace thread.</Text>
            ) : null}
          </SurfaceCard>
        </>
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
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  photoRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  photoBox: {
    width: 86,
    height: 86,
    borderRadius: 16,
    backgroundColor: palette.cardStrong,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.border,
  },
  photoText: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  successText: {
    color: palette.cyan,
    fontSize: 13,
    lineHeight: 20,
  },
});
