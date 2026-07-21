#!/usr/bin/env bash
# Launches the installed app on a physically connected iPhone and streams its
# console output, so a launch crash prints its actual reason instead of you
# hunting through Xcode.
#
#   npm run ios:crash
#
# Read-only with respect to the repo. Requires Xcode 15+ (xcrun devicectl).

set -uo pipefail
cd "$(dirname "$0")/.."

BUNDLE_ID="com.jongan69.listingos"
hdr() { printf '\n\033[1m── %s\033[0m\n' "$1"; }
inf() { printf '    %s\n' "$1"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$1"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$1"; }

command -v xcrun >/dev/null 2>&1 || { bad "xcrun not found. Install Xcode."; exit 1; }

hdr "Finding connected device"
# Parse the text table rather than the JSON: the State column is authoritative
# and its wording is stable, whereas the JSON connectionProperties schema
# varies between Xcode versions. Accept an explicit override too.
DEVICE_LIST="$(xcrun devicectl list devices 2>&1)"
UDID="${IOS_DEVICE_UDID:-}"

if [ -z "$UDID" ]; then
  # A physically attached device reports State "connected". Devices that are
  # merely "available (paired)" (over the network) or "unavailable" cannot be
  # launched on. Identifier is the 8-4-4-4-12 UUID on the row.
  UDID="$(printf '%s\n' "$DEVICE_LIST" \
    | grep -iE 'iPhone|iPad' \
    | grep -E '[[:space:]]connected([[:space:]]|$)' \
    | grep -oE '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}' \
    | head -1)"
fi

if [ -z "$UDID" ]; then
  bad "No attached iPhone in state 'connected'."
  inf "Unlock the phone and tap Trust This Computer, then re-run."
  inf "Or pass it explicitly:  IOS_DEVICE_UDID=<identifier> npm run ios:crash"
  printf '\n'
  printf '%s\n' "$DEVICE_LIST" | sed 's/^/      /'
  exit 1
fi
ok "Device $UDID"
printf '%s\n' "$DEVICE_LIST" | grep -F "$UDID" | sed 's/^/    /'

hdr "Launching $BUNDLE_ID with console attached"
inf "Watch for: a red JS stack, 'Fatal error', or an entitlement/codesign message."
inf "Ctrl+C when you have the error."
printf '\n'
xcrun devicectl device process launch \
  --device "$UDID" \
  --console \
  --terminate-existing \
  "$BUNDLE_ID" 2>&1 | sed 's/^/  /'

hdr "Recent crash reports on device"
outdir="./artifacts/ios-crash-$(date +%H%M%S)"
mkdir -p "$outdir"
if xcrun devicectl device copy from --device "$UDID" \
     --source /var/mobile/Library/Logs/CrashReporter \
     --destination "$outdir" >/dev/null 2>&1; then
  found="$(find "$outdir" -iname "*ListingOS*" 2>/dev/null | head -3)"
  if [ -n "$found" ]; then
    ok "Saved to $outdir"
    echo "$found" | while read -r f; do
      printf '\n  \033[1m%s\033[0m\n' "$(basename "$f")"
      grep -m1 -E "Exception Type|Termination Reason|Triggered by" "$f" 2>/dev/null | sed 's/^/    /'
    done
  else
    inf "No ListingOS crash report on device yet."
  fi
else
  inf "Could not copy crash reports (sandboxed on newer iOS)."
  inf "Use: Xcode -> Window -> Devices and Simulators -> View Device Logs"
fi
