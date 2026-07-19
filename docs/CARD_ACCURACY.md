# Trading Card Accuracy Pipeline

ListingOS treats graded trading cards differently from general merchandise because small identity mistakes can create very wrong prices. The card pipeline is intentionally conservative: it should block publishing when identity or comparables are weak instead of inventing a confident price.

## Signal Order

1. AI vision creates the first structured draft from uploaded photos.
2. Card OCR re-reads up to five uploaded photos, preferring the clearest slab label over card-art guesses.
3. PSA cert lookup verifies PSA slabs when a readable cert number is available.
4. Pokémon TCG catalog lookup can fill or confirm catalog fields only when the query is anchored by OCR, PSA, or high-confidence exact fields.
5. eBay Browse keyword search and `search_by_image` provide active marketplace candidates.
6. Card-specific scoring rejects mismatched card name, card number, set/code, language, grader, or grade.
7. Pricing is only trusted when the card identity is verified and at least two exact matching comparables survive filtering.

## Guardrails

- Placeholder text such as `unknown`, `not readable`, and `not visible` is normalized to `null`.
- Catalog APIs are not allowed to upgrade weak AI guesses into truth.
- Repeated eBay results are deduped by item ID or canonical item URL before sample size is calculated.
- Mixed-language and mixed-set card results are rejected when language or set/code is known.
- Unverified cards use a locked pricing ladder with `0` prices and a blocker instead of an AI fallback price.
- Publish verification repeats the card guard, so stale or manually edited drafts cannot bypass it.

## Current Behavior

For the Wartortle PSA 10 test card, the Worker now verifies the PSA cert and identifies the card as `2023 Pokemon CLB Wartortle #002`. If eBay only returns one strict exact match, the draft stays in `needs_input` with pricing locked instead of using Japanese `CLK JP` or unrelated Wartortle comps.

## Cost And Scale Notes

- PSA cert responses are cached in KV for 90 days.
- Pokémon TCG catalog responses are cached in KV for 30 days.
- eBay image-search responses are cached in KV for 6 hours per uploaded photo.
- Card OCR is cached in KV for 30 days per photo set.
- The polling endpoint self-heals stale queue jobs by kicking old queued jobs and retrying abandoned processing jobs.

## Where To Change This

- Shared payload contracts live in `src/shared/contracts.ts`.
- Identity, PSA, catalog, eBay image search, scoring, and pricing guard logic live in `worker/index.ts`.
- Seller-facing evidence and card identity display live in `src/screens/draft-detail-screen.tsx`.

