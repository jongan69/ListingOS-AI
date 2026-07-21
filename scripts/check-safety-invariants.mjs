import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${projectRoot}/${path}`, "utf8");
const readJson = (path) => JSON.parse(read(path));
const checks = [];

function assertInvariant(condition, message) {
  if (!condition) throw new Error(`Safety invariant failed: ${message}`);
  checks.push(message);
}

const appJson = readJson("app.json");
const dynamicAppConfig = read("app.config.js");
const packageJson = readJson("package.json");
const cameraPlugin = appJson.expo.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-camera",
);
assertInvariant(Boolean(cameraPlugin), "expo-camera remains explicitly configured");
assertInvariant(cameraPlugin[1]?.recordAudioAndroid === false, "photo capture does not request Android microphone access");
assertInvariant(cameraPlugin[1]?.barcodeScannerEnabled === false, "unused barcode native code remains disabled");
assertInvariant(packageJson.version === appJson.expo.version, "package and application versions stay aligned");
assertInvariant(
  /proofModeEnabled:\s*process\.env\.EXPO_PUBLIC_PROOF_MODE/.test(dynamicAppConfig),
  "Proof Mode is embedded in the resolved Expo manifest at build time",
);
assertInvariant(
  (appJson.expo.android.blockedPermissions ?? []).includes("android.permission.RECORD_AUDIO"),
  "Android release manifests explicitly remove microphone access",
);

const localWorkerExample = read(".dev.vars.example");
assertInvariant(/^EBAY_USE_SANDBOX=true$/m.test(localWorkerExample), "copied local Worker configuration targets eBay sandbox");
assertInvariant(/^REVENUECAT_WEBHOOK_SIGNING_SECRET=$/m.test(localWorkerExample), "RevenueCat HMAC secret has a server-only placeholder");
assertInvariant(/^MARKET_EMAIL_VERIFICATION_DEMO_CODE=$/m.test(localWorkerExample), "market demo verification is explicit and secret-backed");

const dashboard = read("src/screens/dashboard-screen.tsx");
const rootLayout = read("src/app/_layout.tsx");
const draftRoute = read("src/app/drafts/[draft-id].tsx");
const batchRoute = read("src/app/batches/[batch-id].tsx");
const marketFeedRoute = read("src/app/market/index.tsx");
const marketListingRoute = read("src/app/market/[slug].tsx");
const draftScreen = read("src/screens/draft-detail-screen.tsx");
const notifications = read("src/lib/notifications.ts");
const notificationNavigation = read("src/hooks/use-notification-navigation.ts");
const apiClient = read("src/lib/api.ts");
const appConfigSource = read("src/config/app.ts");
const webProofBuild = read("src/config/proof-mode-build.web.ts");
const contracts = read("src/shared/contracts.ts");
const worker = read("worker/index.ts");
assertInvariant(!/autoPublish\s*:\s*true/.test(dashboard), "capture intake never silently opts into live publishing");
assertInvariant(
  /if \(appConfig\.proofModeEnabled\) \{\s*return <ProofDashboardScreen footer=\{footer\} \/>;\s*\}/.test(dashboard),
  "Proof Mode mounts a dedicated dashboard instead of seller hooks",
);
assertInvariant(
  /return <AppProviders enableSellerLifecycle=\{false\} \/>;/.test(rootLayout)
    && /function SellerRootLayout\(\) \{\s*useNotificationNavigation\(\);/.test(rootLayout),
  "Proof Mode skips seller notification and query lifecycle effects",
);
assertInvariant(
  /export function configurePublishNotificationHandling\(\)/.test(notifications)
    && !/^Notifications\.setNotificationHandler\(/m.test(notifications)
    && /configurePublishNotificationHandling\(\);/.test(notificationNavigation),
  "push notification handling is configured only inside the seller lifecycle",
);
assertInvariant(
  /appConfig\.proofModeEnabled && !getProofScenario\(draftId\)/.test(draftRoute)
    && /const proofScenario = useMemo\(\(\) => getProofScenario\(draftId\), \[draftId\]\);/.test(draftScreen)
    && /const isProofMode = Boolean\(proofScenario\);/.test(draftScreen),
  "Fixture IDs remain non-mutating while dedicated Proof Mode rejects live draft IDs",
);
assertInvariant(
  [batchRoute, marketFeedRoute, marketListingRoute].every((source) => (
    /if \(appConfig\.proofModeEnabled\) \{\s*return <Redirect href="\/" \/>;\s*\}/.test(source)
  )),
  "Proof Mode redirects live batch and marketplace routes before their hooks mount",
);
assertInvariant(
  /function assertLiveApiAvailable\(\) \{\s*if \(!appConfig\.proofModeEnabled\) return;/.test(apiClient)
    && /async function requestJson<[\s\S]*?assertLiveApiAvailable\(\);/.test(apiClient)
    && /async uploadPreparedAsset[\s\S]*?assertLiveApiAvailable\(\);/.test(apiClient),
  "Proof Mode has a client-level fence against backend and upload requests",
);
assertInvariant(!/autoPublish\s*:\s*input\.autoPublish\s*\?\?\s*true/.test(apiClient), "API client does not default auto-publish on");
assertInvariant(
  /proofModeEnabled:\s*proofModeBuildEnabled/.test(appConfigSource)
    && /proofModeBuildEnabled\s*=\s*false/.test(webProofBuild)
    && /Platform\.OS === "web" \? \(\s*<ProofModeSection/.test(dashboard),
  "Web keeps the seller flow live while exposing fixture-backed Proof Mode",
);
assertInvariant(/autoPublish\s*:\s*input\.autoPublish\s*===\s*true/.test(apiClient), "API client requires explicit auto-publish opt-in");
assertInvariant(!/body\.autoPublish\s*!==\s*false/.test(worker), "Worker does not treat omitted auto-publish as consent");
assertInvariant(/autoPublish\s*=\s*body\.autoPublish\s*===\s*true/.test(worker), "Worker requires explicit auto-publish opt-in");
assertInvariant(/autoPublish:\s*z\.boolean\(\)\.default\(false\)/.test(contracts), "shared draft-job input defaults to review first");
assertInvariant(/if \(draft\.listingMode !== "fixed_price"\)/.test(worker), "Worker blocks unsupported listing modes before eBay mutation");
assertInvariant(!/format:\s*draft\.listingMode\s*===\s*"auction"/.test(worker), "Inventory offers cannot silently switch to auction format");
assertInvariant(!/["']111111["']/.test(worker), "Worker contains no universal buyer verification code");
assertInvariant(/`\$\{parsed\.timestamp\}\.\$\{rawBody\}`/.test(worker), "RevenueCat HMAC covers timestamp and raw body");
assertInvariant(worker.includes('app.get("/api/public/photos/:photoId"'), "public eBay photo delivery route remains available");

const storeConfig = read("store.config.json");
assertInvariant(!/marketplace,auction/.test(storeConfig), "store metadata does not advertise unsupported auction publishing");

console.log(`Safety invariants passed (${checks.length}).`);
