import type { GenerateMetadataFunction } from "expo-router/server";

import { WebPageHead } from "@/components/web-page-head";
import { BatchDetailScreen } from "@/screens/batch-detail-screen";

const TITLE = "Draft Queue | ListingOS";
const DESCRIPTION = "Review the processing status of a ListingOS photo batch.";

export const generateMetadata: GenerateMetadataFunction = () => ({
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
});

export default function BatchRoute() {
  return (
    <>
      <WebPageHead title={TITLE} description={DESCRIPTION} />
      <BatchDetailScreen />
    </>
  );
}
