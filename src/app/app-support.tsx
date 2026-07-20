import { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import type { GenerateMetadataFunction } from "expo-router/server";

import { AppScreen } from "@/components/app-screen";
import { StoreWebsiteFooter } from "@/components/store-website-footer";
import { SurfaceCard } from "@/components/surface-card";
import { WebPageHead } from "@/components/web-page-head";
import { usePalette } from "@/theme/theme";

const SUPPORT_FORM = "https://github.com/jongan69/ListingOS-AI/issues/new/choose";

const TITLE = "ListingOS AI Support";
const DESCRIPTION = "Support for listing capture, review, and fixed-price publish help for eBay sellers.";

export const generateMetadata: GenerateMetadataFunction = () => ({
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
});

export default function AppSupportRoute() {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <>
      <WebPageHead title={TITLE} description={DESCRIPTION} indexable />
      <AppScreen>
        <SurfaceCard title="Support for ListingOS AI" subtitle="Capture, draft, review, and publish help for real workflows.">
          <Text selectable style={styles.section}>
            ListingOS is a production-facing mobile workflow for eBay sellers.
            It supports camera-first capture, AI-assisted draft generation, one-screen review, and manual fixed-price publishing.
          </Text>

          <Text selectable style={styles.sectionTitle}>Contact methods</Text>
          <Text selectable style={styles.body}>
            Start with the support issue form:
          </Text>
          <Pressable onPress={() => void Linking.openURL(SUPPORT_FORM)}>
            <Text selectable style={styles.link}>
              Open support issue form
            </Text>
          </Pressable>
          <Text selectable style={styles.body}>
            If you submit from a public place, do not include private secrets.
            Provide: version/build, device model, install source, timestamps, and the last 5 steps before failure.
          </Text>

          <Text selectable style={styles.sectionTitle}>What support covers</Text>
          <Text selectable style={styles.body}>
            We assist with:
          </Text>
          <Text selectable style={styles.list}>
            • Photo capture and import behavior (camera, gallery, and iCloud/provider edge cases)
          </Text>
          <Text selectable style={styles.list}>
            • AI draft generation, confidence cues, and block detection
          </Text>
          <Text selectable style={styles.list}>
            • Queue flow, policy blockers, and readiness checks
          </Text>
          <Text selectable style={styles.list}>
            • Publishing attempts and reconnecting an expired eBay sign-in
          </Text>

          <Text selectable style={styles.sectionTitle}>Report a bug</Text>
          <Text selectable style={styles.body}>
            Include this exact checklist in your request:
          </Text>
          <Text selectable style={styles.list}>
            1) What action you started
          </Text>
          <Text selectable style={styles.list}>
            2) What changed before the issue
          </Text>
          <Text selectable style={styles.list}>
            3) The error message and step where it appeared
          </Text>
          <Text selectable style={styles.list}>
            4) Screenshots or short recording of the flow
          </Text>

          <Text selectable style={styles.sectionTitle}>Need help publishing</Text>
          <Text selectable style={styles.body}>
            Publishing is seller-confirmed and happens only after manual review on the publish screen.
            You remain responsible for final title, category, description, condition details, and price.
            The current production release supports fixed-price eBay publishing only.
          </Text>
          <Text selectable style={styles.warning}>
            Publishing with production credentials can create live eBay listings.
          </Text>
          <Text selectable style={styles.body}>
            If you are validating behavior only, test with sandbox credentials and clearly note it in the report.
          </Text>

          <Text selectable style={styles.sectionTitle}>How to find ListingOS in the store</Text>
          <Text selectable style={styles.body}>
            App Store name: ListingOS AI.
          </Text>
          <Text selectable style={styles.body}>
            Public tagline: AI listings from product photos.
          </Text>
        </SurfaceCard>
        <StoreWebsiteFooter />
      </AppScreen>
    </>
  );
}

function createStyles(palette: { textMuted: string; text: string; cyan: string }) {
  return StyleSheet.create({
    body: {
      color: palette.textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    link: {
      color: palette.cyan,
      fontSize: 14,
      lineHeight: 22,
      textDecorationLine: "underline",
      marginBottom: 8,
    },
    list: {
      color: palette.text,
      fontSize: 14,
      lineHeight: 22,
      marginLeft: 4,
    },
    section: {
      color: palette.text,
      fontSize: 15,
      lineHeight: 24,
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 17,
      fontWeight: "700",
      marginTop: 16,
    },
    warning: {
      color: palette.cyan,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 8,
      lineHeight: 22,
    },
  });
}
