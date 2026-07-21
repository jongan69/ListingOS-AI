module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    proofModeEnabled: process.env.EXPO_PUBLIC_PROOF_MODE?.trim() === "true",
  },
});
