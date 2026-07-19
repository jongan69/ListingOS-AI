const productionApiBaseUrl = "https://seller-ai-platform.jonathang132298.workers.dev";

function normalizeBaseUrl(value: string | undefined) {
  const normalized = value?.trim().replace(/\/$/, "");
  return normalized || productionApiBaseUrl;
}

export const appConfig = {
  apiBaseUrl: normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL),
  proofModeEnabled: process.env.EXPO_PUBLIC_PROOF_MODE?.trim() === "true",
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || null,
  revenueCatMode: process.env.EXPO_PUBLIC_REVENUECAT_MODE?.trim() || "production",
  revenueCatTestApiKey: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.trim() || null,
  revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || null,
  revenueCatAndroidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || null,
  revenueCatOfferingId: process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID?.trim() || "default",
  apiTimeoutMs: 30_000,
  defaultMarketplaceId: "EBAY_US",
  maxPhotosPerSelection: 24,
  uploadConcurrency: 4,
} as const;
