import type { GenerateMetadataFunction } from "expo-router/server";

import { WebPageHead } from "@/components/web-page-head";
import { NotFoundScreen } from "@/screens/not-found-screen";

const TITLE = "Page not found | ListingOS";

export const generateMetadata: GenerateMetadataFunction = () => ({
  title: TITLE,
  robots: { index: false, follow: false },
});

export default function NotFoundRoute() {
  return (
    <>
      <WebPageHead title={TITLE} />
      <NotFoundScreen />
    </>
  );
}
