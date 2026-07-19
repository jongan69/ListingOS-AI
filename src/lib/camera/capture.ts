import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library/legacy";
import { Platform } from "react-native";

import type { CaptureSource } from "@/shared/contracts";
import { appConfig } from "@/config/app";

type CaptureMode = CaptureSource;

export type CameraCaptureResult = {
  assets: ImagePicker.ImagePickerAsset[];
  source: CaptureMode;
  sourceLabel: string;
};

const SONY_CAPTURE_WINDOW_MINUTES = 20;

export async function collectPhotosForListing(mode: CaptureMode): Promise<CameraCaptureResult> {
  if (mode === "sony_remote") {
    return {
      assets: [],
      source: mode,
      sourceLabel: "Sony Remote",
    };
  }

  if (mode === "sony_monitor" && Platform.OS !== "web") {
    const imported = await collectRecentCameraRollPhotos();
    if (imported.length > 0) {
      return {
        assets: imported,
        source: mode,
        sourceLabel: "Sony A7 III Monitor",
      };
    }
  }

  return pickFromLibrary(mode);
}

export function captureModeLabel(mode: CaptureMode): string {
  if (mode === "sony_monitor") return "Sony A7 III Monitor";
  if (mode === "sony_remote") return "Sony Remote";
  return "Mobile Photos";
}

export function captureModeSupportsAutoImport(mode: CaptureMode) {
  return mode === "sony_monitor" && Platform.OS !== "web";
}

export function photoImportRecoveryMessage(error: unknown) {
  const detail = error instanceof Error ? error.message.toLowerCase() : "";
  if (detail.includes("icloud") || detail.includes("network") || detail.includes("download")) {
    return "One or more photos are still downloading from iCloud. Open them in Photos until they appear at full resolution, then return and try again.";
  }
  return "ListingOS could not materialize one or more selected photos. Open any iCloud-backed photos once in Photos, then retry. Apple's Private Access picker is supported; full-library permission is not required.";
}

async function collectRecentCameraRollPhotos(): Promise<ImagePicker.ImagePickerAsset[]> {
  const permission = await MediaLibrary.requestPermissionsAsync().catch(() => null);
  if (!permission) return [];

  const granted = permission.granted || permission.status === "granted";

  if (!granted) return [];

  const cameraAlbum = await MediaLibrary.getAlbumAsync("Camera").catch(() => null);
  const cutoff = Date.now() - SONY_CAPTURE_WINDOW_MINUTES * 60_000;

  const options = {
    mediaType: "photo" as "photo",
    sortBy: "creationTime" as const,
    first: appConfig.maxPhotosPerSelection,
  };

  const primary = cameraAlbum
    ? await MediaLibrary.getAssetsAsync({ ...options, album: cameraAlbum }).catch(() => null)
    : null;

  const assetSource = primary?.assets.length
    ? primary
    : await MediaLibrary.getAssetsAsync(options).catch(() => null);

  if (!assetSource) return [];

  const recentlyCaptured = assetSource.assets.filter((asset) => {
    const createdTime = Number.parseInt(String((asset as { creationTime?: string | number }).creationTime), 10);
    const createdAt = Number.isFinite(createdTime)
      ? createdTime
      : new Date(((asset as { creationTime?: string | number }).creationTime ?? 0).toString()).getTime();
    return Number.isFinite(createdAt) && createdAt >= cutoff;
  });

  if (recentlyCaptured.length === 0) return [];

  return recentlyCaptured
    .slice(0, appConfig.maxPhotosPerSelection)
    .map(normalizeMediaAsset);
}

function normalizeMediaAsset(asset: unknown): ImagePicker.ImagePickerAsset {
  const raw = asset as {
    id?: string;
    uri?: string;
    filename?: string | null;
    width?: number;
    height?: number;
    mediaType?: string;
    fileSize?: number;
    size?: number;
  };

  const mimeType = raw.mediaType === "video" ? "video/mp4" : "image/jpeg";
  const fileSize = typeof raw.fileSize === "number"
    ? raw.fileSize
    : typeof raw.size === "number"
      ? raw.size
      : undefined;

  return {
    assetId: raw.id ?? undefined,
    uri: raw.uri ?? "",
    fileName: raw.filename ?? `sony-import-${raw.id ?? crypto.randomUUID()}.jpg`,
    width: raw.width ?? 0,
    height: raw.height ?? 0,
    mimeType,
    fileSize,
  };
}

async function pickFromLibrary(mode: CaptureMode): Promise<CameraCaptureResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: appConfig.maxPhotosPerSelection,
    // Let Photos provide a broadly readable local file. Upload preparation
    // performs the one controlled resize/compression pass afterward.
    quality: 1,
    orderedSelection: true,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    shouldDownloadFromNetwork: true,
  });

  if (result.canceled) {
    return {
      assets: [],
      source: mode,
      sourceLabel: captureModeLabel(mode),
    };
  }

  return {
    assets: result.assets,
    source: mode,
    sourceLabel: captureModeLabel(mode),
  };
}
