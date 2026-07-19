# Marketplace Signals

ListingOS uses marketplace data to make the listing faster, but the signals are not treated equally.

## Authority Order

1. **eBay image and keyword comparables** are the publish-pricing authority.
2. **Verified catalog APIs** such as PSA and Pokemon TCG API are identity anchors for cards.
3. **Local marketplace listings** such as OfferUp are context only.
4. **AI fallback estimates** are review-only unless the seller manually confirms a price.

## OfferUp Integration

The Worker can fetch public OfferUp search pages, parse `__NEXT_DATA__`, normalize listing cards, and cache results in KV for six hours.

OfferUp signals are useful because they add real-world asking-price context for common local goods. They are also noisy because local listings are not paid placements, are not sold-comparable data, may be stale, and may not match eBay buyer demand.

For that reason, ListingOS stores OfferUp results as `offerup_active` comparables with a rejection reason:

```text
Local asking-price signal only; not used for auto-publish pricing.
```

This lets the review page show the seller extra context without allowing a local asking price to unlock auto-publish or override eBay pricing evidence.

## Auto-Publish Readiness

The review screen treats a draft as fast-publish eligible only when all of these are true:

- no eBay blockers are present
- a positive price exists
- the price is seller-confirmed or backed by trusted eBay evidence
- AI confidence is high
- a lead photo is selected

If one of those checks fails, the seller can still edit the draft, confirm a manual price, resolve blockers, and retry publishing in-app.

## Future Signal Candidates

Facebook Marketplace parsing exists in the older sourcing MCP project, but it is intentionally not in the MVP Worker path. The public parser depends on brittle GraphQL page internals and would be better kept behind an explicit feature flag after the core demo is stable.
