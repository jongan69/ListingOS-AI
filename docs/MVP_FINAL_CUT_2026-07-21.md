# ListingOS — Final MVP Cut List

**Written:** 2026-07-21 · **Time remaining:** ~19 hours
**Purpose:** decide what ships, what gets cut, and what gets demoed-but-labelled. This
document overrides `ROADMAP.md` for the remainder of the hackathon. `CLAIMS.md` still
governs every public-facing sentence.

---

## 0. The one-sentence pitch

> ListingOS turns a pile of photos into verified, priced, publish-ready listings — and
> routes them to eBay, to a free local ListingOS Market feed, or both.

That sentence is defensible today. Everything below either supports it or gets cut.

---

## 1. Status after this session's RevenueCat work

### Fixed (dashboard)

| Problem | State |
| --- | --- |
| `default` offering packages had wrong Test Store products (`Weekly` on Pro/Starter annual) | **Fixed** — every package now maps to its matching product on all four stores |
| App Store products: 0 entitlements attached | **Fixed** — all 6 mapped to `starter`/`pro`/`studio` |
| Play Store products: 0 entitlements attached | **Fixed** — all 6 mapped |
| Web Billing products: 0 entitlements attached | **Fixed** — all 3 mapped |

### Fixed (code)

| Problem | State |
| --- | --- |
| `.env` + `eas.json` shipped literal placeholder keys (`appl_your_ios_...`) | **Fixed** — real public SDK keys wired into `.env` and all three EAS profiles |
| Test Store hard-blocked in every non-`__DEV__` build — **this is what produced your "catalog pending" screenshot** | **Fixed** — `EXPO_PUBLIC_REVENUECAT_ALLOW_TEST_STORE_IN_RELEASE` opts internal/preview builds in; production still requires real store keys |
| No way to verify the server-side billing trust path | **Fixed** — `/health` now reports `revenueCatSecretConfigured`, `revenueCatWebhookConfigured`, `billingEnforcementMode` |

### Still blocked — needs you, ~15 minutes total

| Blocker | Action | Owner | Est. |
| --- | --- | --- | --- |
| **Web checkout** — RevenueCat Billing has no Stripe account connected, so Web Purchase Links cannot be saved at all | Web → ListingOS (RevenueCat Billing) → **Billing** → connect Stripe + set default currency | You | 5–10 min |
| **Worker billing trust** — `BILLING_ENFORCEMENT_MODE=enforce`; if `REVENUECAT_SECRET_API_KEY` is unset, every verified purchase still resolves to `free` | `curl .../health` and check `revenueCatSecretConfigured`. If false: `npx wrangler secret put REVENUECAT_SECRET_API_KEY` | You | 2 min |
| **App Store "Could not check"** | App Store Connect credential re-sync in RevenueCat. Not on the demo path — see §3 | You, optional | 10 min |
| **Play Store "Not found"** | Play app must be published to a track with matching package name. Not on the demo path | You, optional | — |

> **The 2-minute check that matters most:** if `revenueCatSecretConfigured` is `false`,
> your paywall will complete a purchase and then still show the user as free. That is the
> single most demo-destroying failure mode remaining, and it is a one-command fix.

---

## 2. What to demo — the decision

You have three possible purchase paths. Only one is fully in your control tonight.

| Path | Works without external approval? | Verdict |
| --- | --- | --- |
| **Test Store on a dev/internal build** | **Yes** — no Apple, no Google, no Stripe | ✅ **Demo this** |
| Web Billing checkout | No — blocked on Stripe connection | ⚠️ Ship if Stripe connects, else label as roadmap |
| iOS/Android real IAP | No — blocked on ASC sync + Play track | ❌ Do not put on the demo path |

**Recommendation: record the purchase demo on a Test Store build.** It exercises the real
RevenueCat SDK, real offering, real entitlement mapping, and real Worker sync. It is not a
mock. Narrate it as *"RevenueCat Test Store, so we're not charging a real card on stage"* —
which is honest and every judge has seen it before.

---

## 3. Feature triage

Grounded in `CLAIMS.md` (what's actually shipped), not `ROADMAP.md` (intent).

### 🟢 SHIP — already real, just needs to be visible in the demo

These are all marked High confidence + "Safe to publish" in `CLAIMS.md`. Do not touch the
code; just make sure the demo path hits them.

1. **Photos → structured draft via GPT-5.6** — strict JSON Schema, Zod-validated. The core.
2. **Async draft generation** — Cloudflare Queues; seller keeps moving. Show this.
3. **eBay OAuth + real fixed-price publish** — into the seller's own account, real listing IDs.
4. **eBay-hosted media** — photos through the Media API before publish.
5. **Comparable-based pricing** — active listings + image search. Say *active comps*, never *sold comps*.
6. **Graded-card identity guard** — PSA cert + catalog + eBay cross-check; weak identity locks pricing. **This is your most impressive differentiator and it is under-demoed.**
7. **Inline blocker resolution** — policy, location, aspects fixed in-app.
8. **One review screen** — everything editable before publish.
9. **Deterministic opportunity audit** — rule-based, not model output. Say so; it lands better.
10. **ListingOS Market** — publish/unpublish/mark-sold, public feed, detail pages, buyer inquiry, seller inbox. Routes exist in `worker/index.ts` and `src/app/market/`. **This is your OfferUp story — give it real demo minutes.**
11. **On-device capture quality scoring** — blur/exposure/detail, advisory only.
12. **Sony monitor-mode import** — say *import*, never *camera control*.
13. **RevenueCat metering + entitlements** — now genuinely working; see §1.

### 🟡 LABEL — real code, show it, but mark it as roadmap out loud

- **OfferUp local asking-price signals** — already qualified correctly in `CLAIMS.md`. Great narrative bridge to your local-marketplace thesis. Say *asking prices, not sold data*.
- **Web checkout** — if Stripe doesn't connect in time, show the paywall and say hosted web checkout is next.
- **iOS push** — Android delivery verified, iOS not. Existing `CLAIMS.md` wording is right.

### 🔴 CUT — do not demo, do not mention in present tense

`CLAIMS.md` already marks every one of these "Safe to publish? **No**". Respect it:

- **Auction publishing** — no verified Trading API adapter.
- **Automatic image enhancement** — plan is generated, transforms are not.
- **Sony remote camera control** — app literally returns "not enabled yet".
- **On-device YOLOX object detection** — not linked into the release build.
- **Universal speed SLA** — "under a minute" is demo evidence only, not a promise.

### ⛔ DO NOT START — new work with <19h left

Nothing on the `ROADMAP.md` "Next" list. Not additional channels, not auction, not
real-time chat, not payments in Market. The marginal judge-value of a fourth half-built
feature is negative; the marginal value of a clean, working demo is enormous.

---

## 4. Suggested remaining-time allocation

| Hours | Work |
| --- | --- |
| **0–1** | Stripe connect + `REVENUECAT_SECRET_API_KEY` + redeploy Worker. Confirm `/health`. |
| **1–2** | Build internal/preview app. Confirm paywall lists all 6 packages, complete one Test Store purchase, confirm entitlement flips in `/api/billing/summary`. |
| **2–4** | Full dry run: capture → draft → review → publish to eBay **and** ListingOS Market → open public listing in a browser → send a buyer inquiry → reply from the seller inbox. Fix only what breaks. |
| **4–7** | Record the demo video. Multiple takes. This is the single highest-leverage remaining hour-for-hour investment. |
| **7–9** | Devpost copy, straight from `CLAIMS.md` wording. Update the RevenueCat row — it is no longer launch-blocked. |
| **9–12** | Buffer. Something will break. |
| **12+** | Sleep. A rested presenter beats a twelfth feature. |

---

## 5. The strategic note

Your stated goal is a local marketplace that beats OfferUp and gets acquired by eBay.
`LISTINGOS_MARKETPLACE_PLAN.md` already contains the honest version of that story, and it
is a better story than "OfferUp competitor":

> ListingOS is the listing-intelligence layer. The same reviewed item — with its evidence,
> media, pricing, and safety checks — can be routed to eBay, to a free local feed, or to
> any channel added behind the same adapter interface.

That framing is what makes an eBay acquisition make sense. eBay does not need another
feed; it needs the supply-side pipeline that produces well-formed inventory, and a local
channel that captures the items that never make it onto eBay at all. The channel-adapter
architecture already in your codebase *is* the pitch. Lead with it.

One honest caution, since it affects how you pitch rather than what you build: framing a
hackathon MVP around being acquired tends to land worse with judges than framing it around
the seller problem you solve. The architecture argument above wins on its own merits — and
it happens to also be the acquisition argument. Let them draw that conclusion.

---

## 6. Files changed this session

- `src/config/app.ts` — added `revenueCatWebApiKey`, `revenueCatAllowTestStoreInRelease`
- `src/lib/revenuecat.ts` — Test Store release-build guard now opt-in-able
- `worker/index.ts` — `/health` reports billing trust configuration
- `eas.json` — real SDK keys across all three profiles; Test Store opt-in on dev/preview
- `.env` — real iOS/Android/Web keys, Test Store opt-in flag

**Not committed for you.** Review the diff before you push.
