# RevenueCat Web Purchase Links (ListingOS)

## Current implementation

ListingOS uses RevenueCat Web Purchase Links on `web` builds for zero-code checkout. Native iOS and Android still use the `react-native-purchases` native SDK with the standard offer/catalog flow.

## Required config

Set this environment variable in both `.env` and active EAS profiles where web checkout is needed:

- `EXPO_PUBLIC_REVENUECAT_WEB_PURCHASE_LINKS`

It must be JSON mapping plan/term -> URL, for example:

```json
{
  "starter": {
    "monthly": "https://pay.revenuecat.com/checkout-link-id",
    "annual": "https://pay.revenuecat.com/checkout-link-id"
  },
  "pro": {
    "monthly": "https://pay.revenuecat.com/checkout-link-id",
    "annual": "https://pay.revenuecat.com/checkout-link-id"
  },
  "studio": {
    "monthly": "https://pay.revenuecat.com/checkout-link-id",
    "annual": "https://pay.revenuecat.com/checkout-link-id"
  }
}
```

Only terms with non-empty URLs are enabled in UI.

## Runtime behavior

- If links are present and valid:
  - Paywall buttons enable and open hosted checkout URLs.
  - On completion, users must refresh subscription status.
- If links are missing/invalid:
  - Paywall shows a setup notice and disables paid actions.
  - Billing remains usage-metered and free-plan logic continues.

## Trust boundary

A purchase is not considered paid until server validation updates `billing_profiles` through:

- `REVENUECAT_SECRET_API_KEY` REST sync, or
- signed RevenueCat webhook events.

If server-side verification is not available, Billing runs in fallback behavior until trust is restored.
