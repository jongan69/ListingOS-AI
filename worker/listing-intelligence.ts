import type { Bindings } from "./types";

// ---------------------------------------------------------------------------
// Publish outcome memory
//
// Every publish success/failure is folded into an aggregate pattern table so
// the backend can rank which repairs actually work for a given eBay error
// signature over time. Recording is fire-and-forget: a missing table (before
// migration 0005 is applied) or a write race must never break publishing.
// ---------------------------------------------------------------------------

const DEFAULT_CLUSTER_MODEL = "gpt-5.6-luna";
const PARTITION_IMAGE_LIMIT = 12;
const PARTITION_TIMEOUT_MS = 45_000;

export function publishErrorSignature(message: string): string {
  const errorIds = [...message.matchAll(/"errorId"\s*:\s*(\d+)/g)].map((match) => match[1]);
  const aspectIds = [...message.matchAll(/\((\d{4,6})\) is a required field/gi)].map((match) => match[1]);
  const parts = [...new Set(errorIds)].sort();
  const aspects = [...new Set(aspectIds)].sort();
  if (parts.length > 0 || aspects.length > 0) {
    return [`ebay:${parts.join(",")}`, aspects.length ? `fields:${aspects.join(",")}` : null].filter(Boolean).join("|");
  }
  const head = message.toLowerCase().replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "*").replace(/\d{6,}/g, "*").slice(0, 140).trim();
  return `msg:${head}`;
}

export async function recordPublishOutcome(env: Bindings, input: {
  message: string | null;
  categoryId: string | null;
  vertical: string | null;
  repairKind: "none" | "deterministic" | "manual";
  success: boolean;
}): Promise<void> {
  try {
    const signature = input.success ? (input.message ? publishErrorSignature(input.message) : "clean") : publishErrorSignature(input.message ?? "unknown");
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO publish_outcome_patterns (id, error_signature, category_id, vertical, repair_kind, success_count, failure_count, sample_message, last_outcome_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (error_signature, category_id, repair_kind) DO UPDATE SET
         success_count = success_count + excluded.success_count,
         failure_count = failure_count + excluded.failure_count,
         sample_message = COALESCE(excluded.sample_message, sample_message),
         last_outcome_at = excluded.last_outcome_at,
         updated_at = excluded.updated_at`,
    ).bind(
      crypto.randomUUID(),
      signature,
      input.categoryId ?? "",
      input.vertical ?? "general",
      input.repairKind,
      input.success ? 1 : 0,
      input.success ? 0 : 1,
      input.message ? input.message.slice(0, 500) : null,
      now,
      now,
      now,
    ).run();
  } catch (error) {
    console.warn("publish outcome recording skipped", error instanceof Error ? error.message : error);
  }
}

export async function publishOutcomeStats(env: Bindings, message: string, categoryId: string | null) {
  try {
    const signature = publishErrorSignature(message);
    const rows = await env.DB.prepare(
      `SELECT repair_kind, success_count, failure_count FROM publish_outcome_patterns
       WHERE error_signature = ? AND category_id IN (?, '')
       ORDER BY success_count * 1.0 / MAX(success_count + failure_count, 1) DESC`,
    ).bind(signature, categoryId ?? "").all<{ repair_kind: string; success_count: number; failure_count: number }>();
    return rows.results ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Multi-product photo partitioning
//
// Given one capture session's photos (a shoot may cover several different
// items), ask the vision model to group photos by physical product. Returns a
// single group when the shoot is one product, when there are too few photos
// to justify a model call, or when the model call fails — so the legacy
// one-batch-one-product flow is always the safe fallback.
// ---------------------------------------------------------------------------

export type PhotoGroup = { label: string; photoIds: string[] };

export async function partitionPhotosIntoProducts(
  env: Bindings,
  photos: { id: string; dataUrl: string }[],
): Promise<PhotoGroup[]> {
  const fallback: PhotoGroup[] = [{ label: "Product 1", photoIds: photos.map((photo) => photo.id) }];
  if (photos.length < 4) return fallback;
  const sample = photos.slice(0, PARTITION_IMAGE_LIMIT);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PARTITION_TIMEOUT_MS);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_CLUSTER_MODEL ?? env.OPENAI_MODEL ?? DEFAULT_CLUSTER_MODEL,
        max_output_tokens: 900,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Group these product photos by distinct physical item for marketplace listings.",
                  "Photos of the same item from different angles belong in one group.",
                  "Only create multiple groups when the photos clearly show different products.",
                  "If unsure whether two photos show the same item, keep them in the same group.",
                  `Photo ids in order: ${sample.map((photo) => photo.id).join(", ")}`,
                  "Every photo id must appear in exactly one group.",
                ].join("\n"),
              },
              ...sample.map((photo) => ({
                type: "input_image",
                image_url: photo.dataUrl,
                detail: "low",
              })),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "photo_product_groups",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["groups"],
              properties: {
                groups: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["label", "photoIds"],
                    properties: {
                      label: { type: "string" },
                      photoIds: { type: "array", minItems: 1, items: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });
    clearTimeout(timer);
    if (!response.ok) return fallback;
    const payload = await response.json() as { output?: { content?: { type: string; text?: string }[] }[] };
    const text = payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")?.text;
    if (!text) return fallback;
    const parsed = JSON.parse(text) as { groups: PhotoGroup[] };
    const validIds = new Set(photos.map((photo) => photo.id));
    const seen = new Set<string>();
    const groups = parsed.groups
      .map((group, index) => ({
        label: group.label?.trim() || `Product ${index + 1}`,
        photoIds: group.photoIds.filter((id) => {
          if (!validIds.has(id) || seen.has(id)) return false;
          seen.add(id);
          return true;
        }),
      }))
      .filter((group) => group.photoIds.length > 0);
    // Photos the model skipped (or beyond the sample cap) go to the first
    // group rather than silently disappearing from the listing flow.
    const unassigned = photos.map((photo) => photo.id).filter((id) => !seen.has(id));
    if (groups.length === 0) return fallback;
    if (unassigned.length > 0) groups[0] = { ...groups[0], photoIds: [...groups[0].photoIds, ...unassigned] };
    return groups;
  } catch (error) {
    console.warn("photo partitioning fell back to single product", error instanceof Error ? error.message : error);
    return fallback;
  }
}
