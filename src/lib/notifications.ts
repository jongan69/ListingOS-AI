import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { appConfig } from "@/config/app";
import { api } from "@/lib/api";
import type { PushTokenRegistration } from "@/shared/contracts";

export type PublishNotificationPermissionState =
  | "authorized"
  | "provisional"
  | "denied"
  | "not-determined"
  | "not-available";

let notificationHandlerConfigured = false;

export function configurePublishNotificationHandling() {
  if (notificationHandlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  notificationHandlerConfigured = true;
}

export async function registerPublishNotifications(input: {
  apiBaseUrl: string;
  sessionToken: string | null;
  requestPermission?: boolean;
}) {
  if (Platform.OS === "web" || !input.sessionToken) {
    return { ok: false, reason: "not-available" as const, permissionState: "not-available" as const };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("publishing", {
      name: "Listing updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 140, 220],
      lightColor: "#66E1D1",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const existingState = notificationPermissionState(existing);
  const permissions = isNotificationPermissionUsable(existingState)
    ? existing
    : input.requestPermission === false
      ? null
      : await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
  const permissionState = permissions ? notificationPermissionState(permissions) : existingState;
  if (!isNotificationPermissionUsable(permissionState)) {
    return {
      ok: false,
      reason: permissionState === "denied" ? "permission-denied" as const : "permission-not-determined" as const,
      permissionState,
    };
  }

  const projectId = appConfig.easProjectId ?? Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return { ok: false, reason: "missing-project-id" as const, permissionState };

  let pushToken: Notifications.ExpoPushToken;
  try {
    pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  } catch (error) {
    if (isMissingNativePushConfigError(error)) {
      return { ok: false, reason: "push-native-config-missing" as const, permissionState };
    }
    throw error;
  }
  const payload: PushTokenRegistration = {
    token: pushToken.data,
    platform: platformName(),
    deviceName: Constants.deviceName ?? null,
  };
  await api.registerPushToken({
    apiBaseUrl: input.apiBaseUrl,
    sessionToken: input.sessionToken,
  }, payload);

  return { ok: true as const, permissionState };
}

export async function getPublishNotificationPermissionState(): Promise<PublishNotificationPermissionState> {
  if (Platform.OS === "web") return "not-available";
  return notificationPermissionState(await Notifications.getPermissionsAsync());
}

export function publishNotificationFailureMessage(reason: string) {
  if (reason === "permission-denied") return "Notifications are blocked for ListingOS. Enable them in system settings and try again.";
  if (reason === "permission-not-determined") return "Allow ListingOS notifications to receive completed-listing alerts while the app is closed.";
  if (reason === "not-available") return "Push alerts are only available in the native mobile app after sign-in.";
  if (reason === "push-native-config-missing") return "This build is missing native push credentials. Rebuild the app with FCM/APNs configured.";
  if (reason === "missing-project-id") return "This build is missing its EAS project id.";
  return "Push alerts are not connected yet.";
}

export function notificationFailureReason(error: unknown) {
  if (!error || typeof error !== "object" || !("notificationReason" in error)) return null;
  return typeof error.notificationReason === "string" ? error.notificationReason : null;
}

function notificationPermissionState(
  permissions: Notifications.NotificationPermissionsStatus,
): PublishNotificationPermissionState {
  if (Platform.OS !== "ios") {
    if (permissions.granted) return "authorized";
    return permissions.canAskAgain ? "not-determined" : "denied";
  }

  const status = permissions.ios?.status;
  if (status === Notifications.IosAuthorizationStatus.AUTHORIZED) return "authorized";
  if (
    status === Notifications.IosAuthorizationStatus.PROVISIONAL
    || status === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) return "provisional";
  if (status === Notifications.IosAuthorizationStatus.DENIED) return "denied";
  return "not-determined";
}

function isNotificationPermissionUsable(state: PublishNotificationPermissionState) {
  return state === "authorized" || state === "provisional";
}

function isMissingNativePushConfigError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /Firebase Messaging|googleServicesFile|GoogleService-Info|Default FirebaseApp|aps-environment|APNs entitlement/i.test(error.message);
}

function platformName(): PushTokenRegistration["platform"] {
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "web") return "web";
  return "unknown";
}
