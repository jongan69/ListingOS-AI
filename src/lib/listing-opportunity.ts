import type { DraftPayload } from "@/shared/contracts";

export type ListingOpportunityAudit = {
  overall: number;
  scores: {
    search: number;
    visual: number;
    content: number;
    trust: number;
    offer: number;
    profitability: number;
  };
  priority: "ready" | "improve" | "needs_attention";
  evidence: string[];
  limitations: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildListingOpportunityAudit(draft: DraftPayload, effectivePrice: number | null): ListingOpportunityAudit {
  const specificsCount = draft.itemSpecifics.filter((item) => item.name.trim() && item.value.trim()).length;
  const trustedComps = draft.pricingEvidence?.exactMatchCount ?? 0;
  const pricingConfidence = draft.pricingEvidence?.confidence ?? 0;
  const descriptionLength = draft.description.trim().length;
  const titleLength = draft.selectedTitle.trim().length;
  const price = effectivePrice ?? draft.pricing.options.find((option) => option.strategy === draft.pricing.recommendedStrategy)?.price ?? 0;
  const median = draft.pricing.rangeMedian;
  const priceToMedian = median > 0 && price > 0 ? price / median : null;

  const search = clampScore(
    100
    - (titleLength < 55 ? 16 : 0)
    - (titleLength > 80 ? 18 : 0)
    - (specificsCount < 4 ? 22 : 0)
    - (!draft.categoryGuess.categoryId ? 18 : 0),
  );
  const visual = clampScore(
    100
    - (draft.photos.length < 3 ? 30 : draft.photos.length < 6 ? 14 : 0)
    - (!draft.leadPhotoId && draft.photos.length > 1 ? 10 : 0)
    - (draft.photoChecklist.length > 2 ? 8 : 0),
  );
  const content = clampScore(
    100
    - (descriptionLength < 180 ? 28 : 0)
    - (draft.conditionNotes.trim().length < 20 ? 12 : 0)
    - (draft.missingInfo.length > 0 ? Math.min(24, draft.missingInfo.length * 8) : 0),
  );
  const trust = clampScore(
    100
    - (draft.confidence < 0.7 ? 38 : draft.confidence < 0.82 ? 24 : 0)
    - (draft.identity?.status === "needs_confirmation" ? 24 : 0)
    - (draft.blockers.length > 0 ? Math.min(36, draft.blockers.length * 12) : 0),
  );
  const offer = clampScore(
    100
    - (!price || price <= 0 ? 42 : 0)
    - (trustedComps < 2 && pricingConfidence < 0.55 ? 24 : 0)
    - (priceToMedian !== null && priceToMedian > 1.25 ? 14 : 0),
  );
  const profitability = clampScore(
    100
    - (priceToMedian !== null && priceToMedian < 0.78 ? 30 : 0)
    - (draft.pricing.rangeLow <= 0 || draft.pricing.rangeHigh <= 0 ? 22 : 0)
    - (draft.listingMode === "auction" ? 10 : 0),
  );
  const overall = clampScore(
    search * 0.18
    + visual * 0.18
    + content * 0.14
    + trust * 0.2
    + offer * 0.18
    + profitability * 0.12,
  );

  return {
    overall,
    scores: { search, visual, content, trust, offer, profitability },
    priority: overall >= 82 && draft.blockers.length === 0 ? "ready" : overall >= 64 ? "improve" : "needs_attention",
    evidence: [
      `${draft.photos.length} photo${draft.photos.length === 1 ? "" : "s"} attached`,
      `${specificsCount} completed item specific${specificsCount === 1 ? "" : "s"}`,
      `${trustedComps} exact comp${trustedComps === 1 ? "" : "s"} accepted for pricing`,
      `${Math.round(draft.confidence * 100)}% AI confidence`,
    ],
    limitations: [
      ...(trustedComps < 2 ? ["Pricing evidence is useful but not post-sale truth yet."] : []),
      ...(draft.pricingEvidence?.source === "ai_fallback" ? ["Comparable data fell back to AI/context instead of exact market matches."] : []),
      ...(draft.blockers.length > 0 ? ["eBay blockers still override opportunity score."] : []),
    ],
  };
}
