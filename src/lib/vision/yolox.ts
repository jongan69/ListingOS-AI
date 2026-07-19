import { AlphaType, ColorType, Skia, type SkData } from "@shopify/react-native-skia";

import type { VisionFrameContext } from "@/shared/contracts";

// The release path uses a small, cross-platform quality pass so an optional
// native detector runtime cannot crash or block the camera.
const QUALITY_MODEL_VERSION = "capture-quality-skia-1";
const SAMPLE_SIZE = 160;

export async function analyzeEncodedImage(data: SkData): Promise<VisionFrameContext> {
  const startedAt = Date.now();
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error("Could not decode the camera frame for local analysis.");

  const sampleWidth = Math.min(SAMPLE_SIZE, image.width());
  const sampleHeight = Math.min(SAMPLE_SIZE, image.height());
  const pixels = image.readPixels(0, 0, {
    width: sampleWidth,
    height: sampleHeight,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) throw new Error("Could not read camera pixels for local analysis.");

  const metrics = calculateQualityMetrics(pixels, sampleWidth, sampleHeight);
  return {
    modelVersion: QUALITY_MODEL_VERSION,
    analyzedAt: new Date().toISOString(),
    detections: [],
    primaryObject: null,
    inferenceMs: Date.now() - startedAt,
    quality: {
      objectPresent: false,
      objectCoverage: 0,
      centered: false,
      stableAcrossFrames: false,
      qualityScore: metrics.qualityScore,
      blurScore: metrics.blurScore,
      exposureScore: metrics.exposureScore,
      warnings: metrics.warnings,
    },
  };
}

function calculateQualityMetrics(pixels: Uint8Array | Float32Array, width: number, height: number) {
  const luminance: number[] = [];
  let exposureTotal = 0;
  for (let index = 0; index < width * height; index += 1) {
    const pixel = index * 4;
    const value = (0.2126 * pixels[pixel] + 0.7152 * pixels[pixel + 1] + 0.0722 * pixels[pixel + 2]) / 255;
    luminance.push(value);
    exposureTotal += value;
  }

  const mean = luminance.length > 0 ? exposureTotal / luminance.length : 0;
  let variance = 0;
  let edgeTotal = 0;
  for (let y = 1; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const index = y * width + x;
      edgeTotal += Math.abs(luminance[index] - luminance[index - 1]);
      edgeTotal += Math.abs(luminance[index] - luminance[index - width]);
    }
  }
  for (const value of luminance) variance += (value - mean) ** 2;
  variance = luminance.length > 0 ? variance / luminance.length : 0;

  const blurScore = clamp(Math.min(1, edgeTotal / Math.max(1, luminance.length * 0.18)));
  const exposureScore = clamp(1 - Math.min(1, Math.abs(mean - 0.5) / 0.5));
  const qualityScore = clamp(0.55 * blurScore + 0.45 * exposureScore);
  const warnings = [
    ...(blurScore < 0.18 ? ["Hold steady and refocus before capturing."] : []),
    ...(exposureScore < 0.42 ? [mean < 0.5 ? "Add light or move closer to a brighter area." : "Reduce glare or move away from direct light."] : []),
    ...(variance < 0.004 ? ["The frame has very little visual detail; include the item edges and label."] : []),
  ];
  return { blurScore, exposureScore, qualityScore, warnings };
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
