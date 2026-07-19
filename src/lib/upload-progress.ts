import type { PricingStrategy } from "@/shared/contracts";

export type UploadProgress = {
  batchId: string;
  pricingStrategy: PricingStrategy;
  status: "uploading" | "analyzing" | "failed" | "complete";
  completed: number;
  total: number;
  errorMessage: string | null;
};

export function uploadProgressKey(batchId: string) {
  return ["upload-progress", batchId] as const;
}
