const fs = require("node:fs");

const androidGoogleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";
const iosGoogleServicesFile = "./GoogleService-Info.plist";
const apsEnvironment = process.env.LISTINGOS_APS_ENVIRONMENT === "production" ? "production" : "development";

function withExistingFile(config, platform, key, filePath) {
  if (!fs.existsSync(filePath)) return config;
  return {
    ...config,
    [platform]: {
      ...(config[platform] ?? {}),
      [key]: filePath,
    },
  };
}

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

module.exports = ({ config: baseConfig }) => {
  let config = {
    ...baseConfig,
    ios: {
      ...(baseConfig.ios ?? {}),
      entitlements: {
        ...(baseConfig.ios?.entitlements ?? {}),
        "aps-environment": apsEnvironment,
      },
    },
    plugins: [
      ...(baseConfig.plugins ?? []).filter((plugin) => pluginName(plugin) !== "expo-notifications"),
      [
        "expo-notifications",
        {
          defaultChannel: "publishing",
          color: "#66E1D1",
        },
      ],
    ],
  };

  config = withExistingFile(config, "android", "googleServicesFile", androidGoogleServicesFile);
  config = withExistingFile(config, "ios", "googleServicesFile", iosGoogleServicesFile);

  return config;
};
