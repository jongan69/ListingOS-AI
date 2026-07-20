const productionApiBaseUrl = "https://seller-ai-platform.jonathang132298.workers.dev";

function normalizeBaseUrl(value: string | undefined) {
  const normalized = value?.trim().replace(/\/$/, "");
  return normalized || productionApiBaseUrl;
}

function normalizeRevenueCatMode(value: string | undefined): "production" | "test" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "test" || normalized === "production") return normalized;
  return "production";
}

function normalizePublicSdkKey(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const appConfig = {
  apiBaseUrl: normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL),
  proofModeEnabled: process.env.EXPO_PUBLIC_PROOF_MODE?.trim() === "true",
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || null,
  revenueCatMode: normalizeRevenueCatMode(process.env.EXPO_PUBLIC_REVENUECAT_MODE),
  revenueCatTestApiKey: normalizePublicSdkKey(process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY),
  revenueCatIosApiKey: normalizePublicSdkKey(process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY),
  revenueCatAndroidApiKey: normalizePublicSdkKey(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY),
  revenueCatProdApiKey: normalizePublicSdkKey(process.env.EXPO_PUBLIC_REVENUECAT_PROD_API_KEY),
  revenueCatOfferingId: process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID?.trim() || "default",
  apiTimeoutMs: 30_000,
  defaultMarketplaceId: "EBAY_US",
  maxPhotosPerSelection: 24,
  uploadConcurrency: 4,
} as const;
