const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      "dist/**",
      ".expo/**",
      ".wrangler/**",
      "android/**",
      "ios/**",
      "ListingOS-Hackathon-Demo-Assets/**",
    ],
  },
  {
    files: ["src/shared/contracts.ts"],
    // eslint-plugin-import cannot parse Zod v4's published JavaScript, so its
    // namespace rule reports valid helpers such as z.array as missing.
    rules: {
      "import/namespace": "off",
    },
  },
]);
