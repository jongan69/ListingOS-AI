import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_TOKEN_KEY = "seller-ai.session-token";
const LAST_BATCH_ID_KEY = "seller-ai:last-batch-id";
const HIDDEN_QUEUE_BATCH_IDS_KEY = "seller-ai:hidden-queue-batch-ids";
export const THEME_PREFERENCE_KEY = "seller-ai:theme-preference";

export async function getSessionToken() {
  if (Platform.OS === "web") {
    return getWebStorage()?.getItem(SESSION_TOKEN_KEY) ?? null;
  }
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export async function setSessionToken(value: string) {
  if (Platform.OS === "web") {
    getWebStorage()?.setItem(SESSION_TOKEN_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, value);
}

export async function clearSessionToken() {
  if (Platform.OS === "web") {
    getWebStorage()?.removeItem(SESSION_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}

export async function getLastBatchId() {
  return AsyncStorage.getItem(LAST_BATCH_ID_KEY);
}

export async function setLastBatchId(value: string) {
  await AsyncStorage.setItem(LAST_BATCH_ID_KEY, value);
}

export async function getHiddenQueueBatchIds() {
  const raw = await AsyncStorage.getItem(HIDDEN_QUEUE_BATCH_IDS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export async function setHiddenQueueBatchIds(values: string[]) {
  const uniqueValues = Array.from(new Set(values)).slice(0, 200);
  await AsyncStorage.setItem(HIDDEN_QUEUE_BATCH_IDS_KEY, JSON.stringify(uniqueValues));
}

export async function getThemePreference() {
  if (Platform.OS === "web") {
    const raw = getWebStorage()?.getItem(THEME_PREFERENCE_KEY) ?? null;
    return normalizeThemePreference(raw);
  }

  const raw = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
  return normalizeThemePreference(raw);
}

export async function setThemePreference(value: "light" | "dark") {
  if (Platform.OS === "web") {
    getWebStorage()?.setItem(THEME_PREFERENCE_KEY, value);
    return;
  }

  await AsyncStorage.setItem(THEME_PREFERENCE_KEY, value);
}

function normalizeThemePreference(raw: string | null) {
  return raw === "light" || raw === "dark" ? raw : null;
}

function getWebStorage() {
  // Native defines `window` without `localStorage`, so check the platform.
  // Every caller already guards on Platform.OS === "web"; this is defence in
  // depth so a future caller cannot reintroduce a native crash here.
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
