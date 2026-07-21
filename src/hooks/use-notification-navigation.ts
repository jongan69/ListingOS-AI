import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";

import { configurePublishNotificationHandling } from "@/lib/notifications";

const handledNotificationIds = new Set<string>();

export function useNotificationNavigation() {
  useEffect(() => {
    configurePublishNotificationHandling();

    function openNotification(notification: Notifications.Notification) {
      const identifier = notification.request.identifier;
      if (handledNotificationIds.has(identifier)) return;

      const data = notification.request.content.data;
      const draftId = stringValue(data?.draftId);
      const batchId = stringValue(data?.batchId);
      if (!draftId && !batchId) return;

      handledNotificationIds.add(identifier);
      router.push(draftId
        ? `/drafts/${encodeURIComponent(draftId)}`
        : `/batches/${encodeURIComponent(batchId)}`);
    }

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification) openNotification(lastResponse.notification);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotification(response.notification);
    });
    return () => subscription.remove();
  }, []);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
