import { Platform } from "react-native";

import { appConfig } from "@/config/app";
import { revenueCatEntitlements } from "@/config/billing";
import type { BillingSyncRequest } from "@/shared/contracts";

type PurchasesPackage = {
  identifier: string;
  product: {
    identifier: string;
    title: string;
    description: string;
    price: number;
    priceString: string;
  };
};

type RevenueCatKeyContext = {
  apiKey: string | null;
  source: "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY" | "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY" | "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY" | "EXPO_PUBLIC_REVENUECAT_PROD_API_KEY";
  expectedPrefix: string;
  platform: "test" | "ios" | "android";
};

type RevenueCatState = {
  configured: boolean;
  appUserId: string | null;
  packages: PurchasesPackage[];
  activeEntitlements: string[];
  managementUrl: string | null;
  errorMessage: string | null;
  platformSupported: boolean;
};

const nativeSupported = Platform.OS === "ios" || Platform.OS === "android";
let configurePromise: Promise<RevenueCatState> | null = null;
let currentAppUserId: string | null = null;

function resolveRevenueCatApiKey(): RevenueCatKeyContext {
  if (appConfig.revenueCatMode === "test") {
    return {
      apiKey: appConfig.revenueCatTestApiKey,
      source: "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY",
      expectedPrefix: "test_",
      platform: "test",
    };
  }

  const isIos = Platform.OS === "ios";
  const platform = isIos ? "ios" : "android";
  const expectedPrefix = isIos ? "appl_" : "goog_";
  const platformKey = isIos ? appConfig.revenueCatIosApiKey : appConfig.revenueCatAndroidApiKey;
  const platformSource = isIos
    ? "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY"
    : "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY";
  const platformApiKey = platformKey || appConfig.revenueCatProdApiKey;
  const platformApiSource = platformKey
    ? platformSource
    : appConfig.revenueCatProdApiKey
      ? "EXPO_PUBLIC_REVENUECAT_PROD_API_KEY"
      : platformSource;

  return {
    apiKey: platformApiKey,
    source: platformApiSource,
    expectedPrefix,
    platform,
  };
}

function logRevenueCatDiagnostics(context: RevenueCatKeyContext, appUserId?: string | null): void {
  const rawAppUserId = appUserId ? appUserId.replace(/^seller:/, "") : null;
  const maskedAppUserId = rawAppUserId ? `seller:${rawAppUserId.slice(0, 4)}...` : "unset";
  const keyState = context.apiKey ? "set" : "missing";
  const keyPrefix = context.apiKey?.slice(0, 7) ?? "n/a";
  const maskedKey = context.apiKey ? `${context.apiKey.slice(0, 8)}...${context.apiKey.slice(-4)}` : "missing";
  // Log intentionally avoids exposing full SDK keys.
  console.log(
    `[RevenueCat] mode=${appConfig.revenueCatMode} platform=${context.platform} keySource=${context.source} ` +
      `expectedPrefix=${context.expectedPrefix} prefix=${keyPrefix} keyState=${keyState} key=${maskedKey} offering=${appConfig.revenueCatOfferingId} appUserId=${maskedAppUserId}`,
  );
}

function isValidApiKeyPrefix(apiKey: string | null, expectedPrefix: string): apiKey is string {
  return Boolean(apiKey && apiKey.startsWith(expectedPrefix));
}

export async function configureRevenueCat(appUserId?: string | null): Promise<RevenueCatState> {
  if (!nativeSupported) return emptyState("RevenueCat purchases are native-only on this build.", false);
  const resolvedKey = resolveRevenueCatApiKey();
  const apiKey = resolvedKey.apiKey;
  logRevenueCatDiagnostics(resolvedKey, appUserId);
  if (!apiKey) {
    const errorMessage = resolvedKey.platform === "test"
      ? "RevenueCat public test SDK key is missing. Set EXPO_PUBLIC_REVENUECAT_TEST_API_KEY."
      : `RevenueCat production key is missing. Set ${resolvedKey.source}.`;
    return emptyState(errorMessage, true);
  }
  if (appConfig.revenueCatMode === "test" && !isValidApiKeyPrefix(apiKey, resolvedKey.expectedPrefix)) {
    return emptyState(
      `RevenueCat test key format is invalid for ${resolvedKey.source}. Test keys should use test_* prefix.`,
      true,
    );
  }
  if (
    appConfig.revenueCatMode === "production"
    && (resolvedKey.platform === "test" || !isValidApiKeyPrefix(apiKey, resolvedKey.expectedPrefix))
  ) {
    return emptyState(
      resolvedKey.platform === "ios"
        ? "RevenueCat production iOS key format is invalid. Use an appl_... public iOS key."
        : "RevenueCat production Android key format is invalid. Use a goog_... public Android key.",
      true,
    );
  }
  // Test Store keys are only valid in development builds. A production build
  // must use the platform's appl_... key, even for an internal discount offer.
  if (appConfig.revenueCatMode === "test" && !__DEV__) {
    return emptyState("RevenueCat Test Store mode is disabled outside development builds.", true);
  }
  if (!configurePromise) {
    configurePromise = (async () => {
      const { default: Purchases, LOG_LEVEL } = await import("react-native-purchases");
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey });
      return loadRevenueCatState();
    })().catch((error) => ({
      ...emptyState(error instanceof Error ? error.message : "RevenueCat could not initialize.", true),
      configured: false,
    }));
  }
  const state = await configurePromise;
  if (!state.configured) return state;
  if (appUserId && appUserId !== currentAppUserId) {
    currentAppUserId = appUserId;
    try {
      const { default: Purchases } = await import("react-native-purchases");
      await Purchases.logIn(appUserId);
    } catch (error) {
      return {
        ...state,
        errorMessage: error instanceof Error ? error.message : "RevenueCat sign-in sync failed.",
      };
    }
  }
  return loadRevenueCatState();
}

export async function loadRevenueCatState(): Promise<RevenueCatState> {
  if (!nativeSupported) return emptyState("RevenueCat purchases are native-only on this build.", false);
  try {
    const { default: Purchases } = await import("react-native-purchases");
    const [customerInfo, offerings] = await Promise.all([
      Purchases.getCustomerInfo(),
      Purchases.getOfferings().catch(() => null),
    ]);
    const requestedOfferingId = appConfig.revenueCatOfferingId;
    const offeringsRecord = offerings as { current?: { availablePackages?: PurchasesPackage[] } | null; all?: Record<string, { availablePackages?: PurchasesPackage[] }> } | null;
    const selectedOffering = requestedOfferingId === "default"
      ? offeringsRecord?.current
      : offeringsRecord?.all?.[requestedOfferingId] ?? null;
    const offeringError = requestedOfferingId !== "default" && !selectedOffering
      ? `RevenueCat offering "${requestedOfferingId}" is not available for this app/user.`
      : null;
    const activeEntitlements = activeRevenueCatEntitlements(customerInfo);
    const offeringIds = Object.keys(offeringsRecord?.all ?? {});
    const packageIds = (selectedOffering?.availablePackages ?? []).map((pkg) => pkg.identifier);
    const debugEntitlements = activeEntitlements.length > 0 ? activeEntitlements.join(",") : "none";
    console.log(
      `[RevenueCat] customerInfo entitlements offerings=${offeringIds.join(",") || "none"} offering=${requestedOfferingId} ` +
        `count=${selectedOffering?.availablePackages?.length ?? 0} packages=${packageIds.join(",") || "none"} activeEntitlements=${debugEntitlements}`,
    );
    return {
      configured: true,
      appUserId: customerInfo.originalAppUserId,
      packages: selectedOffering?.availablePackages ?? [],
      activeEntitlements,
      managementUrl: customerInfo.managementURL ?? null,
      errorMessage: offeringError,
      platformSupported: true,
    };
  } catch (error) {
    return {
      ...emptyState(error instanceof Error ? error.message : "RevenueCat state is unavailable.", true),
      configured: Boolean(configurePromise),
    };
  }
}

export async function purchaseRevenueCatPackage(pkg: PurchasesPackage) {
  const { default: Purchases } = await import("react-native-purchases");
  try {
    await Purchases.purchasePackage(pkg as never);
    return { status: "purchased" as const, state: await loadRevenueCatState() };
  } catch (error: unknown) {
    if (typeof error === "object" && error && "userCancelled" in error && error.userCancelled === true) {
      return { status: "canceled" as const, state: await loadRevenueCatState() };
    }
    return {
      status: "failed" as const,
      state: await loadRevenueCatState(),
      errorMessage: error instanceof Error ? error.message : "Purchase failed.",
    };
  }
}

export async function restoreRevenueCatPurchases() {
  const { default: Purchases } = await import("react-native-purchases");
  console.log("[RevenueCat] restorePurchases.start");
  try {
    await Purchases.restorePurchases();
    const state = await loadRevenueCatState();
    console.log(
      `[RevenueCat] restorePurchases.success appUserId=${state.appUserId ?? "unset"} packages=${state.packages.length} active=${state.activeEntitlements.join(",") || "none"}`,
    );
    return state;
  } catch (error) {
    console.log("[RevenueCat] restorePurchases.failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function signOutRevenueCat() {
  if (!nativeSupported || !configurePromise) return;
  try {
    const { default: Purchases } = await import("react-native-purchases");
    const customerInfo = await Purchases.getCustomerInfo();
    if (!customerInfo.originalAppUserId.startsWith("$RCAnonymousID:")) {
      await Purchases.logOut();
    }
    currentAppUserId = null;
  } catch {
    currentAppUserId = null;
  }
}

export function revenueCatStateToSyncRequest(state: RevenueCatState, fallbackAppUserId: string): BillingSyncRequest {
  return {
    appUserId: state.appUserId ?? fallbackAppUserId,
    source: state.configured ? "revenuecat_sdk" : "fallback",
    activeEntitlements: state.activeEntitlements,
    allEntitlements: {},
    subscriptionStatus: state.activeEntitlements.length > 0 ? "active" : "free",
    managementUrl: state.managementUrl,
    customerInfo: {
      appUserId: state.appUserId,
      activeEntitlements: state.activeEntitlements,
      packageCount: state.packages.length,
      errorMessage: state.errorMessage,
    },
  };
}

function activeRevenueCatEntitlements(customerInfo: unknown) {
  const active = (customerInfo as { entitlements?: { active?: Record<string, unknown> } }).entitlements?.active ?? {};
  return revenueCatEntitlements.filter((id) => Object.prototype.hasOwnProperty.call(active, id));
}

function emptyState(errorMessage: string | null, platformSupported: boolean): RevenueCatState {
  return {
    configured: false,
    appUserId: null,
    packages: [],
    activeEntitlements: [],
    managementUrl: null,
    errorMessage,
    platformSupported,
  };
}

export type { PurchasesPackage, RevenueCatState };
