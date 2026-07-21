import { Redirect, useLocalSearchParams } from "expo-router";
import type { GenerateMetadataFunction } from "expo-router/server";

import { WebPageHead } from "@/components/web-page-head";
import { appConfig } from "@/config/app";
import { getProofScenario } from "@/lib/proof-mode";
import { DraftDetailScreen } from "@/screens/draft-detail-screen";

const TITLE = "Draft Review | ListingOS";
const DESCRIPTION = "Review listing evidence, required fixes, pricing, and publish status in ListingOS.";

export const generateMetadata: GenerateMetadataFunction = () => ({
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
});

export default function DraftRoute() {
  const params = useLocalSearchParams<{ "draft-id": string }>();
  const draftId = params["draft-id"];

  if (appConfig.proofModeEnabled && !getProofScenario(draftId)) {
    return <Redirect href="/" />;
  }

  return (
    <>
      <WebPageHead title={TITLE} description={DESCRIPTION} />
      <DraftDetailScreen key={draftId} />
    </>
  );
}
