#!/usr/bin/env bash
# One command to finish the RevenueCat server-side setup and prove it worked.
#
#   npm run rc:finish
#
# Does four things:
#   1. Scrubs any leaked RevenueCat secret key from local Expo logs.
#   2. Stores REVENUECAT_SECRET_API_KEY as a Cloudflare Worker secret.
#   3. Deploys the Worker.
#   4. Verifies /health reports the billing trust path as configured.
#
# Nothing here writes a secret into the repo. Wrangler prompts for the key and
# stores it in Cloudflare; it is never echoed, logged, or committed.

set -euo pipefail

WORKER_URL="https://seller-ai-platform.jonathang132298.workers.dev"
ok()   { printf '\033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '\033[33m!\033[0m %s\n' "$1"; }
die()  { printf '\033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

cd "$(dirname "$0")/.."

# ---------------------------------------------------------------------------
step "1/4  Scrubbing secret keys from local Expo logs"
# EXPO_PUBLIC_* vars get printed at bundle time, and a secret pasted into a
# terminal can end up in .expo/dev/logs. These are gitignored, but leaving a
# live secret in plaintext on disk is still worth cleaning up.
scrubbed=0
if [ -d .expo/dev/logs ]; then
  while IFS= read -r -d '' logfile; do
    if grep -qE 'sk_[A-Za-z0-9]{20,}' "$logfile" 2>/dev/null; then
      # macOS and GNU sed take different -i args; write to a temp file instead.
      sed -E 's/sk_[A-Za-z0-9]{20,}/sk_REDACTED/g' "$logfile" > "$logfile.tmp" \
        && mv "$logfile.tmp" "$logfile"
      scrubbed=$((scrubbed + 1))
    fi
  done < <(find .expo/dev/logs -type f -print0 2>/dev/null)
fi
if [ "$scrubbed" -gt 0 ]; then
  ok "Redacted secret keys from $scrubbed log file(s)"
else
  ok "No secret keys found in local logs"
fi

# ---------------------------------------------------------------------------
step "2/4  Storing REVENUECAT_SECRET_API_KEY as a Worker secret"
command -v npx >/dev/null 2>&1 || die "npx not found. Install Node first."

if ! npx wrangler whoami >/dev/null 2>&1; then
  warn "Wrangler is not logged in. Opening browser login..."
  npx wrangler login || die "wrangler login failed. Run 'npx wrangler login' manually."
fi
ok "Cloudflare authenticated"

cat <<'PROMPT'

  Paste your RevenueCat SECRET key when prompted, then press Enter.
  Find it at: RevenueCat -> API keys -> Secret API keys -> ListingOS
  It starts with  sk_
  (Input is hidden. Nothing is written to the repo.)

PROMPT

npx wrangler secret put REVENUECAT_SECRET_API_KEY \
  || die "Failed to store the secret. Re-run: npx wrangler secret put REVENUECAT_SECRET_API_KEY"
ok "Secret stored in Cloudflare"

# ---------------------------------------------------------------------------
step "3/4  Deploying the Worker"
npm run worker:deploy || die "Worker deploy failed. Fix the error above and re-run."
ok "Worker deployed"

# ---------------------------------------------------------------------------
step "4/4  Verifying the billing trust path"
# A fresh deploy takes a little while to propagate to every edge location, so
# poll rather than checking once. Without this the check can report a stale
# response from the previous version and look like a failure when it is not.
secret_ok="missing"; mode="missing"; health=""
for attempt in $(seq 1 12); do
  health="$(curl -fsS -H 'Cache-Control: no-cache' "$WORKER_URL/health" 2>/dev/null || true)"
  secret_ok=$(printf '%s' "$health" | grep -o '"revenueCatSecretConfigured":[a-z]*' | cut -d: -f2 || true)
  [ "$secret_ok" = "true" ] && break
  [ "$attempt" -eq 1 ] && printf '  waiting for the new version to propagate'
  printf '.'
  sleep 5
done
printf '\n\n'

[ -n "$health" ] || die "Could not reach $WORKER_URL/health"
mode=$(printf '%s' "$health" | grep -o '"billingEnforcementMode":"[a-z]*"' | cut -d'"' -f4 || echo "unknown")

if [ "$secret_ok" = "true" ]; then
  ok "revenueCatSecretConfigured: true"
elif [ -z "$secret_ok" ]; then
  die "Health endpoint still has no revenueCatSecretConfigured field after 60s. Confirm worker/index.ts contains it, then re-run 'npm run worker:deploy'."
else
  die "revenueCatSecretConfigured is false. The secret did not attach; re-run this script."
fi
ok "revenueCatWebhookConfigured: $(printf '%s' "$health" | grep -o '"revenueCatWebhookConfigured":[a-z]*' | cut -d: -f2)"
ok "billingEnforcementMode: $mode"

cat <<'DONE'

────────────────────────────────────────────────────────────
Server side is done. Purchases will now grant real entitlements.

Next, build to your phone and test the paywall:

    npm run device:ios        # or: npm run device:android

You should see all six plans with real prices. Complete a Test
Store purchase, then confirm the plan flips from Free on the
dashboard. That is the full end-to-end proof.
────────────────────────────────────────────────────────────
DONE
