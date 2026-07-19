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

export async function configureRevenueCat(appUserId?: string | null): Promise<RevenueCatState> {
  if (!nativeSupported) return emptyState("RevenueCat purchases are native-only on this build.", false);
  const apiKey = appConfig.revenueCatMode === "test"
    ? appConfig.revenueCatTestApiKey
    : Platform.OS === "ios" ? appConfig.revenueCatIosApiKey : appConfig.revenueCatAndroidApiKey;
  if (!apiKey) return emptyState("RevenueCat public SDK key is missing.", true);
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
    return {
      configured: true,
      appUserId: customerInfo.originalAppUserId,
      packages: selectedOffering?.availablePackages ?? [],
      activeEntitlements: activeRevenueCatEntitlements(customerInfo),
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
  await Purchases.restorePurchases();
  return loadRevenueCatState();
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
