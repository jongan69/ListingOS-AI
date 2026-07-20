import type { GenerateMetadataFunction } from "expo-router/server";

import { StoreWebsiteFooter } from "@/components/store-website-footer";
import { WebPageHead } from "@/components/web-page-head";
import { DashboardScreen } from "@/screens/dashboard-screen";

const TITLE = "ListingOS | Photos in. Listing out.";
const DESCRIPTION = "Capture photos, get an AI draft, review proof and blockers, then publish fixed-price eBay listings from one screen.";

export const generateMetadata: GenerateMetadataFunction = () => ({
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "ListingOS",
  referrer: "strict-origin-when-cross-origin",
  robots: { index: false, follow: false },
});

export default function IndexRoute() {
  return (
    <>
      <WebPageHead title={TITLE} description={DESCRIPTION} />
      <DashboardScreen footer={<StoreWebsiteFooter />} />
    </>
  );
}
