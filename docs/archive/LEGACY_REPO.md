# Legacy Repository Preservation

ListingOS began as a private Next.js prototype in `jongan69/ListingOS`. That prototype explored a post-listing seller command center: deterministic audits, funnel metrics, approval-gated recommendations, experiments, imports, and an eBay operations bridge.

During Build Week, the product direction changed from a web dashboard to a camera-first mobile listing machine. The active submission is now the Expo React Native app and Cloudflare Worker in this repository state.

## Preservation State

- GitHub repo: `https://github.com/jongan69/ListingOS-AI`
- Preserved branch: `legacy/nextjs-prototype`
- Preserved tag: `nextjs-prototype-final`
- Active submission branch: `main`
- Local checkpoint branch: `checkpoint/local-expo-worker-mvp`

Do not copy the full Next.js app into the active branch. It adds build surface and UI confusion without helping the central photos-to-publish demo.

## What Was Migrated

The useful legacy concept was the deterministic audit model: score a listing with evidence and limitations instead of presenting AI output as magic. The mobile review page now includes an opportunity audit that scores search, visual coverage, content, trust, offer quality, and profitability risk.

## What Stayed Legacy

- Next.js App Router UI
- Clerk authentication
- Supabase repository layer
- Vercel deployment setup
- CSV import dashboard
- post-listing experiments dashboard
- hosted eBay operations bridge

Those ideas can return later as a seller analytics layer after the mobile listing workflow is stable.

## Migration Matrix

| Legacy feature | Legacy status | Current equivalent | User value | Judge value | Migration cost | Risk | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Deterministic listing audit | Implemented prototype | Opportunity audit in mobile review | High | High | Low | Low | Migrate before submission |
| Approval-gated recommendations | Implemented prototype | Explicit verify and publish actions | High | High | None | Low | Already replaced |
| eBay operations bridge | Partial integration | Direct seller-scoped OAuth and Worker adapters | High | High | None | Low | Already replaced |
| Seller command-center dashboard | UI prototype | Camera-first home and async assembly line | Medium | Low | High | High | Reject |
| CSV imports | Partial | Multi-photo upload batches | Medium | Low | Medium | Medium | Preserve for later |
| Experiments dashboard | UI prototype | None | Medium | Low | High | Medium | Preserve for later |
| Clerk and Supabase stack | Implemented prototype | eBay OAuth, D1, KV, and encrypted seller tokens | Low | Low | High | High | Already replaced |
| Vercel deployment | Implemented prototype | Expo/EAS app plus Cloudflare Worker | Low | Low | High | High | Already replaced |
