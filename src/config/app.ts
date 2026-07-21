import { proofModeBuildEnabled } from "@/config/proof-mode-build";

const productionApiBaseUrl = "https://seller-ai-platform.jonathang132298.workers.dev";
const webPurchasePlanIds = ["starter", "pro", "studio"] as const;

type RevenueCatPurchaseTerm = "monthly" | "annual";
type RevenueCatPlanId = (typeof webPurchasePlanIds)[number];

export type RevenueCatWebPurchaseLink = {
  [term in RevenueCatPurchaseTerm]?: string;
};

export type RevenueCatWebPurchaseLinks = Partial<Record<RevenueCatPlanId, RevenueCatWebPurchaseLink>>;

function parseRevenueCatWebPurchaseLink(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    return String(new URL(trimmed));
  } catch {
    return;
  }
}

function normalizeRevenueCatWebPurchaseLinks(value: string | undefined): RevenueCatWebPurchaseLinks {
  const raw = value?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const normalized: RevenueCatWebPurchaseLinks = {};
    for (const plan of webPurchasePlanIds) {
      const planBlock = parsed[plan];
      if (typeof planBlock !== "object" || planBlock === null) continue;
      const monthly = parseRevenueCatWebPurchaseLink((planBlock as Record<string, unknown>).monthly);
      const annual = parseRevenueCatWebPurchaseLink((planBlock as Record<string, unknown>).annual);
      if (monthly || annual) {
        normalized[plan] = {
          ...(monthly ? { monthly } : {}),
          ...(annual ? { annual } : {}),
        };
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

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
  proofModeEnabled: proofModeBuildEnabled,
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || null,
  revenueCatMode: normalizeRevenueCatMode(process.env.EXPO_PUBLIC_REVENUECAT_MODE),
  revenueCatTestApiKey: normalizePublicSdkKey(process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY),
  revenueCatIosApiKey: normalizePublicSdkKey(process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY),
  revenueCatAndroidApiKey: normalizePublicSdkKey(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY),
  revenueCatProdApiKey: normalizePublicSdkKey(process.env.EXPO_PUBLIC_REVENUECAT_PROD_API_KEY),
  revenueCatWebApiKey: normalizePublicSdkKey(process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY),
  revenueCatOfferingId: process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID?.trim() || "default",
  // Test Store keys normally only run in __DEV__. Internal/preview builds used for
  // demos are release builds, so this flag opts them in explicitly. Never set it
  // on the production profile.
  revenueCatAllowTestStoreInRelease:
    process.env.EXPO_PUBLIC_REVENUECAT_ALLOW_TEST_STORE_IN_RELEASE?.trim() === "true",
  revenueCatWebPurchaseLinks: normalizeRevenueCatWebPurchaseLinks(process.env.EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS),
  apiTimeoutMs: 30_000,
  defaultMarketplaceId: "EBAY_US",
  maxPhotosPerSelection: 24,
  uploadConcurrency: 4,
} as const;
