import { Asset } from "expo-asset";

import {
  DraftPayloadSchema,
  PublishResultSchema,
  type DraftPayload,
  type PublishResult,
} from "@/shared/contracts";

import proofCardBack from "../../assets/proof-mode/graded-card-back.jpg";
import proofCardFront from "../../assets/proof-mode/graded-card-front.jpg";
import proofEarbudsFront from "../../assets/proof-mode/earbuds-front.jpg";
import proofEarbudsOpen from "../../assets/proof-mode/earbuds-open.jpg";
import proofWalletFront from "../../assets/proof-mode/wallet-front.jpg";
import proofWalletOpen from "../../assets/proof-mode/wallet-open.jpg";
import proofWalletSide from "../../assets/proof-mode/wallet-side.jpg";

type ProofScenario = {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  judgeNote: string;
  draft: DraftPayload;
  listing: PublishResult | null;
};

const walletPhotos = [proofWalletFront, proofWalletOpen, proofWalletSide].map((source) => Asset.fromModule(source).uri);
const cardPhotos = [proofCardFront, proofCardBack].map((source) => Asset.fromModule(source).uri);
const earbudsPhotos = [proofEarbudsFront, proofEarbudsOpen].map((source) => Asset.fromModule(source).uri);

function photo(id: string, fileName: string, url: string) {
  return { id, fileName, url };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const proofScenarios: ProofScenario[] = [
  {
    id: "proof-general-published",
    badge: "Published proof",
    title: "Everyday item from photos to live listing",
    subtitle: "Judge-safe replay of a completed general-merchandise flow with trusted comps and a stored eBay publish result.",
    judgeNote: "This path is fixture-backed and non-mutating. It shows the exact review and publish surfaces without requiring a connected seller account.",
    draft: DraftPayloadSchema.parse({
      draftId: "proof-general-published",
      batchId: "proof-batch-general",
      marketplaceId: "EBAY_US",
      status: "published",
      listingMode: "fixed_price",
      photos: [
        photo("proof-general-1", "wallet-front.jpg", walletPhotos[0]),
        photo("proof-general-2", "wallet-open.jpg", walletPhotos[1]),
        photo("proof-general-3", "wallet-side.jpg", walletPhotos[2]),
      ],
      leadPhotoId: "proof-general-1",
      photoOrderIds: ["proof-general-1", "proof-general-2", "proof-general-3"],
      titleOptions: [
        { title: "Black Leather Zip Wallet with Money Clip", rationale: "The product photos show a compact black leather wallet with a zip edge and interior money clip." },
        { title: "Black Leather Card Wallet Red Stitching Money Clip", rationale: "Highlights the visible leather, red stitching, and money-clip form factor." },
      ],
      selectedTitle: "Black Leather Zip Wallet with Money Clip",
      searchQuery: "black leather zip wallet money clip red stitching",
      categoryGuess: {
        categoryId: "2996",
        categoryName: "Men's Wallets",
        categoryPath: "Clothing, Shoes & Accessories > Men > Men's Accessories > Wallets",
        confidence: 0.9,
      },
      condition: "Pre-owned",
      conditionNotes: "Light edge wear from normal use. Interior money clip and card pockets are intact.",
      description: "Pre-owned black leather zip wallet with red stitching, card pockets, and an interior money clip. Review all photos for exact condition.",
      confidence: 0.91,
      itemSpecifics: [
        { name: "Brand", value: "Unbranded" },
        { name: "Department", value: "Men" },
        { name: "Color", value: "Black" },
        { name: "Material", value: "Leather" },
      ],
      photoChecklist: [
        "Front cover is visible",
        "Interior money clip and card pockets are visible",
        "Overall wear is visible",
      ],
      missingInfo: [],
      enhancementPlan: [
        {
          type: "cropped",
          rationale: "Tighter cover crop would improve thumbnail readability.",
          sourcePhotoIds: ["proof-general-1"],
        },
      ],
      identity: {
        vertical: "general",
        source: "ai_vision",
        confidence: 0.88,
        status: "verified",
        canonicalTitle: "Black Leather Zip Wallet with Money Clip",
        searchQuery: "black leather zip wallet money clip red stitching",
        fields: {
          grader: null,
          certNumber: null,
          grade: null,
          game: null,
          cardName: null,
          setName: null,
          cardNumber: null,
          year: null,
          parallel: null,
          language: null,
        },
        warnings: [],
      },
      pricing: {
        sampleSize: 4,
        rangeLow: 14,
        rangeMedian: 18,
        rangeHigh: 24,
        recommendedStrategy: "balanced",
        options: [
          { strategy: "fast_sale", label: "Fast sale", price: 15.95, speedBand: "Quicker sell-through", rationale: "Undercuts the trusted cluster to move inventory faster." },
          { strategy: "balanced", label: "Balanced", price: 18.5, speedBand: "Best speed-margin mix", rationale: "Centers on the median of trusted active eBay comps." },
          { strategy: "max_profit", label: "Max profit", price: 23.95, speedBand: "Higher ask", rationale: "Leans toward the upper end of comparable active listings." },
        ],
      },
      listingStrategies: [
        { strategy: "fast_sale", listingMode: "fixed_price", rationale: "Maximize speed on a common item.", expectedSpeedBand: "Fast" },
        { strategy: "balanced", listingMode: "fixed_price", rationale: "Default recommendation for most sellers.", expectedSpeedBand: "Balanced" },
        { strategy: "max_profit", listingMode: "fixed_price", rationale: "Hold for a buyer willing to pay for condition and presentation.", expectedSpeedBand: "Slow" },
      ],
      pricingEvidence: {
        source: "exact_ebay_active",
        confidence: 0.84,
        exactMatchCount: 4,
        rejectedCount: 6,
        notes: [
          "Accepted only active eBay wallet comps with matching leather, zip edge, and money-clip form factor.",
          "Rejected bifold and clutch-style wallets because they distort buyer expectations.",
          "Seller can still override the price before publish.",
        ],
      },
      manualPriceOverride: null,
      comparables: [
        { itemId: "wallet-1", title: "Black Leather Zip Wallet with Money Clip", itemWebUrl: "https://www.ebay.com/itm/398187910808", imageUrl: walletPhotos[0], condition: "Pre-Owned", totalPrice: 17.99, matchScore: 0.93, source: "ebay_active" },
        { itemId: "wallet-2", title: "Leather Card Wallet with Interior Money Clip", itemWebUrl: "https://www.ebay.com/itm/398187910808", imageUrl: walletPhotos[1], condition: "Pre-Owned", totalPrice: 18.5, matchScore: 0.88, source: "ebay_active" },
        { itemId: "wallet-3", title: "Black Zip Wallet Red Stitching", itemWebUrl: "https://www.ebay.com/itm/398187910808", imageUrl: walletPhotos[2], condition: "Used", totalPrice: 15.0, matchScore: 0.82, source: "ebay_active" },
        { itemId: "wallet-4", title: "Compact Leather Wallet Money Clip", itemWebUrl: "https://www.ebay.com/itm/398187910808", imageUrl: walletPhotos[0], condition: "Pre-Owned", totalPrice: 23.0, matchScore: 0.79, source: "ebay_active" },
        { title: "Brown bifold wallet", itemWebUrl: "https://www.ebay.com/itm/398187910808", imageUrl: null, condition: "New", totalPrice: 35.0, matchScore: 0.35, rejectionReason: "Different closure, color, and buyer intent.", source: "ebay_active" },
        { title: "OfferUp local wallet listing", itemWebUrl: "https://offerup.com", imageUrl: null, condition: "Used", totalPrice: 12.0, matchScore: 0.41, rejectionReason: "OfferUp is seller context only, not trusted publish pricing.", source: "offerup_active" },
      ],
      blockers: [],
    }),
    listing: PublishResultSchema.parse({
      attemptId: "proof-attempt-general",
      draftId: "proof-general-published",
      status: "published",
      adapter: "inventory_api",
      ebayListingId: "398187910808",
      ebayOfferId: "proof-offer-general",
      buyerFacingUrl: "https://www.ebay.com/itm/398187910808",
      message: "Stored publish result from the verified Android run.",
      friendlyError: null,
      fixHint: null,
      ebayField: null,
      requiredFields: [],
      fieldLabels: {},
      fieldHints: {},
    }),
  },
  {
    id: "proof-graded-review",
    badge: "Trust gate",
    title: "Graded card flow that refuses weak pricing",
    subtitle: "Shows the high-precision path where ListingOS asks for confirmation instead of bluffing a buyer-facing price.",
    judgeNote: "This is the strongest proof that ListingOS is an agent with safety boundaries, not a generic listing chatbot.",
    draft: DraftPayloadSchema.parse({
      draftId: "proof-graded-review",
      batchId: "proof-batch-card",
      marketplaceId: "EBAY_US",
      status: "needs_input",
      listingMode: "fixed_price",
      photos: [
        photo("proof-card-1", "card-front.jpg", cardPhotos[0]),
        photo("proof-card-2", "card-back.jpg", cardPhotos[1]),
      ],
      leadPhotoId: "proof-card-1",
      photoOrderIds: ["proof-card-1", "proof-card-2"],
      titleOptions: [
        { title: "2023 Pokemon Wartortle #002 PSA 10 - review needed", rationale: "The slab label identifies Wartortle and a PSA 10 grade, but the exact set comp cluster is not safe yet." },
      ],
      selectedTitle: "2023 Pokemon Wartortle #002 PSA 10 - review needed",
      searchQuery: "2023 pokemon wartortle 002 psa 10",
      categoryGuess: {
        categoryId: "183454",
        categoryName: "CCG Individual Cards",
        categoryPath: "Toys & Hobbies > Collectible Card Games > CCG Individual Cards",
        confidence: 0.83,
      },
      condition: "LIKE_NEW",
      conditionNotes: "Professionally graded card in slab. Exact set and price require review.",
      description: "Graded trading card draft created from slab photos. ListingOS preserved the card path but intentionally stopped before trusting a buyer-facing price.",
      confidence: 0.78,
      itemSpecifics: [
        { name: "Game", value: "Pokemon TCG" },
        { name: "Graded", value: "Yes" },
        { name: "Professional Grader", value: "PSA" },
        { name: "Grade", value: "10" },
      ],
      photoChecklist: [
        "Front slab photo is visible",
        "Back slab photo is visible",
        "Label is partially readable",
      ],
      missingInfo: [
        "Confirm exact set and card number before publishing.",
      ],
      enhancementPlan: [],
      identity: {
        vertical: "graded_card",
        source: "psa_cert",
        confidence: 0.76,
        status: "needs_confirmation",
        canonicalTitle: "2023 Pokemon Wartortle #002 PSA 10",
        searchQuery: "2023 pokemon wartortle 002 psa 10",
        fields: {
          grader: "PSA",
          certNumber: "130078283",
          grade: "10",
          game: "Pokemon TCG",
          cardName: "Wartortle",
          setName: null,
          cardNumber: "002",
          year: "2023",
          parallel: null,
          language: null,
        },
        warnings: [
          "The slab label is readable, but exact set identity is not strong enough for pricing yet.",
        ],
      },
      pricing: {
        sampleSize: 0,
        rangeLow: 0,
        rangeMedian: 0,
        rangeHigh: 0,
        recommendedStrategy: "balanced",
        options: [
          { strategy: "fast_sale", label: "Fast sale", price: 0, speedBand: "Locked", rationale: "No trusted price until identity and comps are confirmed." },
          { strategy: "balanced", label: "Balanced", price: 0, speedBand: "Locked", rationale: "No trusted price until identity and comps are confirmed." },
          { strategy: "max_profit", label: "Max profit", price: 0, speedBand: "Locked", rationale: "No trusted price until identity and comps are confirmed." },
        ],
      },
      listingStrategies: [
        { strategy: "balanced", listingMode: "fixed_price", rationale: "Cards stay fixed-price until identity and evidence are strong.", expectedSpeedBand: "Review" },
      ],
      pricingEvidence: {
        source: "catalog",
        confidence: 0.22,
        exactMatchCount: 0,
        rejectedCount: 5,
        notes: [
          "ListingOS intentionally locked pricing because exact graded-card identity is not yet safe.",
          "Nearby Wartortle slabs were rejected because the set, grade, or label evidence did not line up strongly enough.",
          "A seller-confirmed price can still move the draft forward after review.",
        ],
      },
      manualPriceOverride: null,
      comparables: [
        { title: "Wartortle PSA 9 Pokemon 151", itemWebUrl: "https://www.ebay.com/itm/398187910808", imageUrl: cardPhotos[0], condition: "Graded", totalPrice: 72, matchScore: 0.48, rejectionReason: "Different grade and uncertain set match.", source: "ebay_active" },
        { title: "Wartortle PSA 10 Illustration Rare", itemWebUrl: "https://www.ebay.com/itm/398187910808", imageUrl: cardPhotos[1], condition: "Graded", totalPrice: 118, matchScore: 0.44, rejectionReason: "Label and set do not align strongly enough.", source: "ebay_active" },
        { title: "Pokemon slab local listing", itemWebUrl: "https://offerup.com", imageUrl: null, condition: "Graded", totalPrice: 300, matchScore: 0.39, rejectionReason: "OfferUp is context only and cannot unlock publish pricing.", source: "offerup_active" },
      ],
      blockers: [
        {
          id: "proof-card-blocker",
          type: "missing_required_aspects",
          status: "open",
          title: "Card identity or comps need confirmation",
          description: "Trading cards require exact set, card number, grader, grade, and matching comps before price can be trusted.",
          payload: {
            source: "proof_mode",
          },
        },
      ],
    }),
    listing: null,
  },
  {
    id: "proof-blocker-fix",
    badge: "Repair loop",
    title: "Blocker repair before publish",
    subtitle: "Shows how ListingOS turns raw eBay errors into a concrete fix path instead of dead-ending the seller.",
    judgeNote: "This is the exception-handling surface: one of the hardest parts of a real marketplace workflow.",
    draft: DraftPayloadSchema.parse({
      draftId: "proof-blocker-fix",
      batchId: "proof-batch-fix",
      marketplaceId: "EBAY_US",
      status: "blocked",
      listingMode: "fixed_price",
      photos: [
        photo("proof-fix-1", "earbuds-front.jpg", earbudsPhotos[0]),
        photo("proof-fix-2", "earbuds-open.jpg", earbudsPhotos[1]),
      ],
      leadPhotoId: "proof-fix-1",
      photoOrderIds: ["proof-fix-1", "proof-fix-2"],
      titleOptions: [
        { title: "White Wireless Earbuds with Charging Case", rationale: "General merchandise title is strong, but required item specifics need one more seller-confirmed input." },
      ],
      selectedTitle: "White Wireless Earbuds with Charging Case",
      searchQuery: "white wireless earbuds charging case",
      categoryGuess: {
        categoryId: "112529",
        categoryName: "Headphones",
        categoryPath: "Consumer Electronics > Portable Audio & Headphones > Headphones",
        confidence: 0.89,
      },
      condition: "Used",
      conditionNotes: "Cosmetic wear from normal use. Charging cable is not included unless shown.",
      description: "White wireless earbuds with charging case in used condition. Review photos for exact wear and included accessories.",
      confidence: 0.87,
      itemSpecifics: [
        { name: "Brand", value: "" },
        { name: "MPN", value: "" },
        { name: "Color", value: "White" },
        { name: "Connectivity", value: "Bluetooth" },
      ],
      photoChecklist: [
        "Front product shot is visible",
        "Earbuds and open charging case are visible",
      ],
      missingInfo: [],
      enhancementPlan: [],
      identity: {
        vertical: "general",
        source: "ai_vision",
        confidence: 0.85,
        status: "verified",
        canonicalTitle: "White Wireless Earbuds with Charging Case",
        searchQuery: "white wireless earbuds charging case",
        fields: {
          grader: null,
          certNumber: null,
          grade: null,
          game: null,
          cardName: null,
          setName: null,
          cardNumber: null,
          year: null,
          parallel: null,
          language: null,
        },
        warnings: [],
      },
      pricing: {
        sampleSize: 3,
        rangeLow: 29,
        rangeMedian: 35,
        rangeHigh: 42,
        recommendedStrategy: "balanced",
        options: [
          { strategy: "fast_sale", label: "Fast sale", price: 29.95, speedBand: "Quicker sell-through", rationale: "Undercuts the pack while preserving margin." },
          { strategy: "balanced", label: "Balanced", price: 34.95, speedBand: "Most likely to move", rationale: "Aligned to the middle of trusted active comps." },
          { strategy: "max_profit", label: "Max profit", price: 41.95, speedBand: "Higher ask", rationale: "Assumes the seller is willing to wait for a stronger buyer." },
        ],
      },
      listingStrategies: [
        { strategy: "balanced", listingMode: "fixed_price", rationale: "Default consumer-electronics path.", expectedSpeedBand: "Balanced" },
      ],
      pricingEvidence: {
        source: "filtered_ebay_active",
        confidence: 0.67,
        exactMatchCount: 2,
        rejectedCount: 4,
        notes: [
          "Pricing is strong enough to publish once the required eBay specifics are resolved.",
          "ListingOS separated the pricing problem from the required-field problem.",
        ],
      },
      manualPriceOverride: null,
      comparables: [
        { itemId: "earbuds-1", title: "White Bluetooth Earbuds with Charging Case", itemWebUrl: "https://www.ebay.com/itm/398187910808", imageUrl: earbudsPhotos[0], condition: "Used", totalPrice: 34.99, matchScore: 0.86, source: "ebay_active" },
        { itemId: "earbuds-2", title: "Wireless Earbuds Open Charging Case", itemWebUrl: "https://www.ebay.com/itm/398187910808", imageUrl: earbudsPhotos[1], condition: "Used", totalPrice: 31.0, matchScore: 0.78, source: "ebay_active" },
        { title: "Studio headphones wired", itemWebUrl: "https://www.ebay.com/itm/398187910808", imageUrl: null, condition: "Used", totalPrice: 48.0, matchScore: 0.33, rejectionReason: "Different form factor, connectivity, and buyer use case.", source: "ebay_active" },
      ],
      blockers: [
        {
          id: "proof-brand-mpn",
          type: "missing_required_aspects",
          status: "open",
          title: "eBay needs the item's brand and MPN",
          description: "BrandMPN is eBay's combined required field. ListingOS turns that raw rejection into the exact fields the seller must confirm.",
          payload: {
            requiredFields: ["Brand", "MPN"],
            fieldLabels: {
              Brand: "Brand",
              MPN: "MPN (manufacturer part number)",
            },
            fieldHints: {
              Brand: "Use the printed brand. Use Unbranded only when no brand is present.",
              MPN: "Use the printed manufacturer part number. Use Does not apply only when none exists.",
            },
          },
        },
      ],
    }),
    listing: PublishResultSchema.parse({
      attemptId: "proof-attempt-fix",
      draftId: "proof-blocker-fix",
      status: "failed",
      adapter: "inventory_api",
      ebayListingId: null,
      ebayOfferId: null,
      buyerFacingUrl: null,
      message: "eBay stopped the publish until Brand and MPN are confirmed.",
      friendlyError: "eBay needs the item's brand and MPN before it will accept this listing.",
      fixHint: "Fill the required values below, recheck requirements, then retry publish.",
      ebayField: "BrandMPN",
      requiredFields: ["Brand", "MPN"],
      fieldLabels: {
        Brand: "Brand",
        MPN: "MPN (manufacturer part number)",
      },
      fieldHints: {
        Brand: "Use the printed brand on the item or packaging.",
        MPN: "Use the printed part number, or Does not apply only when none exists.",
      },
    }),
  },
];

export function getProofScenario(id: string | null | undefined) {
  if (!id) return null;
  const scenario = proofScenarios.find((item) => item.id === id);
  if (!scenario) return null;
  return {
    ...scenario,
    draft: clone(scenario.draft),
    listing: scenario.listing ? clone(scenario.listing) : null,
  };
}

export const proofModeEntries = proofScenarios.map((scenario) => ({
  id: scenario.id,
  badge: scenario.badge,
  title: scenario.title,
  subtitle: scenario.subtitle,
}));
