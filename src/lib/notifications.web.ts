export type PublishNotificationPermissionState = "not-available";

export async function registerPublishNotifications(_input: {
  apiBaseUrl: string;
  sessionToken: string | null;
}) {
  return {
    ok: false,
    reason: "not-available" as const,
    permissionState: "not-available" as const,
  };
}

export async function getPublishNotificationPermissionState(): Promise<PublishNotificationPermissionState> {
  return "not-available";
}

export function publishNotificationFailureMessage() {
  return "Push alerts are only available in the native mobile app after sign-in.";
}

export function notificationFailureReason() {
  return null;
}
