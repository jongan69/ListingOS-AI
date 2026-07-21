import { Image } from "expo-image";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { AppButton } from "@/components/app-button";
import { AppScreen, AppTextInput } from "@/components/app-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { SurfaceCard } from "@/components/surface-card";
import { WebPageHead } from "@/components/web-page-head";
import { appConfig } from "@/config/app";
import { api, ApiError } from "@/lib/api";
import { type Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

const TITLE = "Listing details | ListingOS";
const DESCRIPTION = "View a public ListingOS Market item and submit a verified marketplace inquiry.";

type VerificationState = {
  email: string;
  message: string;
  sessionToken: string;
};

export default function MarketListingRoute() {
  if (appConfig.proofModeEnabled) {
    return <Redirect href="/" />;
  }

  return <MarketListingScreen />;
}

function MarketListingScreen() {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationState, setVerificationState] = useState<VerificationState | null>(null);
  const apiContext = useMemo(() => ({ apiBaseUrl: appConfig.apiBaseUrl }), []);
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedMessage = message.trim();
  const canSend = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) && normalizedMessage.length > 0;

  const listingQuery = useQuery({
    queryKey: ["market-listing", appConfig.apiBaseUrl, slug],
    queryFn: () => api.getPublicMarketListing(apiContext, slug!),
    enabled: Boolean(slug),
  });

  const inquiryMutation = useMutation({
    mutationFn: async () => {
      if (!slug || !canSend) throw new Error("Enter a valid email and a short inquiry note first.");
      try {
        const result = await api.startMarketInquiry(apiContext, slug, {
          email: normalizedEmail,
          message: normalizedMessage,
        });
        return { status: "sent" as const, result };
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 403 || !/verif/i.test(error.message)) {
          throw error;
        }
        const pending = await api.startEmailSession(apiContext, normalizedEmail);
        return {
          status: "verification_required" as const,
          pending: {
            email: pending.email,
            message: normalizedMessage,
            sessionToken: pending.sessionToken,
          },
        };
      }
    },
    onSuccess: (outcome) => {
      if (outcome.status === "verification_required") {
        setVerificationState(outcome.pending);
        setVerificationCode("");
        return;
      }
      setVerificationState(null);
      setMessage("");
    },
  });

  const verificationMutation = useMutation({
    mutationFn: async () => {
      if (!slug || !verificationState) throw new Error("Start email verification again.");
      if (!/^\d{6}$/.test(verificationCode.trim())) throw new Error("Enter the 6-digit verification code.");
      await api.verifyEmailSession(apiContext, {
        email: verificationState.email,
        sessionToken: verificationState.sessionToken,
        verificationCode: verificationCode.trim(),
      });
      return api.startMarketInquiry({
        ...apiContext,
        sessionToken: verificationState.sessionToken,
      }, slug, {
        email: verificationState.email,
        message: verificationState.message,
      });
    },
    onSuccess: () => {
      setVerificationState(null);
      setVerificationCode("");
      setMessage("");
    },
  });

  const inquirySent = inquiryMutation.data?.status === "sent" || verificationMutation.isSuccess;
  const inquiryError = inquiryMutation.error ?? verificationMutation.error;

  return (
    <AppScreen>
      <WebPageHead title={TITLE} description={DESCRIPTION} />
      <ScreenToolbar title="Listing details" onBack={() => router.back()} />
      {listingQuery.isLoading ? (
        <SurfaceCard eyebrow="Loading" title="Opening listing" subtitle="Loading the marketplace item and inquiry form." />
      ) : listingQuery.isError || !listingQuery.data ? (
        <SurfaceCard eyebrow="Unavailable" title="This listing is not ready" subtitle={listingQuery.error instanceof Error ? listingQuery.error.message : "Try going back and refreshing the feed."}>
          <AppButton label="Try again" tone="secondary" onPress={() => void listingQuery.refetch()} loading={listingQuery.isFetching} />
        </SurfaceCard>
      ) : (
        <>
          <SurfaceCard eyebrow="Public listing" title={listingQuery.data.title} subtitle={`${listingQuery.data.price ? `$${listingQuery.data.price.toFixed(0)}` : "Free"} · ${listingQuery.data.locationLabel ?? "Pickup details not provided"}`}>
            <Text style={styles.bodyText}>{listingQuery.data.description}</Text>
            {listingQuery.data.photoUrls?.length ? (
              <ScrollView horizontal contentContainerStyle={styles.photoRow} showsHorizontalScrollIndicator={false}>
                {listingQuery.data.photoUrls.slice(0, 3).map((url) => (
                  <Image
                    accessibilityLabel={`Photo of ${listingQuery.data.title}`}
                    accessibilityRole="image"
                    contentFit="cover"
                    key={url}
                    source={{ uri: url }}
                    style={styles.photo}
                    transition={180}
                  />
                ))}
              </ScrollView>
            ) : null}
          </SurfaceCard>

          <SurfaceCard eyebrow="Marketplace inquiry" title="Record your interest" subtitle="Share your email and a short note. ListingOS records the verified inquiry for this marketplace demo.">
            <AppTextInput
              value={email}
              onChangeText={setEmail}
              accessibilityLabel="Your email"
              placeholder="Your email"
              placeholderTextColor={palette.textSoft}
              style={styles.input}
              selectionColor={palette.cyan}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              editable={!verificationState}
            />
            <AppTextInput
              value={message}
              onChangeText={setMessage}
              accessibilityLabel="Marketplace inquiry note"
              placeholder="I'm interested in this item."
              placeholderTextColor={palette.textSoft}
              style={[styles.input, styles.multilineInput]}
              selectionColor={palette.cyan}
              multiline
              editable={!verificationState}
            />
            {verificationState ? (
              <View style={styles.verificationPanel}>
                <Text selectable style={styles.verificationTitle}>Verify your email to record the inquiry</Text>
                <Text selectable style={styles.helperText}>
                  Enter the 6-digit verification code for {verificationState.email}. This demo gate keeps anonymous spam out of marketplace inquiries.
                </Text>
                <AppTextInput
                  accessibilityLabel="Six digit verification code"
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={setVerificationCode}
                  placeholder="6-digit code"
                  placeholderTextColor={palette.textSoft}
                  selectionColor={palette.cyan}
                  style={styles.input}
                  value={verificationCode}
                />
                <AppButton
                  disabled={!/^\d{6}$/.test(verificationCode.trim())}
                  label={verificationMutation.isPending ? "Verifying..." : "Verify and record inquiry"}
                  loading={verificationMutation.isPending}
                  onPress={() => verificationMutation.mutate()}
                />
                <AppButton
                  label="Restart verification"
                  tone="secondary"
                  onPress={() => {
                    setVerificationState(null);
                    setVerificationCode("");
                    inquiryMutation.reset();
                    verificationMutation.reset();
                  }}
                />
              </View>
            ) : (
              <AppButton
                disabled={!canSend}
                label={inquiryMutation.isPending ? "Recording..." : "Record inquiry"}
                onPress={() => inquiryMutation.mutate()}
                loading={inquiryMutation.isPending}
              />
            )}
            {inquiryError ? (
              <Text accessibilityLiveRegion="assertive" selectable style={styles.errorText}>
                {inquiryError instanceof Error ? inquiryError.message : "Your inquiry could not be recorded. Try again."}
              </Text>
            ) : null}
            {inquirySent ? (
              <Text style={styles.successText}>Inquiry recorded for this ListingOS marketplace demo.</Text>
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
    paddingRight: 8,
  },
  photo: {
    width: 220,
    aspectRatio: 1.1,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: palette.cardStrong,
    borderWidth: 1,
    borderColor: palette.border,
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
  errorText: {
    color: palette.rose,
    fontSize: 13,
    lineHeight: 20,
  },
  helperText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  verificationPanel: {
    gap: 12,
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardStrong,
    padding: 14,
  },
  verificationTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
  },
});
