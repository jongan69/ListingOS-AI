#!/usr/bin/env bash
# Collects everything needed to diagnose an iOS install/launch failure.
#
#   npm run debug:ios
#
# Read-only. Changes nothing, deploys nothing.

set -uo pipefail
cd "$(dirname "$0")/.."

hdr() { printf '\n\033[1m── %s\033[0m\n' "$1"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$1"; }
inf() { printf '    %s\n' "$1"; }

hdr "App identity"
node -e '
const c=require("./app.json").expo;
console.log("    version        ", c.version);
console.log("    ios build      ", c.ios?.buildNumber);
console.log("    bundleId       ", c.ios?.bundleIdentifier);
console.log("    runtimeVersion ", JSON.stringify(c.runtimeVersion));
console.log("    updates.check  ", c.updates?.checkAutomatically);
'

hdr "Connected devices"
if command -v xcrun >/dev/null 2>&1; then
  xcrun xctrace list devices 2>/dev/null | sed -n '/^== Devices ==/,/^== /p' | grep -v "Simulator" | sed 's/^/    /' | head -12
else
  bad "xcrun not found — install Xcode command line tools"
fi

hdr "OTA updates on the production channel"
echo "  A bad JS bundle published here is downloaded and applied by TestFlight"
echo "  builds at launch. runtimeVersion is appVersion-based, so only updates"
echo "  matching the app version above are eligible."
# --non-interactive stops eas from prompting on a pipe (which hangs forever with
# no visible prompt); the timeout is a hard backstop. </dev/null closes stdin.
if command -v timeout >/dev/null 2>&1; then EAS_TIMEOUT="timeout 45"; else EAS_TIMEOUT=""; fi
$EAS_TIMEOUT npx eas-cli@latest update:list --branch production --limit 3 --non-interactive \
  </dev/null 2>/dev/null | sed 's/^/    /' \
  || inf "(skipped — run 'npx eas-cli@latest update:list --branch production' manually)"

hdr "Crash logs already on this Mac"
found=0
for dir in ~/Library/Logs/CrashReporter/MobileDevice ~/Library/Logs/DiagnosticReports; do
  [ -d "$dir" ] || continue
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    found=1
    echo
    ok "$(basename "$f")"
    # The first ~40 lines carry the exception type and the faulting frame,
    # which is nearly always enough to identify the cause.
    sed -n '1,40p' "$f" | sed 's/^/    /'
  done < <(find "$dir" -iname "*ListingOS*" -newermt "-2 days" 2>/dev/null | head -3)
done
[ "$found" -eq 0 ] && inf "No ListingOS crash logs from the last 2 days on this Mac."

cat <<'NEXT'

── If no crash log appeared above
   Plug in the device, then:
     Xcode → Window → Devices and Simulators → select device → View Device Logs
   Or open Console.app, select the device in the sidebar, filter on "ListingOS",
   and launch the app to capture the crash live.

── Send back
   1. The "Exception Type" and "Termination Reason" lines.
   2. The first 5 frames of the crashing thread.
   3. Whether the TestFlight build crashes on the FIRST launch or a LATER one.
      First launch  -> the build itself.
      Later launch  -> an OTA update was downloaded and applied. Different fix.
NEXT
