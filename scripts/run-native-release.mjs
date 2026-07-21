import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const eas = JSON.parse(readFileSync(`${projectRoot}/eas.json`, "utf8"));
const platform = process.argv[2];

if (platform !== "android" && platform !== "ios") {
  throw new Error("Usage: node scripts/run-native-release.mjs <android|ios>");
}

const productionEnv = eas.build?.production?.env ?? {};
const requiredKey = platform === "android"
  ? "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY"
  : "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY";
const expectedPrefix = platform === "android" ? "goog_" : "appl_";

if (productionEnv.EXPO_PUBLIC_REVENUECAT_MODE !== "production") {
  throw new Error("The EAS production profile must select RevenueCat production mode.");
}
if (!String(productionEnv[requiredKey] ?? "").startsWith(expectedPrefix)) {
  throw new Error(`The EAS production profile is missing a valid ${requiredKey}.`);
}

const childEnv = { ...process.env };
childEnv.EXPO_NO_DOTENV = "1";
delete childEnv.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
delete childEnv.EXPO_PUBLIC_REVENUECAT_ALLOW_TEST_STORE_IN_RELEASE;
delete childEnv.EXPO_PUBLIC_REVENUECAT_PROD_API_KEY;
Object.assign(childEnv, productionEnv);
// Physical release installs are also our hardware-validation build. Keep the
// unverified Sony path out of the public EAS production profile while making it
// available for a directly connected camera bench test.
childEnv.EXPO_PUBLIC_SONY_REMOTE_ENABLED = "true";

const expoArgs = platform === "android"
  ? ["expo", "run:android", "--device", "--variant", "release"]
  : ["expo", "run:ios", "--device", "--configuration", "Release"];
const result = spawnSync("npx", expoArgs, {
  cwd: projectRoot,
  env: childEnv,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
