import { z } from "zod";

export const ListingModeSchema = z.enum(["fixed_price", "auction"]);
export const PricingStrategySchema = z.enum(["fast_sale", "balanced", "max_profit"]);
export const CaptureSourceSchema = z.enum(["manual", "sony_monitor", "sony_remote"]);
export const VisionDetectionSchema = z.object({
  label: z.string(),
  confidence: z.number().min(0).max(1),
  bounds: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }),
});
export const VisionFrameContextSchema = z.object({
  modelVersion: z.string(),
  analyzedAt: z.string(),
  detections: z.array(VisionDetectionSchema).max(20).default([]),
  primaryObject: VisionDetectionSchema.nullable().default(null),
  inferenceMs: z.number().nonnegative(),
  quality: z.object({
    objectPresent: z.boolean(),
    objectCoverage: z.number().min(0).max(1),
    centered: z.boolean(),
    stableAcrossFrames: z.boolean(),
    qualityScore: z.number().min(0).max(1).default(0),
    blurScore: z.number().min(0).max(1).default(0),
    exposureScore: z.number().min(0).max(1).default(0),
    warnings: z.array(z.string()).max(6).default([]),
  }),
});
export type VisionDetection = z.infer<typeof VisionDetectionSchema>;
export type VisionFrameContext = z.infer<typeof VisionFrameContextSchema>;
export const DraftJobStatusSchema = z.enum([
  "queued",
  "processing",
  "needs_input",
  "ready",
  "blocked",
  "publishing",
  "published",
  "failed",
  "canceled",
]);
export const BatchStatusSchema = z.enum([
  "open",
  "uploading",
  "queued",
  "processing",
  "partial_ready",
  "complete",
  "failed",
]);
export const BlockerTypeSchema = z.enum([
  "missing_fulfillment_policy",
  "missing_payment_policy",
  "missing_return_policy",
  "missing_inventory_location",
  "missing_required_aspects",
  "low_confidence_product_match",
  "invalid_listing_mode",
  "missing_marketplace_setting",
]);
export const ImageVariantTypeSchema = z.enum([
  "original",
  "cropped",
  "thumbnail",
  "background_cleaned",
  "enhanced",
  "lead_photo",
]);

export const SessionUserSchema = z.object({
  userId: z.string(),
  sellerAccountId: z.string(),
  sellerUsername: z.string(),
  marketplaces: z.array(z.string()),
});

export const SessionStateSchema = z.object({
  status: z.enum(["pending", "complete", "failed"]),
  authSessionId: z.string(),
  sellerUsername: z.string().nullable().optional(),
  sessionToken: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});

export const UploadBatchSchema = z.object({
  id: z.string(),
  marketplaceId: z.string(),
  pricingStrategy: PricingStrategySchema,
  captureSource: CaptureSourceSchema.default("manual"),
  captureSessionId: z.string().nullable().default(null),
  captureDeviceModel: z.string().nullable().default(null),
  captureProfile: z.string().nullable().default(null),
  status: BatchStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CameraSessionCreateInputSchema = z.object({
  source: CaptureSourceSchema,
  batchId: z.string().nullable().optional(),
  deviceModel: z.string().nullable().optional(),
  profile: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const CameraSessionSchema = z.object({
  sessionId: z.string(),
  source: CaptureSourceSchema,
  batchId: z.string().nullable(),
  startedAt: z.string(),
  status: z.enum(["active", "closed", "error"]),
  deviceModel: z.string().nullable().default(null),
  profile: z.string().nullable().default(null),
});

export const UploadPhotoSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  objectKey: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().nullable(),
});

export const UploadInitResponseSchema = z.object({
  photoId: z.string(),
  objectKey: z.string(),
  uploadUrl: z.string(),
  uploadHeaders: z.record(z.string(), z.string()).default({}),
});

export const DraftPhotoSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  url: z.string(),
});

export const TitleOptionSchema = z.object({
  title: z.string(),
  rationale: z.string(),
});

export const ItemSpecificSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const PricingOptionSchema = z.object({
  strategy: PricingStrategySchema,
  label: z.string(),
  price: z.number(),
  speedBand: z.string(),
  rationale: z.string(),
});

export const ManualPriceOverrideSchema = z.object({
  price: z.number().positive(),
  strategy: PricingStrategySchema,
  source: z.literal("seller"),
  updatedAt: z.string(),
});

export const ComparableListingSchema = z.object({
  itemId: z.string().optional(),
  title: z.string(),
  itemWebUrl: z.string().default(""),
  imageUrl: z.string().nullable().default(null),
  condition: z.string().nullable().default(null),
  totalPrice: z.number().nullable().default(null),
  matchScore: z.number().optional(),
  rejectionReason: z.string().nullable().optional(),
  source: z.enum(["ebay_active", "ebay_sold", "catalog", "fallback", "offerup_active"]).optional(),
});

export const ImageEnhancementSchema = z.object({
  type: ImageVariantTypeSchema,
  rationale: z.string(),
  sourcePhotoIds: z.array(z.string()).default([]),
});

export const BlockerSchema = z.object({
  id: z.string(),
  type: BlockerTypeSchema,
  status: z.enum(["open", "resolved"]),
  title: z.string(),
  description: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const ProductIdentitySchema = z.object({
  vertical: z.enum(["general", "trading_card", "graded_card"]).default("general"),
  source: z.enum(["ai_vision", "ocr", "psa_cert", "pokemon_tcg_api", "manual", "unknown"]).default("unknown"),
  confidence: z.number().default(0),
  status: z.enum(["verified", "needs_confirmation", "unverified"]).default("unverified"),
  canonicalTitle: z.string().nullable().default(null),
  searchQuery: z.string().nullable().default(null),
  fields: z.object({
    grader: z.string().nullable().default(null),
    certNumber: z.string().nullable().default(null),
    grade: z.string().nullable().default(null),
    game: z.string().nullable().default(null),
    cardName: z.string().nullable().default(null),
    setName: z.string().nullable().default(null),
    cardNumber: z.string().nullable().default(null),
    year: z.string().nullable().default(null),
    parallel: z.string().nullable().default(null),
    language: z.string().nullable().default(null),
  }).default({
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
  }),
  warnings: z.array(z.string()).default([]),
});

export const PricingEvidenceSchema = z.object({
  source: z.enum(["exact_ebay_active", "filtered_ebay_active", "ebay_sold", "catalog", "ai_fallback"]).default("ai_fallback"),
  confidence: z.number().default(0),
  exactMatchCount: z.number().default(0),
  rejectedCount: z.number().default(0),
  notes: z.array(z.string()).default([]),
});

export const DraftPayloadSchema = z.object({
  draftId: z.string(),
  batchId: z.string(),
  marketplaceId: z.string(),
  status: z.enum(["ready", "needs_input", "blocked", "publishing", "published", "failed"]),
  listingMode: ListingModeSchema,
  photos: z.array(DraftPhotoSchema).default([]),
  leadPhotoId: z.string().nullable().default(null),
  photoOrderIds: z.array(z.string()).default([]),
  titleOptions: z.array(TitleOptionSchema).min(1),
  selectedTitle: z.string(),
  searchQuery: z.string(),
  categoryGuess: z.object({
    categoryId: z.string().nullable(),
    categoryName: z.string(),
    categoryPath: z.string().nullable(),
    confidence: z.number(),
  }),
  condition: z.string(),
  conditionNotes: z.string(),
  description: z.string(),
  confidence: z.number(),
  itemSpecifics: z.array(ItemSpecificSchema),
  photoChecklist: z.array(z.string()),
  missingInfo: z.array(z.string()),
  enhancementPlan: z.array(ImageEnhancementSchema),
  identity: ProductIdentitySchema.optional(),
  pricing: z.object({
    sampleSize: z.number(),
    rangeLow: z.number(),
    rangeMedian: z.number(),
    rangeHigh: z.number(),
    recommendedStrategy: PricingStrategySchema,
    options: z.array(PricingOptionSchema),
  }),
  listingStrategies: z.array(z.object({
    strategy: PricingStrategySchema,
    listingMode: ListingModeSchema,
    rationale: z.string(),
    expectedSpeedBand: z.string(),
  })),
  pricingEvidence: PricingEvidenceSchema.optional(),
  manualPriceOverride: ManualPriceOverrideSchema.nullable().default(null),
  comparables: z.array(ComparableListingSchema),
  blockers: z.array(BlockerSchema),
});

export const DraftJobSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  draftId: z.string().nullable(),
  marketplaceId: z.string(),
  clusterLabel: z.string().nullable(),
  pricingStrategy: PricingStrategySchema,
  listingMode: ListingModeSchema.nullable(),
  status: DraftJobStatusSchema,
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SellerReadinessSchema = z.object({
  marketplaceId: z.string(),
  sellerUsername: z.string(),
  publishReady: z.boolean(),
  counts: z.object({
    fulfillmentPolicies: z.number(),
    paymentPolicies: z.number(),
    returnPolicies: z.number(),
    inventoryLocations: z.number(),
  }),
  blockers: z.array(BlockerSchema),
});

export const PublishResultSchema = z.object({
  attemptId: z.string(),
  draftId: z.string(),
  status: z.enum(["queued", "publishing", "published", "failed", "canceled"]),
  adapter: z.string(),
  ebayListingId: z.string().nullable(),
  ebayOfferId: z.string().nullable(),
  buyerFacingUrl: z.string().nullable(),
  message: z.string(),
  friendlyError: z.string().nullable().optional(),
  fixHint: z.string().nullable().optional(),
  ebayField: z.string().nullable().optional(),
  requiredFields: z.array(z.string()).optional(),
  fieldLabels: z.record(z.string(), z.string()).optional(),
  fieldHints: z.record(z.string(), z.string()).optional(),
});

export const QueueItemStatusSchema = z.enum([
  "draft",
  "uploading",
  "queued",
  "processing",
  "ready_for_review",
  "publishing",
  "published",
  "failed",
  "canceled",
]);

export const QueueItemSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  jobId: z.string().nullable(),
  draftId: z.string().nullable(),
  title: z.string(),
  subtitle: z.string(),
  status: QueueItemStatusSchema,
  statusLabel: z.string(),
  progress: z.number().min(0).max(1),
  thumbnailUrl: z.string().nullable(),
  errorMessage: z.string().nullable(),
  buyerFacingUrl: z.string().nullable().default(null),
  updatedAt: z.string(),
  canOpen: z.boolean(),
  canCancel: z.boolean(),
  canRetry: z.boolean(),
});

export const PublishRequestSchema = z.object({
  strategy: PricingStrategySchema,
  selectedTitle: z.string().optional(),
  listingMode: ListingModeSchema.optional(),
  autoRepairAttempted: z.boolean().optional(),
  autoRepairNote: z.string().optional(),
});

export const PushTokenRegistrationSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(["android", "ios", "web", "unknown"]).default("unknown"),
  deviceName: z.string().nullable().optional(),
});

export const BillingPlanSchema = z.enum(["free", "starter", "pro", "studio"]);
export const BillingEnforcementModeSchema = z.enum(["observe", "enforce"]);
export const BillingSyncSourceSchema = z.enum(["revenuecat_sdk", "revenuecat_webhook", "revenuecat_rest", "manual", "fallback"]);

export const BillingUsageSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  includedCredits: z.number(),
  extraCredits: z.number(),
  usedCredits: z.number(),
  remainingCredits: z.number(),
  activeJobs: z.number().nonnegative(),
  maxActiveJobs: z.number().positive(),
});

export const BillingFeatureAccessSchema = z.object({
  canCreateDraft: z.boolean(),
  canAutoPublish: z.boolean(),
  canUseBulkQueue: z.boolean(),
  canUseAdvancedCardChecks: z.boolean(),
  enforcementMode: BillingEnforcementModeSchema,
  blockingReason: z.string().nullable(),
});

export const BillingSummarySchema = z.object({
  sellerAccountId: z.string(),
  appUserId: z.string(),
  plan: BillingPlanSchema,
  activeEntitlements: z.array(z.string()),
  subscriptionStatus: z.string(),
  source: BillingSyncSourceSchema,
  usage: BillingUsageSchema,
  featureAccess: BillingFeatureAccessSchema,
  managementUrl: z.string().nullable().default(null),
  updatedAt: z.string(),
});

export const BillingSyncRequestSchema = z.object({
  appUserId: z.string().min(3),
  source: BillingSyncSourceSchema.default("revenuecat_sdk"),
  activeEntitlements: z.array(z.string()).default([]),
  allEntitlements: z.record(z.string(), z.unknown()).default({}),
  subscriptionStatus: z.string().default("unknown"),
  managementUrl: z.string().nullable().optional(),
  customerInfo: z.unknown().optional(),
});

export const BillingEventSchema = z.object({
  eventName: z.string().min(2),
  trigger: z.string().nullable().optional(),
  plan: BillingPlanSchema.optional(),
  packageId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const RevenueCatWebhookTraceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  appUserId: z.string().optional(),
  eventType: z.string().optional(),
});

export const RevenueCatWebhookTraceItemSchema = z.object({
  traceId: z.string(),
  eventType: z.string(),
  eventId: z.string().nullable().default(null),
  appUserId: z.string(),
  customerId: z.string(),
  packageId: z.string().nullable(),
  timestamp: z.string(),
  receivedAt: z.string(),
  isPurchaseTransition: z.boolean(),
  isReplay: z.boolean().default(false),
  signatureVerified: z.boolean().default(false),
  signatureStatus: z.string().nullable().default(null),
  eventName: z.string(),
  source: z.string().default("revenuecat_webhook"),
  sellerAccountId: z.string().nullable(),
  eventPayload: z.record(z.string(), z.unknown()).optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
  rawType: z.string().nullable().default(null),
});

export const RevenueCatWebhookTraceResponseSchema = z.object({
  generatedAt: z.string(),
  traces: z.array(RevenueCatWebhookTraceItemSchema),
  limit: z.number().int().nonnegative(),
});

export type ListingMode = z.infer<typeof ListingModeSchema>;
export type PricingStrategy = z.infer<typeof PricingStrategySchema>;
export type DraftJobStatus = z.infer<typeof DraftJobStatusSchema>;
export type QueueItemStatus = z.infer<typeof QueueItemStatusSchema>;
export type BatchStatus = z.infer<typeof BatchStatusSchema>;
export type BlockerType = z.infer<typeof BlockerTypeSchema>;
export type ImageVariantType = z.infer<typeof ImageVariantTypeSchema>;
export type SessionUser = z.infer<typeof SessionUserSchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
export type UploadBatch = z.infer<typeof UploadBatchSchema>;
export type UploadPhoto = z.infer<typeof UploadPhotoSchema>;
export type UploadInitResponse = z.infer<typeof UploadInitResponseSchema>;
export type DraftPhoto = z.infer<typeof DraftPhotoSchema>;
export type DraftPayload = z.infer<typeof DraftPayloadSchema>;
export type ComparableListing = z.infer<typeof ComparableListingSchema>;
export type ProductIdentity = z.infer<typeof ProductIdentitySchema>;
export type PricingEvidence = z.infer<typeof PricingEvidenceSchema>;
export type DraftJob = z.infer<typeof DraftJobSchema>;
export type SellerReadiness = z.infer<typeof SellerReadinessSchema>;
export type PublishRequest = z.infer<typeof PublishRequestSchema>;
export type PublishResult = z.infer<typeof PublishResultSchema>;
export type QueueItem = z.infer<typeof QueueItemSchema>;
export type PushTokenRegistration = z.infer<typeof PushTokenRegistrationSchema>;
export type CaptureSource = z.infer<typeof CaptureSourceSchema>;
export type BillingPlan = z.infer<typeof BillingPlanSchema>;
export type BillingSummary = z.infer<typeof BillingSummarySchema>;
export type BillingSyncRequest = z.infer<typeof BillingSyncRequestSchema>;
export type BillingEvent = z.infer<typeof BillingEventSchema>;
export type BillingSyncRequestInput = z.input<typeof BillingSyncRequestSchema>;
export type BillingEventInput = z.input<typeof BillingEventSchema>;
export type RevenueCatWebhookTraceQuery = z.input<typeof RevenueCatWebhookTraceQuerySchema>;
export type RevenueCatWebhookTraceItem = z.infer<typeof RevenueCatWebhookTraceItemSchema>;
export type RevenueCatWebhookTraceResponse = z.infer<typeof RevenueCatWebhookTraceResponseSchema>;
export type CameraSessionCreateInput = z.input<typeof CameraSessionCreateInputSchema>;
export type CameraSession = z.infer<typeof CameraSessionSchema>;
