import * as Haptics from "expo-haptics";

export async function tapHaptic() {
  if (process.env.EXPO_OS === "web") return;
  await Haptics.selectionAsync().catch(() => undefined);
}

export async function confirmHaptic() {
  if (process.env.EXPO_OS === "web") return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export async function errorHaptic() {
  if (process.env.EXPO_OS === "web") return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}

export function splashHaptic() {
  if (process.env.EXPO_OS === "web") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}
