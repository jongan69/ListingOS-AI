import type { BillingPlan } from "@/shared/contracts";

export const billingPlans: Record<BillingPlan, {
  title: string;
  monthlyPrice: string;
  annualPrice: string;
  includedCredits: number;
  description: string;
  benefits: string[];
}> = {
  free: {
    title: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    includedCredits: 20,
    description: "A generous way to build a real listing habit before paying.",
    benefits: ["20 AI listings per month", "Full manual review and publish", "Card and marketplace safety checks"],
  },
  starter: {
    title: "Starter",
    monthlyPrice: "$14.99/mo",
    annualPrice: "$149.99/yr",
    includedCredits: 75,
    description: "For casual sellers who list a few real items every week.",
    benefits: ["75 AI listings per month", "Autopublish when confidence is high", "Faster queue concurrency"],
  },
  pro: {
    title: "Pro",
    monthlyPrice: "$49.99/mo",
    annualPrice: "$499.99/yr",
    includedCredits: 300,
    description: "For active resellers using ListingOS as a daily listing machine.",
    benefits: ["300 AI listings per month", "Multi-product bulk queue", "Priority processing envelope"],
  },
  studio: {
    title: "Studio",
    monthlyPrice: "$149.99/mo",
    annualPrice: "$1,499.99/yr",
    includedCredits: 1000,
    description: "For shops and teams processing inventory at scale.",
    benefits: ["1,000 AI listings per month", "High-volume queue", "Team-scale concurrency"],
  },
};

export const revenueCatProductIds = {
  starterMonthly: "listingos_starter_monthly",
  starterAnnual: "listingos_starter_annual",
  proMonthly: "listingos_pro_monthly",
  proAnnual: "listingos_pro_annual",
  studioMonthly: "listingos_studio_monthly",
  studioAnnual: "listingos_studio_annual",
} as const;

export const revenueCatEntitlements = ["starter", "pro", "studio"] as const;
