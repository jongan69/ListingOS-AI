const { withAndroidManifest } = require("@expo/config-plugins");

function withBillingPermission(manifestConfig) {
  return withAndroidManifest(manifestConfig, (config) => {
    const manifest = config.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] ?? [];

    const hasBillingPermission = manifest["uses-permission"].some((permission) =>
      permission?.$?.["android:name"] === "com.android.vending.BILLING");
    if (!hasBillingPermission) {
      manifest["uses-permission"].push({
        $: {
          "android:name": "com.android.vending.BILLING",
        },
      });
    }

    const applications = manifest.application ?? [];
    const mainApplication = applications[0];
    const activities = mainApplication?.activity ?? [];
    const mainActivity = activities.find((activity) =>
      activity?.$?.["android:name"] === ".MainActivity"
    );
    if (mainActivity?.$ && mainActivity.$["android:launchMode"] !== "singleTop") {
      mainActivity.$["android:launchMode"] = "singleTop";
    }

    return config;
  });
}

module.exports = withBillingPermission;

