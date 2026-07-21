import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import type { GenerateMetadataFunction } from "expo-router/server";

import { AppScreen } from "@/components/app-screen";
import { StoreWebsiteFooter } from "@/components/store-website-footer";
import { SurfaceCard } from "@/components/surface-card";
import { WebPageHead } from "@/components/web-page-head";
import { usePalette } from "@/theme/theme";

const TITLE = "Delete Your ListingOS Data";
const DESCRIPTION =
  "Instructions for requesting deletion of your ListingOS account data, uploaded photos, drafts, and related records.";

export const generateMetadata: GenerateMetadataFunction = () => ({
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
});

export default function DataDeletionRoute() {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <>
      <WebPageHead title={TITLE} description={DESCRIPTION} indexable />
      <AppScreen>
        <SurfaceCard
          title="Delete your data"
          subtitle="Request permanent deletion of data associated with your ListingOS use."
          eyebrow="ListingOS AI"
        >
          <Text selectable style={styles.sectionTitle}>
            How to request deletion
          </Text>
          <Text selectable style={styles.body}>
            Open a ListingOS support request from the email address associated
            with your account. Use the subject “Delete my ListingOS data” and
            include enough information for us to locate the correct records.
          </Text>
          <Text selectable style={styles.list}>
            • Your eBay seller account name, if available
          </Text>
          <Text selectable style={styles.list}>
            • The email address associated with your ListingOS use
          </Text>
          <Text selectable style={styles.list}>
            • Relevant batch, draft, job, or listing IDs, if available
          </Text>
          <Text selectable style={styles.list}>
            • The approximate dates when you used ListingOS
          </Text>
          <Text selectable style={styles.warning}>
            Do not send your eBay password, OAuth tokens, private keys, or other
            account secrets.
          </Text>

          <Text selectable style={styles.sectionTitle}>
            Verification
          </Text>
          <Text selectable style={styles.body}>
            We may ask you to verify that you control the account or email
            address connected to the request. This helps prevent another person
            from deleting your data without permission.
          </Text>

          <Text selectable style={styles.sectionTitle}>
            Data covered by the request
          </Text>
          <Text selectable style={styles.body}>
            Once the request is verified, ListingOS will identify and delete
            data associated with your account where applicable, including:
          </Text>
          <Text selectable style={styles.list}>
            • Product photos stored for generation and publishing workflows
          </Text>
          <Text selectable style={styles.list}>
            • Listing drafts and AI-generated listing recommendations
          </Text>
          <Text selectable style={styles.list}>
            • Processing jobs, batches, and readiness-check records
          </Text>
          <Text selectable style={styles.list}>
            • Publish attempts and ListingOS listing references
          </Text>
          <Text selectable style={styles.list}>
            • OAuth state, session cache, and related connection metadata
          </Text>

          <Text selectable style={styles.sectionTitle}>
            What deletion does not do
          </Text>
          <Text selectable style={styles.body}>
            Deleting ListingOS data does not automatically revise, end, or
            delete listings that have already been published to eBay. Existing
            marketplace listings must be managed through your eBay seller
            account.
          </Text>
          <Text selectable style={styles.body}>
            Disconnecting ListingOS from eBay is also separate from deleting
            your ListingOS records. You can revoke the application’s access
            through your eBay account settings.
          </Text>

          <Text selectable style={styles.sectionTitle}>
            Limited retention
          </Text>
          <Text selectable style={styles.body}>
            Certain records may be retained when reasonably necessary for
            security, fraud prevention, dispute resolution, legal compliance,
            or enforcement of applicable agreements. Records held in backup
            systems may remain until those backups are securely rotated or
            deleted.
          </Text>

          <Text selectable style={styles.sectionTitle}>
            After you submit a request
          </Text>
          <Text selectable style={styles.body}>
            We will confirm receipt, complete any necessary verification, and
            provide the expected deletion timeline. We will notify you when the
            request has been completed or explain any data that cannot be
            deleted and the reason it must be retained.
          </Text>

          <Text selectable style={styles.sectionTitle}>
            Frequently asked questions
          </Text>

          <Text selectable style={styles.faqQuestion}>
            Is deletion permanent?
          </Text>
          <Text selectable style={styles.body}>
            Yes. Deleted photos, drafts, jobs, and related ListingOS records may
            not be recoverable.
          </Text>

          <Text selectable style={styles.faqQuestion}>
            Can I delete only certain photos or drafts?
          </Text>
          <Text selectable style={styles.body}>
            Include the relevant batch, draft, job, or listing IDs in your
            support request and describe which records you want removed.
          </Text>

          <Text selectable style={styles.faqQuestion}>
            Will deleting my data cancel a live eBay listing?
          </Text>
          <Text selectable style={styles.body}>
            No. Live listings and other data held by eBay are controlled through
            your eBay seller account and are subject to eBay’s own policies.
          </Text>

          <Text selectable style={styles.faqQuestion}>
            Should I send my eBay credentials?
          </Text>
          <Text selectable style={styles.body}>
            No. ListingOS support will never need your eBay password, OAuth
            token, private key, or other seller-account secret to process a
            deletion request.
          </Text>
        </SurfaceCard>
        <StoreWebsiteFooter />
      </AppScreen>
    </>
  );
}

function createStyles(palette: {
  textMuted: string;
  text: string;
  red: string;
  gold: string;
}) {
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
      marginTop: 10,
    },
  });
}