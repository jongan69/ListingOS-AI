import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import type { GenerateMetadataFunction } from "expo-router/server";

import { AppScreen } from "@/components/app-screen";
import { StoreWebsiteFooter } from "@/components/store-website-footer";
import { SurfaceCard } from "@/components/surface-card";
import { WebPageHead } from "@/components/web-page-head";
import { usePalette } from "@/theme/theme";

const TITLE = "ListingOS Privacy";
const DESCRIPTION = "Plain-language privacy policy and technical data handling summary for ListingOS users.";

export const generateMetadata: GenerateMetadataFunction = () => ({
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
});

export default function PrivacyRoute() {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <>
      <WebPageHead title={TITLE} description={DESCRIPTION} indexable />
      <AppScreen>
        <SurfaceCard
          title="Privacy"
          subtitle="What ListingOS stores, uses, and shares."
          eyebrow="ListingOS AI"
        >
          <Text selectable style={styles.sectionTitle}>Data used</Text>
          <Text selectable style={styles.body}>
            ListingOS is a camera-first AI listing tool.
          </Text>
          <Text selectable style={styles.list}>
            • eBay account authorization through OAuth
          </Text>
          <Text selectable style={styles.list}>
            • Product photos you choose to upload
          </Text>
          <Text selectable style={styles.list}>
            • Draft data generated from those photos
          </Text>
          <Text selectable style={styles.list}>
            • Readiness and policy data needed to guide publish checks
          </Text>

          <Text selectable style={styles.sectionTitle}>Storage</Text>
          <Text selectable style={styles.body}>
            The Worker stores data in cloud services to support queueing, drafts, and publish operations:
          </Text>
          <Text selectable style={styles.list}>
            • Photos are uploaded to Cloudflare R2 for generation and publish workflows.
          </Text>
          <Text selectable style={styles.list}>
            • Drafts, jobs, publish attempts, and listing references are stored in Cloudflare D1.
          </Text>
          <Text selectable style={styles.list}>
            • OAuth state and short-lived session cache are stored in Cloudflare KV.
          </Text>
          <Text selectable style={styles.body}>
            We do not store OAuth tokens, private keys, or seller secrets in app UI fields.
          </Text>

          <Text selectable style={styles.sectionTitle}>AI and technical processing</Text>
          <Text selectable style={styles.body}>
            Product photos and marketplace context are sent to the OpenAI Responses API for structured listing recommendations.
            The Worker validates generated output against schema rules and marketplace checks before persistence.
          </Text>

          <Text selectable style={styles.sectionTitle}>Publishing safety notice</Text>
          <Text selectable style={styles.warning}>
            Publishing with production credentials can create live eBay listings.
          </Text>
          <Text selectable style={styles.body}>
            Do not run production credentials against test data if you are only validating behavior.
          </Text>

          <Text selectable style={styles.sectionTitle}>Data requests and contact</Text>
          <Text selectable style={styles.body}>
            If you need help with data deletion, retention context, or privacy questions:
          </Text>
          <Text selectable style={styles.faqQuestion}>What personal data is kept?</Text>
          <Text selectable style={styles.body}>
            We keep only what is needed to complete drafting, review, and publish operations for your seller account.
          </Text>
          <Text selectable style={styles.faqQuestion}>How do I request review of my records?</Text>
          <Text selectable style={styles.body}>
            Open a support request and include your seller account name (if available), batch IDs, and time window.
          </Text>
          <Text selectable style={styles.faqQuestion}>Does ListingOS see my eBay password?</Text>
          <Text selectable style={styles.body}>
            No. eBay OAuth is handled through the platform identity flow. ListingOS does not ask for passwords.
          </Text>
        </SurfaceCard>
        <StoreWebsiteFooter />
      </AppScreen>
    </>
  );
}

function createStyles(palette: { textMuted: string; text: string; red: string; gold: string }) {
  return StyleSheet.create({
    body: {
      color: palette.textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    list: {
      color: palette.text,
      fontSize: 14,
      lineHeight: 22,
    },
    sectionTitle: {
      marginTop: 18,
      color: palette.text,
      fontSize: 18,
      fontWeight: "700",
    },
    faqQuestion: {
      color: palette.gold,
      fontSize: 14,
      fontWeight: "700",
      marginTop: 10,
    },
    warning: {
      color: palette.red,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 22,
    },
  });
}
