import type { ImageSourcePropType } from "react-native";

import listingOsLogo from "../../assets/icon.png";
import listingOsMark from "../../assets/listingos-mark.png";

export const brand = {
  name: "ListingOS",
  shortName: "ListingOS",
  tagline: "Photos in. Listing out.",
  description: "The camera-first AI listing machine for eBay sellers.",
  promise: "Shoot the item, review the AI draft, and publish without rebuilding the listing from scratch.",
  logo: listingOsLogo as ImageSourcePropType,
  mark: listingOsMark as ImageSourcePropType,
  links: {
    website: "https://listingos.expo.app",
    devpost: "https://devpost.com/software/listingos",
    github: "https://github.com/jongan69/ListingOS",
    support: "https://seller-ai-platform.jonathang132298.workers.dev/app-support",
    privacy: "https://seller-ai-platform.jonathang132298.workers.dev/privacy",
  },
} as const;
