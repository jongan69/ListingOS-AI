import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { GenerateMetadataFunction } from "expo-router/server";

import { AppScreen } from "@/components/app-screen";
import { StoreWebsiteFooter } from "@/components/store-website-footer";
import { SurfaceCard } from "@/components/surface-card";
import { WebPageHead } from "@/components/web-page-head";
import { usePalette } from "@/theme/theme";

const TITLE = "ListingOS AI Terms";
const DESCRIPTION = "Core legal terms for AI-assisted listing drafting and manual eBay publishing.";

export const generateMetadata: GenerateMetadataFunction = () => ({
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
});

export default function TermsRoute() {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <>
      <WebPageHead title={TITLE} description={DESCRIPTION} indexable />
      <AppScreen>
        <SurfaceCard
          title="Terms"
          subtitle="AI-assisted drafting only; user confirms all final actions."
          eyebrow="ListingOS AI"
        >
          <Text selectable style={styles.sectionTitle}>What ListingOS provides</Text>
          <Text selectable style={styles.body}>
            ListingOS provides a workflow for:
          </Text>
          <Text selectable style={styles.list}>
            • photo capture and import
          </Text>
          <Text selectable style={styles.list}>
            • AI-generated title, description, category, and draft suggestions
          </Text>
          <Text selectable style={styles.list}>
            • readiness and blocker checks before publishing
          </Text>

          <Text selectable style={styles.sectionTitle}>Seller responsibility</Text>
          <Text selectable style={styles.body}>
            You remain responsible for final listing content and decisions, including:
          </Text>
          <Text selectable style={styles.list}>
            • choosing what to list and how to classify it
          </Text>
          <Text selectable style={styles.list}>
            • editing AI suggestions before publish
          </Text>
          <Text selectable style={styles.list}>
            • confirming price, terms, and fields required by your marketplace
          </Text>

          <Text selectable style={styles.sectionTitle}>Publishing scope</Text>
          <Text selectable style={styles.body}>
            The shipped flow publishes fixed-price eBay listings only after your review.
            ListingOS does not provide auction publishing in this release.
          </Text>

          <Text selectable style={styles.sectionTitle}>No guarantees</Text>
          <Text selectable style={styles.body}>
            ListingOS does not guarantee sales speed, ranking, buyer outcomes, or final listing performance.
            AI suggestions are recommendations; you can and should correct them before publish.
          </Text>

          <Text selectable style={styles.sectionTitle}>Important limits</Text>
          <Text selectable style={styles.body}>
            ListingOS is not affiliated with or endorsed by eBay.
            eBay terms, taxes, shipping obligations, and legal obligations remain seller responsibilities.
          </Text>
          <Text selectable style={styles.body}>
            Features not yet in this release are intentionally excluded from service terms and public promises.
          </Text>

          <View style={styles.noteContainer}>
            <Text selectable style={styles.noteTitle}>Safety note</Text>
            <Text selectable style={styles.body}>
              Publishing with production credentials can create live eBay listings.
            </Text>
          </View>
        </SurfaceCard>
        <StoreWebsiteFooter />
      </AppScreen>
    </>
  );
}

function createStyles(palette: { text: string; textMuted: string; gold: string }) {
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
      marginLeft: 4,
    },
    sectionTitle: {
      marginTop: 16,
      color: palette.text,
      fontSize: 18,
      fontWeight: "700",
    },
    noteContainer: {
      marginTop: 14,
      paddingTop: 8,
      paddingBottom: 8,
      borderTopWidth: 1,
      borderTopColor: palette.gold,
    },
    noteTitle: {
      color: palette.gold,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 4,
    },
  });
}
