# Internal Cost And Product Analytics

ListingOS records two different things and must not confuse them:

- `usage_events` records seller-facing AI listing credits and is the quota ledger.
- `ai_operation_events` records provider work and estimated variable cost for each draft.

The operation ledger is written for OpenAI draft generation and card OCR. It captures the seller, batch/job/draft, operation name, model, provider request ID, input/cached/output/reasoning tokens, image count/detail, latency, cache hits, success/failure, error code, estimated cost, and pricing-table version. It never stores raw images or prompts.

## Internal endpoints

Set the Worker secret `INTERNAL_ANALYTICS_TOKEN` before using these endpoints:

```sh
npx wrangler secret put INTERNAL_ANALYTICS_TOKEN
```

Summary for the last seven days:

```sh
curl -H "Authorization: Bearer $INTERNAL_ANALYTICS_TOKEN" \
  "https://seller-ai-platform.jonathang132298.workers.dev/api/internal/analytics/summary?days=7"
```

Trace one listing:

```sh
curl -H "Authorization: Bearer $INTERNAL_ANALYTICS_TOKEN" \
  "https://seller-ai-platform.jonathang132298.workers.dev/api/internal/analytics/listings/<draft-id>"
```

## Metrics to review

- Average and p95 AI cost per useful draft, separated between general items and card OCR paths.
- Capture-to-review latency, provider latency, queue wait, and publish latency.
- Draft ready, needs-input, blocked, failed, and published rates.
- Automatic-repair success rate and repeated eBay error signatures.
- Free activation, monthly credit consumption, paid conversion, and estimated margin by plan.
- Cache-hit rate and image count/detail distribution.

The local estimate is intentionally versioned. Reconcile it against OpenAI's organization Costs endpoint before making pricing or quota changes. Provider costs for eBay, PSA, Pokémon TCG, OfferUp, Cloudflare, and push delivery are tracked as zero-cost/free-provider events where applicable, while latency, retries, rate limits, and failures remain measurable.
