import type * as ImagePicker from "expo-image-picker";

export type PhotoQualityTone = "success" | "warning" | "danger";

export type PhotoQualityIssue = {
  id: string;
  tone: PhotoQualityTone;
  title: string;
  message: string;
};

export type PhotoQualityReport = {
  score: number;
  label: string;
  tone: PhotoQualityTone;
  issues: PhotoQualityIssue[];
};

export function analyzePhotoSelection(assets: ImagePicker.ImagePickerAsset[]): PhotoQualityReport {
  const issues: PhotoQualityIssue[] = [];
  const count = assets.length;

  if (count === 0) {
    return {
      score: 0,
      label: "No photos selected",
      tone: "danger",
      issues: [{
        id: "empty",
        tone: "danger",
        title: "Start with photos",
        message: "Choose clear shots of one product before ListingOS builds the draft.",
      }],
    };
  }

  if (count < 3) {
    issues.push({
      id: "count-low",
      tone: "warning",
      title: "Add a couple more angles",
      message: "Front, back, label/model, and flaw/detail shots improve identity and reduce eBay blockers.",
    });
  } else if (count > 8) {
    issues.push({
      id: "count-high",
      tone: "warning",
      title: "Trim the set if needed",
      message: "Eight strong photos usually beat a crowded upload. Keep the clearest proof shots first.",
    });
  }

  const lowResolutionCount = assets.filter((asset) => {
    if (!asset.width || !asset.height) return true;
    return Math.min(asset.width, asset.height) < 900;
  }).length;
  if (lowResolutionCount > 0) {
    issues.push({
      id: "resolution",
      tone: lowResolutionCount === count ? "danger" : "warning",
      title: "Some photos may be soft",
      message: `${lowResolutionCount} photo${lowResolutionCount === 1 ? "" : "s"} look under 900px on the short edge. Sharper images help AI and buyers.`,
    });
  }

  const tinyFileCount = assets.filter((asset) => typeof asset.fileSize === "number" && asset.fileSize > 0 && asset.fileSize < 120_000).length;
  if (tinyFileCount > 0) {
    issues.push({
      id: "tiny-files",
      tone: "warning",
      title: "Watch for screenshots or heavy compression",
      message: `${tinyFileCount} file${tinyFileCount === 1 ? "" : "s"} are very small. Original camera photos usually perform better.`,
    });
  }

  const score = Math.max(12, Math.min(100, 55 + Math.min(count, 6) * 8 - issues.reduce((total, issue) => total + (issue.tone === "danger" ? 26 : 13), 0)));
  const tone: PhotoQualityTone = issues.some((issue) => issue.tone === "danger")
    ? "danger"
    : issues.some((issue) => issue.tone === "warning")
      ? "warning"
      : "success";

  return {
    score,
    tone,
    label: tone === "success" ? "Photo set looks listing-ready" : tone === "warning" ? "Photo set is usable" : "Photo set needs attention",
    issues: issues.length > 0 ? issues : [{
      id: "ready",
      tone: "success",
      title: "Strong intake set",
      message: "This is enough for fast AI identity, pricing, and a buyer-friendly eBay draft.",
    }],
  };
}
