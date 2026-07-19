import type { VisionFrameContext } from "@/shared/contracts";

// The native detector is intentionally not bundled into the web target. Web
// capture remains fully usable and continues through the cloud listing flow.
export async function analyzeEncodedImage(): Promise<VisionFrameContext> {
  throw new Error("On-device vision is available in native builds only.");
}
