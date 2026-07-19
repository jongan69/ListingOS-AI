import type { GenerateMetadataFunction } from "expo-router/server";

import { WebPageHead } from "@/components/web-page-head";
import { DashboardScreen } from "@/screens/dashboard-screen";

const TITLE = "ListingOS | Photos in. Listing out.";
const DESCRIPTION = "Camera-first AI listing workflow for eBay sellers.";

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
      <DashboardScreen />
    </>
  );
}
