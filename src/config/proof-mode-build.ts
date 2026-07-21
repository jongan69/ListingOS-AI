import Constants from "expo-constants";

// Native builds may opt into a dedicated Proof Mode explicitly through the
// resolved Expo manifest. Web exposes proof fixtures alongside the live flow.
export const proofModeBuildEnabled = Constants.expoConfig?.extra?.proofModeEnabled === true;
