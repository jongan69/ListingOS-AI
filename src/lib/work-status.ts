export type WorkStatusTone = "neutral" | "success" | "warning" | "danger" | "accent";

const SUCCESS_STATUSES = new Set(["ready", "ready_for_review", "published"]);
const DANGER_STATUSES = new Set(["blocked", "failed"]);
const WARNING_STATUSES = new Set(["needs_input", "publishing"]);

export function workStatusTone(status: string): WorkStatusTone {
  if (SUCCESS_STATUSES.has(status)) return "success";
  if (DANGER_STATUSES.has(status)) return "danger";
  if (WARNING_STATUSES.has(status)) return "warning";
  if (status === "canceled") return "neutral";
  return "accent";
}

export function workStatusGradient(status: string): [string, string] {
  if (SUCCESS_STATUSES.has(status)) return ["rgba(107,227,165,0.18)", "rgba(107,227,165,0)"];
  if (DANGER_STATUSES.has(status)) return ["rgba(243,154,177,0.20)", "rgba(243,154,177,0)"];
  if (WARNING_STATUSES.has(status)) return ["rgba(249,199,114,0.20)", "rgba(249,199,114,0)"];
  if (status === "canceled") return ["rgba(255,255,255,0.08)", "rgba(255,255,255,0)"];
  return ["rgba(71,184,255,0.20)", "rgba(71,184,255,0)"];
}
