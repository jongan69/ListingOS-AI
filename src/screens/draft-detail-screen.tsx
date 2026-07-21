import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppButton } from "@/components/app-button";
import { AppGlass } from "@/components/app-glass";
import { AppScreen, AppTextInput } from "@/components/app-screen";
import { NativePickerField } from "@/components/native-picker-field";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { StatusPill } from "@/components/status-pill";
import { SurfaceCard } from "@/components/surface-card";
import { useToast } from "@/components/toast-provider";
import { StrategyControl } from "@/components/strategy-control";
import { appConfig } from "@/config/app";
import { brand } from "@/config/brand";
import { api, pricingStrategyLabel } from "@/lib/api";
import { buildListingOpportunityAudit, type ListingOpportunityAudit } from "@/lib/listing-opportunity";
import { getProofScenario } from "@/lib/proof-mode";
import { watchPublishedDraft } from "@/lib/publish-watch";
import { getSessionToken } from "@/lib/storage";
import {
  PricingStrategySchema,
  type ComparableListing,
  type DraftPayload,
  type PricingEvidence,
  type PublishResult,
  type PricingStrategy,
} from "@/shared/contracts";
import { type Palette } from "@/theme/palette";
import { useGradients, usePalette } from "@/theme/theme";

type SpecificRow = {
  id: string;
  name: string;
  value: string;
};

type DraftEditPatch = Partial<DraftPayload> & {
  category?: string;
  leadPhotoId?: string | null;
  photoOrderIds?: string[];
  manualPrice?: number;
  manualPriceStrategy?: PricingStrategy;
  clearManualPrice?: boolean;
  confirmManualReview?: boolean;
};

type ReviewReadiness = {
  eyebrow: string;
  title: string;
  subtitle: string;
  tone: "success" | "warning" | "danger" | "accent";
  checks: { label: string; passed: boolean }[];
};

export function DraftDetailScreen() {
  const palette = usePalette();
  const gradients = useGradients();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const params = useLocalSearchParams<{ "draft-id": string }>();
  const draftId = params["draft-id"];
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const apiBaseUrl = appConfig.apiBaseUrl;
  const proofScenario = useMemo(
    () => (appConfig.proofModeEnabled ? getProofScenario(draftId) : null),
    [draftId],
  );
  const isProofMode = Boolean(proofScenario);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [proofDraft, setProofDraft] = useState<DraftPayload | null>(proofScenario?.draft ?? null);
  const [proofListing, setProofListing] = useState<PublishResult | null>(proofScenario?.listing ?? null);
  const [selectedStrategy, setSelectedStrategy] = useState<PricingStrategy>("balanced");
  const selectedListingMode = "fixed_price" as const;
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedCategory, setEditedCategory] = useState("");
  const [editedCondition, setEditedCondition] = useState("");
  const [editedConditionNotes, setEditedConditionNotes] = useState("");
  const [manualPriceInput, setManualPriceInput] = useState("");
  const [manualPriceDirty, setManualPriceDirty] = useState(false);
  const [selectedLeadPhotoId, setSelectedLeadPhotoId] = useState<string | null>(null);
  const [photoOrderIds, setPhotoOrderIds] = useState<string[]>([]);
  const [draggingPhotoId, setDraggingPhotoId] = useState<string | null>(null);
  const [specificRows, setSpecificRows] = useState<SpecificRow[]>([]);
  const [blockerValues, setBlockerValues] = useState<Record<string, Record<string, string>>>({});
  const [hydratedDraftId, setHydratedDraftId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showSpecifics, setShowSpecifics] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [remixNotice, setRemixNotice] = useState<string | null>(null);
  const lastSavedSignatureRef = useRef("");

  useEffect(() => {
    void (async () => {
      setSessionToken(await getSessionToken());
    })();
  }, []);

  const apiContext = useMemo(() => ({ apiBaseUrl, sessionToken }), [apiBaseUrl, sessionToken]);
  const draftQueryKey = ["draft", apiBaseUrl, sessionToken, draftId] as const;
  const listingQueryKey = ["listing", apiBaseUrl, sessionToken, draftId] as const;

  const draftQuery = useQuery({
    queryKey: ["draft", apiBaseUrl, sessionToken, draftId],
    enabled: Boolean(!isProofMode && draftId && sessionToken),
    refetchInterval: (query) => query.state.data?.status === "publishing" ? 3_000 : false,
    queryFn: () => api.getDraft(apiContext, draftId!),
  });

  const listingQuery = useQuery({
    queryKey: ["listing", apiBaseUrl, sessionToken, draftId],
    enabled: Boolean(
      !isProofMode
      &&
      draftId
      && sessionToken
      && (
        draftQuery.data?.status === "publishing"
        || draftQuery.data?.status === "published"
        || draftQuery.data?.status === "failed"
        || draftQuery.data?.status === "blocked"
      ),
    ),
    refetchInterval: (query) => query.state.data?.status === "published" ? false : 3_000,
    queryFn: () => api.getListingResult(apiContext, draftId!),
  });

  const draft = isProofMode ? proofDraft : draftQuery.data;
  const listingResult = isProofMode ? proofListing : listingQuery.data;

  useEffect(() => {
    if (!draft || draft.draftId === hydratedDraftId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Server data intentionally hydrates this controlled form once per draft.
    setEditedTitle(draft.selectedTitle);
    setEditedDescription(draft.description);
    setEditedCategory(draft.categoryGuess.categoryPath ?? draft.categoryGuess.categoryName);
    setEditedCondition(draft.condition);
    setEditedConditionNotes(draft.conditionNotes);
    setSelectedStrategy(draft.pricing.recommendedStrategy);
    const orderedIds = normalizePhotoOrder(draft.photos, draft.photoOrderIds);
    setPhotoOrderIds(orderedIds);
    setSelectedLeadPhotoId(draft.leadPhotoId ?? orderedIds[0] ?? null);
    setManualPriceInput(draft.manualPriceOverride ? draft.manualPriceOverride.price.toFixed(2) : "");
    setManualPriceDirty(false);
    setSpecificRows(
      draft.itemSpecifics.map((specific, index) => ({
        id: `${specific.name}-${index}`,
        name: specific.name,
        value: specific.value,
      })),
    );
    lastSavedSignatureRef.current = JSON.stringify(patchFromDraft(draft));
    setHydratedDraftId(draft.draftId);
  }, [draft, hydratedDraftId]);

  function buildSpecificsPayload() {
    return specificRows
      .map((row) => ({
        name: row.name.trim(),
        value: row.value.trim(),
      }))
      .filter((row) => row.name && row.value);
  }

  function buildDraftPatch(): DraftEditPatch {
    const manualPrice = parseSellerPrice(manualPriceInput);
    const shouldSendManualPrice = manualPriceDirty || Boolean(draft?.manualPriceOverride);
    return {
      selectedTitle: editedTitle.trim() || draft?.selectedTitle,
      description: editedDescription.trim() || draft?.description,
      category: editedCategory.trim(),
      condition: editedCondition.trim() || draft?.condition,
      conditionNotes: editedConditionNotes.trim(),
      listingMode: selectedListingMode,
      itemSpecifics: buildSpecificsPayload(),
      leadPhotoId: photoOrderIds[0] ?? selectedLeadPhotoId,
      photoOrderIds,
      ...(shouldSendManualPrice && manualPrice ? {
        manualPrice,
        manualPriceStrategy: selectedStrategy,
        confirmManualReview: true,
      } : shouldSendManualPrice && !manualPrice ? {
        clearManualPrice: true,
      } : {}),
    };
  }

  function remixFromComparable(comparable: ComparableListing) {
    if (!draft || comparable.rejectionReason) return;
    const nextCondition = comparable.condition ?? (editedCondition || draft.condition);
    const nextTitle = createRemixedTitle(comparable, draft);
    setEditedTitle(nextTitle);
    setEditedCondition(nextCondition);
    setEditedDescription(createRemixedDescription({
      comparable,
      draft,
      title: nextTitle,
      condition: nextCondition,
    }));
    if (comparable.totalPrice && comparable.totalPrice > 0) {
      setManualPriceInput(comparable.totalPrice.toFixed(2));
      setManualPriceDirty(true);
    }
    setShowEditor(true);
    setRemixNotice(`Remixed from a ${comparable.source?.replaceAll("_", " ") ?? "market"} comp. Review the details, then publish.`);
  }

  const saveMutation = useMutation({
    mutationFn: async (patch: DraftEditPatch) => {
      if (isProofMode) {
        if (!proofDraft) throw new Error("Proof draft is unavailable.");
        const next = applyOptimisticDraftPatch(proofDraft, patch);
        setProofDraft(next);
        return next;
      }
      return api.patchDraft(apiContext, draftId!, patch);
    },
    onMutate: async (patch) => {
      setSaveError(null);
      if (isProofMode) {
        const previous = proofDraft;
        if (previous) setProofDraft(applyOptimisticDraftPatch(previous, patch));
        return { previous };
      }
      await queryClient.cancelQueries({ queryKey: draftQueryKey });
      const previous = queryClient.getQueryData<DraftPayload>(draftQueryKey);
      queryClient.setQueryData<DraftPayload>(draftQueryKey, (current) => current ? applyOptimisticDraftPatch(current, patch) : current);
      return { previous };
    },
    onSuccess: (draft, patch) => {
      lastSavedSignatureRef.current = JSON.stringify(patch);
      if (patch.manualPrice || patch.clearManualPrice) setManualPriceDirty(false);
      if (isProofMode) {
        setProofDraft(draft);
        return;
      }
      queryClient.setQueryData(draftQueryKey, draft);
    },
    onError: (error, patch, context) => {
      lastSavedSignatureRef.current = JSON.stringify(patch);
      if (isProofMode) {
        if (context?.previous) setProofDraft(context.previous);
      } else if (context?.previous) {
        queryClient.setQueryData(draftQueryKey, context.previous);
      }
      setSaveError(error instanceof Error ? error.message : "Your changes could not be saved.");
    },
  });

  const draftPatch = buildDraftPatch();
  const draftPatchSignature = JSON.stringify(draftPatch);
  const autosaveDraft = useEffectEvent((patchSignature: string) => {
    saveMutation.mutate(JSON.parse(patchSignature) as DraftEditPatch);
  });

  useEffect(() => {
    if (!draftId || hydratedDraftId !== draftId || !draft || saveMutation.isPending) return;
    if (draftPatchSignature === lastSavedSignatureRef.current) return;
    const timeout = setTimeout(() => autosaveDraft(draftPatchSignature), 750);
    return () => clearTimeout(timeout);
  }, [draft, draftId, draftPatchSignature, hydratedDraftId, saveMutation.isPending]);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (isProofMode) {
        if (!draft) throw new Error("Proof draft is unavailable.");
        const saved = applyOptimisticDraftPatch(draft, buildDraftPatch());
        const next = {
          ...saved,
          status: saved.blockers.length === 0 ? "ready" : saved.status,
        } as DraftPayload;
        setProofDraft(next);
        return next;
      }
      const saved = await api.patchDraft(apiContext, draftId!, buildDraftPatch());
      queryClient.setQueryData(draftQueryKey, saved);
      return api.verifyDraft(apiContext, draftId!);
    },
    onSuccess: (draft) => {
      if (isProofMode) {
        setProofDraft(draft);
        return;
      }
      queryClient.setQueryData(draftQueryKey, draft);
    },
    onError: async (error) => {
      if (!isProofMode) await draftQuery.refetch();
      Alert.alert("Verify needs attention", error instanceof Error ? error.message : "eBay returned a requirement to review.");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (blockerId: string) => {
      if (isProofMode) return blockerId;
      const draft = draftQuery.data!;
      const blocker = draft.blockers.find((item) => item.id === blockerId)!;
      const values = blockerValues[blockerId] ?? {};
      if (blocker.type === "missing_required_aspects") {
        await api.resolveBlocker(apiContext, blockerId, { values });
      } else if (blocker.type === "missing_inventory_location") {
        await api.resolveBlocker(apiContext, blockerId, values);
      } else {
        await api.resolveBlocker(apiContext, blockerId, { marketplaceId: draft.marketplaceId });
      }
    },
    onMutate: async (blockerId) => {
      if (isProofMode) {
        const previous = proofDraft;
        if (previous) {
          const nextBlockers = previous.blockers.filter((item) => item.id !== blockerId);
          setProofDraft({
            ...previous,
            blockers: nextBlockers,
            status: nextBlockers.length === 0 ? "ready" : previous.status,
          });
        }
        return { previous };
      }
      await queryClient.cancelQueries({ queryKey: draftQueryKey });
      const previous = queryClient.getQueryData<DraftPayload>(draftQueryKey);
      queryClient.setQueryData<DraftPayload>(draftQueryKey, (current) => current ? {
        ...current,
        blockers: current.blockers.filter((item) => item.id !== blockerId),
      } : current);
      return { previous };
    },
    onSuccess: async () => {
      if (isProofMode) {
        setRemixNotice("Proof mode applied the fix locally. In the live app, ListingOS would recheck eBay requirements before allowing publish.");
        return;
      }
      const refreshed = await api.verifyDraft(apiContext, draftId!);
      queryClient.setQueryData(draftQueryKey, refreshed);
      setSpecificRows(
        refreshed.itemSpecifics.map((specific, index) => ({
          id: `${specific.name}-${index}`,
          name: specific.name,
          value: specific.value,
        })),
      );
    },
    onError: (error, _blockerId, context) => {
      if (isProofMode) {
        if (context?.previous) setProofDraft(context.previous);
      } else if (context?.previous) {
        queryClient.setQueryData(draftQueryKey, context.previous);
      }
      Alert.alert("Could not apply that fix", error instanceof Error ? error.message : "Try again.");
    },
  });

  const [marketPublishUrl, setMarketPublishUrl] = useState<string | null>(null);

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (isProofMode) {
        throw new Error("Proof mode is intentionally non-mutating. Use the stored publish proof instead of sending a live eBay mutation.");
      }
      const saved = await api.patchDraft(apiContext, draftId!, buildDraftPatch());
      queryClient.setQueryData(draftQueryKey, saved);
      return api.publishDraft(apiContext, draftId!, {
        strategy: selectedStrategy,
        selectedTitle: editedTitle.trim(),
        listingMode: selectedListingMode,
      });
    },
    onMutate: async () => {
      if (isProofMode) return { previousDraft: proofDraft, previousListing: proofListing };
      await Promise.all([
        queryClient.cancelQueries({ queryKey: draftQueryKey }),
        queryClient.cancelQueries({ queryKey: listingQueryKey }),
      ]);
      const previousDraft = queryClient.getQueryData<DraftPayload>(draftQueryKey);
      const previousListing = queryClient.getQueryData(listingQueryKey);
      if (previousDraft) queryClient.setQueryData<DraftPayload>(draftQueryKey, { ...previousDraft, status: "publishing" });
      return { previousDraft, previousListing };
    },
    onSuccess: (result) => {
      if (isProofMode) return;
      queryClient.setQueryData(listingQueryKey, result);
      if (draftId && (result.status === "queued" || result.status === "publishing")) {
        watchPublishedDraft(draftId);
      }
      void Promise.all([
        draftQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["queue", apiBaseUrl, sessionToken] }),
      ]);
      router.replace("/");
    },
    onError: (error, _variables, context) => {
      if (isProofMode) {
        if (context?.previousDraft) setProofDraft(context.previousDraft as DraftPayload);
        if (context?.previousListing) setProofListing(context.previousListing as PublishResult | null);
      } else {
        if (context?.previousDraft) queryClient.setQueryData(draftQueryKey, context.previousDraft);
        if (context?.previousListing) queryClient.setQueryData(listingQueryKey, context.previousListing);
        void draftQuery.refetch();
      }
      showToast({
        title: "Could not start publish",
        message: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    },
  });
  const marketPublishMutation = useMutation({
    mutationFn: async () => {
      if (isProofMode) {
        throw new Error("Proof mode is intentionally non-mutating. Use the stored publish proof instead of sending a live ListingOS mutation.");
      }
      const saved = await api.patchDraft(apiContext, draftId!, buildDraftPatch());
      queryClient.setQueryData(draftQueryKey, saved);
      return api.publishMarketDraft(apiContext, draftId!, { destination: "listingos" });
    },
    onSuccess: (result) => {
      setMarketPublishUrl(result.publicUrl);
      showToast({
        title: "ListingOS listing published",
        message: "Your public marketplace draft is live and ready for buyers.",
        tone: "success",
      });
    },
    onError: (error) => {
      showToast({
        title: "Could not publish to ListingOS",
        message: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    },
  });

  const selectedPricing = draft?.pricing.options.find((option) => option.strategy === selectedStrategy);
  const pricingEvidence = draft?.pricingEvidence;
  const identity = draft?.identity;
  const acceptedComparables = useMemo(
    () => draft ? sortComparablesForRemix(draft.comparables).filter((comparable) => !comparable.rejectionReason).slice(0, 3) : [],
    [draft],
  );
  const rejectedComparables = useMemo(
    () => draft ? sortComparablesForRemix(draft.comparables).filter((comparable) => Boolean(comparable.rejectionReason)).slice(0, 3) : [],
    [draft],
  );
  const orderedPhotos = useMemo(() => draft ? orderPhotos(draft.photos, photoOrderIds) : [], [draft, photoOrderIds]);
  const manualPrice = parseSellerPrice(manualPriceInput);
  const persistedManualPrice = draft?.manualPriceOverride?.price ?? null;
  const sellerPrice = manualPrice ?? (!manualPriceDirty ? persistedManualPrice : null);
  const hasSellerPrice = Boolean(sellerPrice && sellerPrice > 0);
  const effectivePrice = sellerPrice ?? selectedPricing?.price ?? null;
  const heroPhoto = orderedPhotos.find((photo) => photo.id === selectedLeadPhotoId)?.url ?? orderedPhotos[0]?.url ?? null;
  const pricingLocked = Boolean(
    draft
    && selectedPricing
    && !hasSellerPrice
    && (
      selectedPricing.price <= 0
      || draft.pricing.rangeMedian <= 0
      || draft.blockers.some((blocker) => blocker.title.toLowerCase().includes("comps"))
    ),
  );
  const blockingOnlyNeedsManualReview = Boolean(
    draft?.blockers.length
    && draft.blockers.every((blocker) => blocker.title.toLowerCase().includes("comps"))
    && hasSellerPrice,
  );
  const canPublish = Boolean(
    draft
    && editedTitle.trim()
    && !pricingLocked
    && effectivePrice
    && effectivePrice > 0
    && !saveMutation.isPending
    && !verifyMutation.isPending
    && !resolveMutation.isPending
    && !publishMutation.isPending
    && !isProofMode
    && (draft.blockers.length === 0 || blockingOnlyNeedsManualReview)
    && draft.status !== "published"
    && draft.status !== "publishing",
  );
  const blockingReasonSummary = draft?.blockers.length
    ? `${draft.blockers.length} required fix${draft.blockers.length === 1 ? "" : "es"}`
    : "Ready for eBay";
  const publishedUrl = listingResult?.buyerFacingUrl;
  const publishing = Boolean(
    publishMutation.isPending
    || draft?.status === "publishing"
    || listingResult?.status === "queued"
    || listingResult?.status === "publishing",
  );
  const publishLabel = draft?.blockers.length && !blockingOnlyNeedsManualReview
    ? `Fix ${draft.blockers.length} required detail${draft.blockers.length === 1 ? "" : "s"} above`
    : pricingLocked
      ? "Confirm price before publishing"
      : isProofMode
        ? "Proof mode is read-only"
      : effectivePrice
      ? `Publish for $${effectivePrice.toFixed(2)}`
      : "Publish to eBay";
  const reviewReadiness = draft ? buildReviewReadiness({
    draft,
    pricingLocked,
    effectivePrice,
    hasSellerPrice,
    selectedLeadPhotoId,
    isProofMode,
  }) : null;
  const opportunityAudit = draft ? buildListingOpportunityAudit(draft, effectivePrice) : null;
  const footer = isProofMode ? (
    <AppButton label="Proof replay • no live changes" onPress={() => {}} disabled />
  ) : (
    <View style={styles.footerStack}>
      {marketPublishUrl ? (
        <AppButton
          label="Open ListingOS listing"
          accessibilityHint="Opens the public ListingOS marketplace listing"
          onPress={() => Linking.openURL(marketPublishUrl)}
        />
      ) : (
        <AppButton
          label={marketPublishMutation.isPending ? "Publishing to ListingOS..." : "Publish to ListingOS beta"}
          accessibilityHint="Publishes this draft to the ListingOS marketplace"
          onPress={() => marketPublishMutation.mutate()}
          loading={marketPublishMutation.isPending}
          tone="secondary"
        />
      )}
      {publishedUrl ? (
        <AppButton
          label="View live listing"
          accessibilityHint="Opens this listing on eBay"
          onPress={() => Linking.openURL(publishedUrl)}
        />
      ) : draft?.status === "published" ? (
        <AppButton label="Listing published" onPress={() => {}} disabled />
      ) : (
        <AppButton
          label={publishing ? "Publishing to eBay..." : publishLabel}
          accessibilityHint="Saves, verifies, and publishes this listing to eBay"
          onPress={() => publishMutation.mutate()}
          loading={publishing}
          disabled={!canPublish}
        />
      )}
    </View>
  );

  async function refreshDraft() {
    if (isProofMode) return;
    await Promise.allSettled([
      draftQuery.refetch(),
      listingQuery.refetch(),
    ]);
  }

  return (
    <AppScreen keyboardAware footer={draft ? footer : undefined} onRefresh={refreshDraft}>
        <ScreenToolbar title={`${brand.shortName} review`} onBack={() => router.back()} />
        {draftQuery.isError && !isProofMode ? (
          <SurfaceCard
            eyebrow="Could not load"
            title="Your draft is still safe"
            subtitle="The app could not reach the listing service. Check your connection and try again."
          >
            <AppButton label="Try again" onPress={async () => { await draftQuery.refetch(); }} />
          </SurfaceCard>
        ) : !draft ? (
          <SurfaceCard
            eyebrow="Draft"
            title="Opening your listing"
            subtitle="Loading the photos and AI recommendations."
          >
            <Text selectable style={styles.bodyText}>This should only take a moment.</Text>
          </SurfaceCard>
        ) : (
          <>
            <LinearGradient
              colors={gradients.hero as [string, string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <AppGlass intensity={55} style={styles.heroGlass}>
                <View style={styles.heroTop}>
                  <View style={styles.brandMini}>
                    <Image contentFit="cover" source={brand.mark} style={styles.brandMiniMark} transition={180} />
                  <StatusPill
                    label={isProofMode ? "proof replay" : draft.status.replaceAll("_", " ")}
                    tone={isProofMode ? "warning" : toneForDraftStatus(draft.status)}
                  />
                  </View>
                  <StatusPill label={`${Math.round(draft.confidence * 100)}% AI confidence`} tone="accent" />
                </View>
                {heroPhoto ? <Image contentFit="cover" source={{ uri: heroPhoto }} style={styles.heroPhoto} transition={220} /> : null}
                <View style={styles.heroCopy}>
                  <Text selectable style={styles.heroTitle}>{editedTitle || "AI listing draft"}</Text>
                  <Text selectable style={styles.heroSubtitle}>
                    {isProofMode
                      ? "Fixture-backed review only. Explore the trust gates without changing eBay."
                      : "ListingOS filled the details. Edit only what matters, then publish from this screen."}
                  </Text>
                </View>
                <View style={styles.heroStats}>
                  <StatBubble
                    value={pricingLocked ? "Unavailable" : effectivePrice ? `$${effectivePrice.toFixed(0)}` : "--"}
                    label={pricingStrategyLabel(selectedStrategy)}
                  />
                  <StatBubble value={selectedListingMode.replaceAll("_", " ")} label="mode" />
                  <StatBubble value={blockingReasonSummary} label="publish state" wide />
                </View>
                {orderedPhotos.length > 1 ? (
                  <PhotoOrderRail
                    photos={orderedPhotos}
                    activePhotoId={draggingPhotoId}
                    selectedLeadPhotoId={selectedLeadPhotoId ?? orderedPhotos[0]?.id ?? null}
                    onDragStateChange={setDraggingPhotoId}
                    onMovePhoto={(photoId, targetIndex) => {
                      setPhotoOrderIds((current) => {
                        const next = movePhotoId(normalizePhotoOrder(draft.photos, current), photoId, targetIndex);
                        setSelectedLeadPhotoId(next[0] ?? photoId);
                        return next;
                      });
                    }}
                    onSelectLead={(photoId) => {
                      setPhotoOrderIds((current) => {
                        const next = movePhotoId(normalizePhotoOrder(draft.photos, current), photoId, 0);
                        setSelectedLeadPhotoId(next[0] ?? photoId);
                        return next;
                      });
                    }}
                  />
                ) : null}
              </AppGlass>
            </LinearGradient>

            {isProofMode && proofScenario ? (
              <ProofModeCard
                badge={proofScenario.badge}
                title={proofScenario.title}
                judgeNote={proofScenario.judgeNote}
              />
            ) : null}

            {draft.blockers.length > 0 ? (
              <SurfaceCard
                eyebrow="Required"
                title="Fix these before publishing"
                subtitle="Only required eBay fixes are shown here. Each fix is checked automatically."
              >
                <View style={styles.blockerStack}>
                  {draft.blockers.map((blocker) => (
                    <View key={blocker.id} style={styles.blockerCard}>
                      <View style={styles.blockerHeader}>
                        <Text selectable style={styles.blockerTitle}>{blocker.title}</Text>
                        <StatusPill label="Required" tone="danger" />
                      </View>
                      <Text selectable style={styles.bodyText}>{blocker.description}</Text>
                      {Array.isArray(blocker.payload.requiredFields) ? blocker.payload.requiredFields.map((field) => {
                        const fieldKey = String(field);
                        const fieldLabels = blocker.payload.fieldLabels && typeof blocker.payload.fieldLabels === "object"
                          ? blocker.payload.fieldLabels as Record<string, unknown>
                          : {};
                        const fieldHints = blocker.payload.fieldHints && typeof blocker.payload.fieldHints === "object"
                          ? blocker.payload.fieldHints as Record<string, unknown>
                          : {};
                        const fieldLabel = String(fieldLabels[fieldKey] ?? fieldKey);
                        const fieldHint = fieldHints[fieldKey] ? String(fieldHints[fieldKey]) : null;
                        return (
                          <View key={`${blocker.id}:${fieldKey}`} style={styles.blockerField}>
                            <Text selectable style={styles.blockerFieldLabel}>{fieldLabel}</Text>
                            <AppTextInput
                              value={blockerValues[blocker.id]?.[fieldKey] ?? ""}
                              onChangeText={(value) => setBlockerValues((current) => ({
                                ...current,
                                [blocker.id]: {
                                  ...current[blocker.id],
                                  [fieldKey]: value,
                                },
                              }))}
                              placeholder={fieldLabel}
                              placeholderTextColor={palette.textSoft}
                              selectionColor={palette.cyan}
                              style={styles.blockerInput}
                            />
                            {fieldHint ? <Text selectable style={styles.blockerFieldHint}>{fieldHint}</Text> : null}
                          </View>
                        );
                      }) : null}
                      <AppButton
                        label="Apply fix"
                        tone="secondary"
                        onPress={() => resolveMutation.mutate(blocker.id)}
                        loading={resolveMutation.isPending && resolveMutation.variables === blocker.id}
                        disabled={resolveMutation.isPending}
                      />
                    </View>
                  ))}
                </View>
              </SurfaceCard>
            ) : null}

            {reviewReadiness ? <ReviewReadinessCard readiness={reviewReadiness} /> : null}
            {draft ? (
              <PricingTrustCard
                draft={draft}
                acceptedComparables={acceptedComparables}
                rejectedComparables={rejectedComparables}
                hasSellerPrice={hasSellerPrice}
              />
            ) : null}
            {opportunityAudit ? <OpportunityAuditCard audit={opportunityAudit} /> : null}

            <SurfaceCard
              eyebrow="Pricing"
              title="How quickly should it sell?"
              subtitle="Choose the goal. ListingOS adjusts the recommended price for speed or margin."
            >
              <StrategyControl
                value={selectedStrategy}
                onChange={(value) => setSelectedStrategy(PricingStrategySchema.parse(value))}
              />
              {selectedPricing ? (
                <LinearGradient
                  colors={gradients.warm as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pricingShell}
                >
                  <AppGlass intensity={60} style={styles.pricingCard}>
                    <Text selectable style={styles.priceValue}>
                      {hasSellerPrice && sellerPrice ? `$${sellerPrice.toFixed(2)}` : pricingLocked ? "Pricing unavailable" : `$${selectedPricing.price.toFixed(2)}`}
                    </Text>
                    <Text selectable style={styles.priceLabel}>
                      {hasSellerPrice ? "Seller-confirmed price" : pricingLocked ? "Needs trusted comps before publish" : selectedPricing.speedBand}
                    </Text>
                    <Text selectable style={styles.bodyText}>{selectedPricing.rationale}</Text>
                    {pricingLocked ? (
                      <Text selectable style={styles.helperText}>
                        ListingOS will not recommend a buyer-facing price until the identity and comparable listings are strong enough. Enter a positive seller-confirmed price to continue.
                      </Text>
                    ) : (
                      <Text selectable style={styles.helperText}>
                        Similar listings range from ${draft.pricing.rangeLow.toFixed(0)} to ${draft.pricing.rangeHigh.toFixed(0)}.
                      </Text>
                    )}
                    {pricingEvidence ? (
                      <View style={styles.evidenceCard}>
                        <StatusPill
                          label={pricingEvidence.exactMatchCount >= 2 ? "Image-verified comps" : "Needs comp check"}
                          tone={pricingEvidence.exactMatchCount >= 2 ? "success" : "warning"}
                        />
                        <Text selectable style={styles.evidenceText}>
                          {pricingEvidence.exactMatchCount} accepted · {pricingEvidence.rejectedCount} rejected · {Math.round(pricingEvidence.confidence * 100)}% pricing confidence
                        </Text>
                        {pricingEvidence.notes.slice(0, 2).map((note) => (
                          <Text key={note} selectable style={styles.evidenceNote}>{note}</Text>
                        ))}
                      </View>
                    ) : null}
                    <View style={styles.manualPricePanel}>
                      <View style={styles.manualPriceHeader}>
                        <View style={styles.manualPriceCopy}>
                          <Text selectable style={styles.manualPriceTitle}>Seller price</Text>
                          <Text selectable style={styles.helperText}>
                            Override only when you know the number. This is the price eBay will receive.
                          </Text>
                        </View>
                        {hasSellerPrice ? <StatusPill label="Confirmed" tone="success" /> : null}
                      </View>
                      <View style={styles.priceEditRow}>
                        <Text style={styles.currencySymbol}>$</Text>
                        <AppTextInput
                          value={manualPriceInput}
                          onChangeText={(value) => {
                            setManualPriceInput(value);
                            setManualPriceDirty(true);
                          }}
                          keyboardType="decimal-pad"
                          placeholder={selectedPricing.price > 0 ? selectedPricing.price.toFixed(2) : "Enter price"}
                          placeholderTextColor={palette.textSoft}
                          selectionColor={palette.cyan}
                          style={styles.priceInput}
                        />
                      </View>
                      <View style={styles.quickChipRow}>
                        {buildPriceShortcuts(draft, selectedPricing).map((shortcut) => (
                          <QuickChip
                            key={`${shortcut.label}:${shortcut.value}`}
                            label={shortcut.label}
                            onPress={() => {
                              setManualPriceInput(shortcut.value.toFixed(2));
                              setManualPriceDirty(true);
                            }}
                          />
                        ))}
                        {manualPriceInput ? (
                          <QuickChip
                            label="Clear"
                            tone="muted"
                            onPress={() => {
                              setManualPriceInput("");
                              setManualPriceDirty(true);
                            }}
                          />
                        ) : null}
                      </View>
                    </View>
                  </AppGlass>
                </LinearGradient>
              ) : null}
            </SurfaceCard>

            <SurfaceCard
              eyebrow="Ready to edit"
              title="Listing details"
              subtitle={`${editedCategory || "Category selected"} · ${editedCondition || "Condition selected"}`}
            >
              <Text selectable numberOfLines={2} style={styles.listingSummary}>{editedTitle}</Text>
              <AppButton
                label={showEditor ? "Done editing" : "Edit listing"}
                tone="secondary"
                onPress={() => setShowEditor((current) => !current)}
                accessibilityHint="Shows or hides title, category, condition, description, and listing format"
              />
              {showEditor ? (
                <View style={styles.editorStack}>
                  <View style={styles.autosaveRow}>
                    <Text selectable style={[styles.autosaveText, saveError ? styles.autosaveError : null]}>
                    {saveMutation.isPending ? "Saving..." : saveError ? "Changes not saved" : "Saved automatically"}
                    </Text>
                    {saveError ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Retry saving changes"
                        onPress={() => saveMutation.mutate(buildDraftPatch())}
                        hitSlop={10}
                      >
                        <Text style={styles.retryText}>Retry</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <FieldBlock label="Title">
                    <AppTextInput
                      value={editedTitle}
                      onChangeText={setEditedTitle}
                      style={styles.titleInput}
                      multiline
                      selectionColor={palette.cyan}
                      placeholder="Listing title"
                      placeholderTextColor={palette.textSoft}
                    />
                  </FieldBlock>
                  <View style={styles.fieldGrid}>
                    <FieldBlock label="Category">
                      <AppTextInput
                        value={editedCategory}
                        onChangeText={setEditedCategory}
                        style={styles.fieldInput}
                        selectionColor={palette.cyan}
                        placeholder="Category"
                        placeholderTextColor={palette.textSoft}
                      />
                    </FieldBlock>
                    <FieldBlock label="Condition">
                      <NativePickerField
                        label="Native condition picker"
                        value={editedCondition || "Used"}
                        onChange={setEditedCondition}
                        options={["New", "Used", "Pre-owned", "Open box", "PSA 10"].map((condition) => ({
                          label: condition,
                          value: condition,
                        }))}
                      />
                      <View style={styles.quickChipRow}>
                        {["New", "Used", "Pre-owned", "Open box", "PSA 10"].map((condition) => (
                          <QuickChip key={condition} label={condition} onPress={() => setEditedCondition(condition)} />
                        ))}
                      </View>
                    </FieldBlock>
                  </View>
                  <FieldBlock label="Condition notes">
                    <AppTextInput
                      value={editedConditionNotes}
                      onChangeText={setEditedConditionNotes}
                      multiline
                      style={styles.notesInput}
                      selectionColor={palette.cyan}
                      placeholder="Condition notes"
                      placeholderTextColor={palette.textSoft}
                    />
                  </FieldBlock>
                  <FieldBlock label="Description">
                    <AppTextInput
                      value={editedDescription}
                      onChangeText={setEditedDescription}
                      multiline
                      style={styles.descriptionInput}
                      selectionColor={palette.cyan}
                      placeholder="Description"
                      placeholderTextColor={palette.textSoft}
                    />
                  </FieldBlock>
                  <FieldBlock label="Listing format">
                    <View style={styles.fixedPriceFormat}>
                      <StatusPill label="Fixed price" tone="success" />
                      <Text selectable style={styles.helperText}>
                        Verified Inventory API publish path. Auction is intentionally unavailable until its adapter is implemented and proven.
                      </Text>
                    </View>
                  </FieldBlock>
                  <AppButton
                    label={verifyMutation.isPending ? "Checking with eBay..." : "Recheck eBay requirements"}
                    tone="secondary"
                    onPress={() => verifyMutation.mutate()}
                    loading={verifyMutation.isPending}
                  />
                </View>
              ) : null}

              <DisclosureRow
                title="Item specifics"
                meta={`${specificRows.length} detail${specificRows.length === 1 ? "" : "s"}`}
                expanded={showSpecifics}
                onPress={() => setShowSpecifics((current) => !current)}
              />
              {showSpecifics ? (
                <View style={styles.specificStack}>
                  {specificRows.map((row, index) => (
                    <View key={row.id} style={styles.specificRow}>
                      <AppTextInput
                        value={row.name}
                        onChangeText={(value) =>
                          setSpecificRows((current) =>
                            current.map((item, itemIndex) => itemIndex === index ? { ...item, name: value } : item),
                          )}
                        style={styles.specificNameInput}
                        selectionColor={palette.cyan}
                        placeholder="Detail name"
                        placeholderTextColor={palette.textSoft}
                      />
                      <AppTextInput
                        value={row.value}
                        onChangeText={(value) =>
                          setSpecificRows((current) =>
                            current.map((item, itemIndex) => itemIndex === index ? { ...item, value } : item),
                          )}
                        style={styles.specificValueInput}
                        selectionColor={palette.cyan}
                        placeholder="Value"
                        placeholderTextColor={palette.textSoft}
                      />
                    </View>
                  ))}
                  <AppButton
                    label="Add a detail"
                    tone="secondary"
                    onPress={() => setSpecificRows((current) => [
                      ...current,
                      { id: `specific-${current.length}-${Date.now()}`, name: "", value: "" },
                    ])}
                  />
                </View>
              ) : null}

              <DisclosureRow
                title="Why this draft"
                meta={`${Math.round(draft.confidence * 100)}% confidence`}
                expanded={showInsights}
                onPress={() => setShowInsights((current) => !current)}
              />
              {showInsights ? (
                <View style={styles.insightsStack}>
                  <View style={styles.infoRow}>
                    <InfoPanel label="Search" value={draft.searchQuery} />
                    <InfoPanel label="Confidence" value={`${Math.round(draft.confidence * 100)}%`} />
                    {identity ? (
                      <InfoPanel
                        label="Identity"
                        value={`${identity.status.replaceAll("_", " ")} · ${identity.source.replaceAll("_", " ")}`}
                      />
                    ) : null}
                  </View>
                  {identity && identity.vertical !== "general" ? (
                    <View style={styles.identityGrid}>
                      {[
                        ["Card", identity.fields.cardName],
                        ["Set", identity.fields.setName],
                        ["No.", identity.fields.cardNumber],
                        ["Grade", identity.fields.grade ? `${identity.fields.grader ?? ""} ${identity.fields.grade}`.trim() : null],
                        ["Cert", identity.fields.certNumber],
                      ].map(([label, value]) => value ? (
                        <InfoPanel key={String(label)} label={String(label)} value={String(value)} />
                      ) : null)}
                    </View>
                  ) : null}
                  <View style={styles.compsStack}>
                    {draft.comparables.slice(0, 5).map((comparable, index) => (
                      <View key={`${comparable.title}-${index}`} style={styles.compCard}>
                        <Text selectable style={styles.compTitle}>{comparable.title}</Text>
                        <Text selectable style={styles.compMeta}>
                          {comparable.condition ?? "Condition not specified"}{comparable.totalPrice ? ` · $${comparable.totalPrice.toFixed(2)}` : ""}
                          {typeof comparable.matchScore === "number" ? ` · ${Math.round(comparable.matchScore * 100)}% match` : ""}
                        </Text>
                        {comparable.rejectionReason ? (
                          <Text selectable style={styles.rejectedCompText}>Rejected: {comparable.rejectionReason}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </SurfaceCard>

            <ComparableRemixSection
              comparables={draft.comparables}
              onOpenComparable={(url) => Linking.openURL(url)}
              onRemix={remixFromComparable}
              remixNotice={remixNotice}
            />

            {listingResult ? (
              <SurfaceCard
                eyebrow="eBay"
                title={listingResult.status === "published"
                  ? isProofMode ? "Stored publish evidence" : "Your listing is live"
                  : listingResult.status === "failed"
                    ? "eBay stopped the publish"
                    : listingResult.status === "canceled"
                      ? "Publishing was canceled"
                      : "Publishing your listing"}
                subtitle={listingResult.message}
              >
                <View style={styles.publishState}>
                  <StatusPill label={listingResult.status} tone={toneForPublishStatus(listingResult.status)} />
                  {listingResult.status === "failed" ? (
                    <>
                      {listingResult.friendlyError && listingResult.friendlyError !== listingResult.message ? (
                        <Text selectable style={styles.bodyText}>{listingResult.friendlyError}</Text>
                      ) : null}
                      {listingResult.fixHint ? <Text selectable style={styles.blockerFieldHint}>{listingResult.fixHint}</Text> : null}
                      {listingResult.requiredFields?.length ? (
                        <View style={styles.failureFieldList}>
                          {listingResult.requiredFields.map((field) => (
                            <Text key={field} selectable style={styles.blockerFieldLabel}>
                              {listingResult.fieldLabels?.[field] ?? field}: {listingResult.fieldHints?.[field] ?? "Review this required value in the draft below."}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                      {!isProofMode ? (
                        <AppButton
                          label="Recheck eBay requirements"
                          tone="secondary"
                          onPress={() => verifyMutation.mutate()}
                          loading={verifyMutation.isPending}
                          disabled={verifyMutation.isPending}
                        />
                      ) : null}
                    </>
                  ) : null}
                  {listingResult.ebayListingId ? (
                    <Text selectable style={styles.helperText}>eBay listing {listingResult.ebayListingId}</Text>
                  ) : null}
                  {publishedUrl ? (
                    <AppButton
                      label={isProofMode ? "Open stored eBay evidence" : "View on eBay"}
                      tone="secondary"
                      accessibilityHint={isProofMode
                        ? "Opens the eBay listing referenced by this non-mutating proof fixture"
                        : "Opens this listing on eBay"}
                      onPress={() => Linking.openURL(publishedUrl)}
                    />
                  ) : null}
                </View>
              </SurfaceCard>
            ) : null}
          </>
        )}
    </AppScreen>
  );
}

function ReviewReadinessCard({ readiness }: { readiness: ReviewReadiness }) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <SurfaceCard
      eyebrow={readiness.eyebrow}
      title={readiness.title}
      subtitle={readiness.subtitle}
    >
      <View style={styles.readinessHeader}>
        <StatusPill label={readiness.tone === "success" ? "Auto-post eligible" : readiness.tone === "danger" ? "Action required" : "Review recommended"} tone={readiness.tone} />
      </View>
      <View style={styles.readinessGrid}>
        {readiness.checks.map((check) => (
          <View key={check.label} style={[styles.readinessCheck, check.passed ? styles.readinessCheckPassed : styles.readinessCheckOpen]}>
            <Text selectable style={styles.readinessCheckMark}>{check.passed ? "✓" : "!"}</Text>
            <Text selectable style={styles.readinessCheckText}>{check.label}</Text>
          </View>
        ))}
      </View>
    </SurfaceCard>
  );
}

function ProofModeCard({
  badge,
  title,
  judgeNote,
}: {
  badge: string;
  title: string;
  judgeNote: string;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <SurfaceCard
      eyebrow="Proof mode"
      title={title}
      subtitle="This replay is fixture-backed and intentionally non-mutating."
    >
      <View style={styles.proofModeHeader}>
        <StatusPill label={badge} tone="accent" />
        <StatusPill label="No live eBay mutation" tone="warning" />
      </View>
      <Text selectable style={styles.bodyText}>{judgeNote}</Text>
      <View style={styles.proofModeNote}>
        <Text selectable style={styles.proofModeNoteText}>
          Use this path to show judges the review, blocker, pricing, and publish-result surfaces without requiring seller OAuth or risking a real listing.
        </Text>
      </View>
    </SurfaceCard>
  );
}

function PricingTrustCard({
  draft,
  acceptedComparables,
  rejectedComparables,
  hasSellerPrice,
}: {
  draft: DraftPayload;
  acceptedComparables: ComparableListing[];
  rejectedComparables: ComparableListing[];
  hasSellerPrice: boolean;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const evidence = draft.pricingEvidence;
  const confidence = evidence ? Math.round(evidence.confidence * 100) : 0;
  const sourceLabel = evidence ? pricingEvidenceSourceLabel(evidence.source) : "Marketplace evidence";
  const trustedEvidence = (evidence?.exactMatchCount ?? 0) >= 2 || (evidence?.confidence ?? 0) >= 0.55;
  const trustLabel = hasSellerPrice
    ? "Seller-confirmed price"
    : trustedEvidence
      ? "Trusted pricing evidence"
      : "Review pricing before publish";
  const trustTone = hasSellerPrice ? "success" : trustedEvidence ? "success" : "warning";

  return (
    <SurfaceCard
      eyebrow="Pricing trust"
      title="Why ListingOS trusts or rejects this price"
      subtitle="This is the credibility layer: accepted comps, rejected comps, evidence source, and whether a seller override is carrying the final number."
    >
      <View style={styles.pricingTrustHeader}>
        <StatusPill label={trustLabel} tone={trustTone} />
        {evidence ? <StatusPill label={`${confidence}% confidence`} tone="accent" /> : null}
      </View>
      <View style={styles.pricingTrustGrid}>
        <InfoPanel label="Source" value={sourceLabel} />
        <InfoPanel label="Accepted" value={`${evidence?.exactMatchCount ?? acceptedComparables.length}`} />
        <InfoPanel label="Rejected" value={`${evidence?.rejectedCount ?? rejectedComparables.length}`} />
      </View>
      {evidence?.notes?.length ? (
        <View style={styles.pricingTrustNoteStack}>
          {evidence.notes.slice(0, 3).map((note) => (
            <Text key={note} selectable style={styles.evidenceNote}>- {note}</Text>
          ))}
        </View>
      ) : null}
      <View style={styles.pricingTrustLists}>
        <View style={[styles.pricingTrustColumn, styles.pricingTrustAcceptedColumn]}>
          <Text selectable style={styles.pricingTrustAcceptedTitle}>✓ Accepted for pricing</Text>
          {acceptedComparables.length > 0 ? acceptedComparables.map((comparable, index) => (
            <View key={`${comparable.title}-${index}`} style={styles.pricingTrustComp}>
              <Text selectable style={styles.compTitle}>{comparable.title}</Text>
              <Text selectable style={styles.compMeta}>
                {comparable.totalPrice ? `$${comparable.totalPrice.toFixed(2)}` : "No price"} · {comparableSourceLabel(comparable.source)}
              </Text>
            </View>
          )) : <Text selectable style={styles.helperText}>No trusted comps were accepted.</Text>}
        </View>
        <View style={[styles.pricingTrustColumn, styles.pricingTrustRejectedColumn]}>
          <Text selectable style={styles.pricingTrustRejectedTitle}>× Rejected from pricing</Text>
          {rejectedComparables.length > 0 ? rejectedComparables.map((comparable, index) => (
            <View key={`${comparable.title}-${index}`} style={styles.pricingTrustComp}>
              <Text selectable style={styles.compTitle}>{comparable.title}</Text>
              <Text selectable style={styles.rejectedCompText}>{comparable.rejectionReason ?? "Rejected by ListingOS pricing filters."}</Text>
            </View>
          )) : <Text selectable style={styles.helperText}>No rejected comps to show for this draft.</Text>}
        </View>
      </View>
    </SurfaceCard>
  );
}

function OpportunityAuditCard({ audit }: { audit: ListingOpportunityAudit }) {
  const tone = audit.priority === "ready" ? "success" : audit.priority === "needs_attention" ? "danger" : "warning";
  const priorityLabel = audit.priority === "ready"
    ? "High opportunity"
    : audit.priority === "needs_attention"
      ? "Fix before push"
      : "Improve next";
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <SurfaceCard
      eyebrow="Opportunity audit"
      title={`${audit.overall}/100 listing strength`}
      subtitle="Borrowed from the original ListingOS audit engine: deterministic evidence first, AI copy second."
    >
      <View style={styles.opportunityHeader}>
        <StatusPill label={priorityLabel} tone={tone} />
        <Text selectable style={styles.helperText}>Scores weigh search, media, content, trust, offer quality, and margin risk.</Text>
      </View>
      <View style={styles.scoreGrid}>
        {Object.entries(audit.scores).map(([label, value]) => (
          <View key={label} style={styles.scoreTile}>
            <Text selectable style={styles.scoreValue}>{value}</Text>
            <Text selectable style={styles.scoreLabel}>{label}</Text>
            <View style={styles.scoreTrack}>
              <View style={[styles.scoreFill, { width: `${value}%` }]} />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.auditEvidenceStack}>
        {audit.evidence.slice(0, 4).map((item) => (
          <Text key={item} selectable style={styles.evidenceNote}>- {item}</Text>
        ))}
        {audit.limitations.slice(0, 2).map((item) => (
          <Text key={item} selectable style={styles.auditLimitation}>- {item}</Text>
        ))}
      </View>
    </SurfaceCard>
  );
}

function ComparableRemixSection({
  comparables,
  remixNotice,
  onOpenComparable,
  onRemix,
}: {
  comparables: ComparableListing[];
  remixNotice: string | null;
  onOpenComparable: (url: string) => void;
  onRemix: (comparable: ComparableListing) => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const sortedComparables = sortComparablesForRemix(comparables).slice(0, 8);
  const usableCount = sortedComparables.filter((comparable) => !comparable.rejectionReason).length;

  return (
    <SurfaceCard
      eyebrow="Marketplace remix"
      title="Start from what already sells"
      subtitle="Use a strong comparable as a scaffold, then ListingOS rewrites it around your photos and keeps every field editable."
    >
      {remixNotice ? (
        <AppGlass intensity={62} style={styles.remixNotice}>
          <Text selectable style={styles.remixNoticeText}>{remixNotice}</Text>
        </AppGlass>
      ) : null}
      <View style={styles.remixHeaderRow}>
        <StatusPill label={`${usableCount} usable comp${usableCount === 1 ? "" : "s"}`} tone={usableCount > 0 ? "success" : "warning"} />
        <Text selectable style={styles.helperText}>Not a verbatim copy. It remixes title, condition, price, and buyer-safe copy.</Text>
      </View>
      {sortedComparables.length > 0 ? (
        <View style={styles.remixList}>
          {sortedComparables.map((comparable, index) => (
            <ComparableRemixCard
              key={`${comparable.itemId ?? (comparable.itemWebUrl || comparable.title)}-${index}`}
              comparable={comparable}
              onOpenComparable={onOpenComparable}
              onRemix={onRemix}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyCompState}>
          <Text selectable style={styles.emptyCompTitle}>No trusted comps yet</Text>
          <Text selectable style={styles.bodyText}>
            ListingOS will still let you publish with a seller-confirmed price, but remix templates appear once eBay search returns usable matches.
          </Text>
        </View>
      )}
    </SurfaceCard>
  );
}

function ComparableRemixCard({
  comparable,
  onOpenComparable,
  onRemix,
}: {
  comparable: ComparableListing;
  onOpenComparable: (url: string) => void;
  onRemix: (comparable: ComparableListing) => void;
}) {
  const palette = usePalette();
  const gradients = useGradients();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const usable = !comparable.rejectionReason;
  const matchLabel = typeof comparable.matchScore === "number" ? `${Math.round(comparable.matchScore * 100)}% match` : "Market comp";
  const sourceLabel = comparableSourceLabel(comparable.source);

  return (
    <AppGlass intensity={58} style={[styles.remixCard, !usable ? styles.remixCardRejected : null]}>
      <View style={styles.remixCardTop}>
        {comparable.imageUrl ? (
          <Image contentFit="cover" source={{ uri: comparable.imageUrl }} style={styles.remixImage} transition={180} />
        ) : (
          <LinearGradient
            colors={gradients.card as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.remixImagePlaceholder}
          >
            <Text style={styles.remixImageInitial}>e</Text>
          </LinearGradient>
        )}
        <View style={styles.remixCopy}>
          <View style={styles.remixPillRow}>
            <StatusPill label={usable ? sourceLabel : "Rejected"} tone={usable ? "accent" : "warning"} />
            <StatusPill label={matchLabel} tone={usable ? "success" : "neutral"} />
          </View>
          <Text selectable style={styles.remixTitle}>{comparable.title}</Text>
          <Text selectable style={styles.compMeta}>
            {comparable.condition ?? "Condition not specified"}{comparable.totalPrice ? ` · $${comparable.totalPrice.toFixed(2)}` : ""}
          </Text>
          {comparable.rejectionReason ? (
            <Text selectable style={styles.rejectedCompText}>Not used for pricing: {comparable.rejectionReason}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.remixActions}>
        <AppButton
          label={usable ? "Remix into draft" : "Not a match"}
          tone="secondary"
          onPress={() => onRemix(comparable)}
          disabled={!usable}
        />
        {comparable.itemWebUrl ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${sourceLabel} comparable listing`}
            onPress={() => onOpenComparable(comparable.itemWebUrl)}
            style={({ pressed }) => [styles.openComparableButton, pressed ? styles.openComparablePressed : null]}
          >
            <Text style={styles.openComparableText}>Open {sourceLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </AppGlass>
  );
}

function comparableSourceLabel(source: ComparableListing["source"]) {
  if (source === "offerup_active") return "OfferUp signal";
  if (source === "ebay_sold") return "eBay sold";
  if (source === "ebay_active") return "eBay active";
  if (source === "catalog") return "Catalog";
  return "Marketplace comp";
}

function pricingEvidenceSourceLabel(source: PricingEvidence["source"]) {
  if (source === "exact_ebay_active") return "Exact eBay active comps";
  if (source === "filtered_ebay_active") return "Filtered eBay active comps";
  if (source === "ebay_sold") return "eBay sold comps";
  if (source === "catalog") return "Catalog anchor";
  return "AI fallback";
}

function patchFromDraft(draft: DraftPayload): DraftEditPatch {
  return {
    selectedTitle: draft.selectedTitle,
    description: draft.description,
    category: draft.categoryGuess.categoryPath ?? draft.categoryGuess.categoryName,
    condition: draft.condition,
    conditionNotes: draft.conditionNotes,
    listingMode: draft.listingMode,
    itemSpecifics: draft.itemSpecifics,
    leadPhotoId: draft.leadPhotoId,
    photoOrderIds: normalizePhotoOrder(draft.photos, draft.photoOrderIds),
    ...(draft.manualPriceOverride ? {
      manualPrice: draft.manualPriceOverride.price,
      manualPriceStrategy: draft.manualPriceOverride.strategy,
      confirmManualReview: true,
    } : {}),
  };
}

function buildReviewReadiness({
  draft,
  pricingLocked,
  effectivePrice,
  hasSellerPrice,
  selectedLeadPhotoId,
  isProofMode,
}: {
  draft: DraftPayload;
  pricingLocked: boolean;
  effectivePrice: number | null;
  hasSellerPrice: boolean;
  selectedLeadPhotoId: string | null;
  isProofMode: boolean;
}): ReviewReadiness {
  const pricingEvidence = draft.pricingEvidence;
  const acceptedComps = pricingEvidence?.exactMatchCount ?? 0;
  const confidenceStrong = draft.confidence >= 0.82;
  const priceReady = Boolean(!pricingLocked && effectivePrice && effectivePrice > 0);
  const trustedPrice = hasSellerPrice || acceptedComps >= 2 || (pricingEvidence?.confidence ?? 0) >= 0.55;
  const hasLeadPhoto = Boolean(selectedLeadPhotoId || draft.leadPhotoId || draft.photos[0]);
  const noBlockers = draft.blockers.length === 0;
  const autoEligible = noBlockers && priceReady && trustedPrice && confidenceStrong && hasLeadPhoto;

  if (draft.status === "published") {
    return {
      eyebrow: isProofMode ? "Stored evidence" : "Live listing",
      title: isProofMode ? "Verified publish result on file" : "This item is already published",
      subtitle: isProofMode
        ? "This fixture replays evidence from the verified Android publish; opening it does not create or modify a listing."
        : "ListingOS has stored the eBay result and buyer-facing link when available.",
      tone: "success",
      checks: [
        { label: "Published to eBay", passed: true },
        { label: "Draft preserved", passed: true },
        { label: "Listing result tracked", passed: true },
      ],
    };
  }

  if (!noBlockers) {
    return {
      eyebrow: "Publish readiness",
      title: "eBay needs a concrete fix",
      subtitle: "Resolve the required fields below. ListingOS will recheck the draft without throwing away your edits.",
      tone: "danger",
      checks: [
        { label: "No eBay blockers", passed: false },
        { label: "Positive listing price", passed: priceReady },
        { label: "Lead photo selected", passed: hasLeadPhoto },
        { label: "Trusted pricing evidence", passed: trustedPrice },
      ],
    };
  }

  if (autoEligible) {
    return {
      eyebrow: "Publish readiness",
      title: "This draft is safe to publish fast",
      subtitle: "Confidence, photos, price, and eBay requirements are aligned. You can publish without more typing.",
      tone: "success",
      checks: [
        { label: `${Math.round(draft.confidence * 100)}% AI confidence`, passed: true },
        { label: hasSellerPrice ? "Seller-confirmed price" : `${acceptedComps} trusted eBay comp${acceptedComps === 1 ? "" : "s"}`, passed: true },
        { label: "Lead photo selected", passed: true },
        { label: "No eBay blockers", passed: true },
      ],
    };
  }

  return {
    eyebrow: "Publish readiness",
    title: pricingLocked ? "Confirm the price before listing" : "Review recommended before publishing",
    subtitle: pricingLocked
      ? "The item can still move forward, but ListingOS needs a seller-confirmed price because the market evidence is not strong enough."
      : "The draft is editable and close, but one or more confidence checks are below the auto-post bar.",
    tone: "warning",
    checks: [
      { label: `${Math.round(draft.confidence * 100)}% AI confidence`, passed: confidenceStrong },
      { label: "Positive listing price", passed: priceReady },
      { label: hasSellerPrice ? "Seller-confirmed price" : "Trusted eBay pricing evidence", passed: trustedPrice },
      { label: "Lead photo selected", passed: hasLeadPhoto },
    ],
  };
}

function sortComparablesForRemix(comparables: ComparableListing[]) {
  return [...comparables].sort((left, right) => {
    const leftRejected = left.rejectionReason ? 1 : 0;
    const rightRejected = right.rejectionReason ? 1 : 0;
    if (leftRejected !== rightRejected) return leftRejected - rightRejected;
    const leftScore = left.matchScore ?? 0;
    const rightScore = right.matchScore ?? 0;
    if (leftScore !== rightScore) return rightScore - leftScore;
    return (right.totalPrice ?? 0) - (left.totalPrice ?? 0);
  });
}

function createRemixedTitle(comparable: ComparableListing, draft: DraftPayload) {
  const sourceTitle = comparable.title.trim() || draft.selectedTitle;
  return sourceTitle.length <= 80 ? sourceTitle : `${sourceTitle.slice(0, 77).trim()}...`;
}

function createRemixedDescription({
  comparable,
  draft,
  title,
  condition,
}: {
  comparable: ComparableListing;
  draft: DraftPayload;
  title: string;
  condition: string;
}) {
  const priceLine = comparable.totalPrice
    ? `Priced against a similar eBay marketplace comp around $${comparable.totalPrice.toFixed(2)}.`
    : "Priced against similar eBay marketplace comps.";
  const existingNotes = draft.conditionNotes.trim();
  const specifics = draft.itemSpecifics
    .slice(0, 4)
    .map((specific) => `${specific.name}: ${specific.value}`)
    .join(" · ");

  return [
    `${title}`,
    "",
    `- Condition: ${condition || "See photos"}`,
    specifics ? `- Key details: ${specifics}` : null,
    `- ${priceLine}`,
    "- Includes only what is shown in the photos.",
    existingNotes ? `- Seller notes: ${existingNotes}` : null,
    "",
    "Please review all photos closely before purchasing. This description was remixed from marketplace signals and customized for the photographed item.",
  ].filter((line): line is string => line !== null).join("\n");
}

function applyOptimisticDraftPatch(draft: DraftPayload, patch: DraftEditPatch): DraftPayload {
  const category = patch.category?.trim();
  const photoOrderIds = patch.photoOrderIds ? normalizePhotoOrder(draft.photos, patch.photoOrderIds) : draft.photoOrderIds;
  const leadPhotoId = photoOrderIds[0] ?? patch.leadPhotoId ?? draft.leadPhotoId;
  const manualPriceOverride = patch.manualPrice && patch.manualPrice > 0
    ? {
      price: roundMoney(patch.manualPrice),
      strategy: patch.manualPriceStrategy ?? draft.pricing.recommendedStrategy,
      source: "seller" as const,
      updatedAt: new Date().toISOString(),
    }
    : patch.clearManualPrice
      ? null
      : draft.manualPriceOverride;
  const blockers = patch.confirmManualReview && manualPriceOverride
    ? draft.blockers.filter((blocker) => !blocker.title.toLowerCase().includes("comps"))
    : draft.blockers;
  return {
    ...draft,
    selectedTitle: patch.selectedTitle ?? draft.selectedTitle,
    description: patch.description ?? draft.description,
    condition: patch.condition ?? draft.condition,
    conditionNotes: patch.conditionNotes ?? draft.conditionNotes,
    listingMode: patch.listingMode ?? draft.listingMode,
    itemSpecifics: patch.itemSpecifics ?? draft.itemSpecifics,
    leadPhotoId,
    photoOrderIds,
    photos: orderPhotos(draft.photos, photoOrderIds),
    manualPriceOverride,
    blockers,
    status: patch.confirmManualReview && manualPriceOverride && blockers.length === 0 ? "ready" : draft.status,
    categoryGuess: category ? {
      ...draft.categoryGuess,
      categoryName: category,
      categoryPath: category,
    } : draft.categoryGuess,
  };
}

function parseSellerPrice(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? roundMoney(parsed) : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizePhotoOrder(photos: DraftPayload["photos"], orderIds: string[] = []) {
  const validIds = new Set(photos.map((photo) => photo.id));
  const ordered = orderIds.filter((id, index, array) => validIds.has(id) && array.indexOf(id) === index);
  return [
    ...ordered,
    ...photos.map((photo) => photo.id).filter((id) => !ordered.includes(id)),
  ];
}

function orderPhotos(photos: DraftPayload["photos"], orderIds: string[]) {
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  return normalizePhotoOrder(photos, orderIds)
    .map((id) => byId.get(id))
    .filter((photo): photo is DraftPayload["photos"][number] => Boolean(photo));
}

function movePhotoId(orderIds: string[], photoId: string, targetIndex: number) {
  const currentIndex = orderIds.indexOf(photoId);
  if (currentIndex < 0) return orderIds;
  const next = [...orderIds];
  const [removed] = next.splice(currentIndex, 1);
  next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, removed);
  return next;
}

function buildPriceShortcuts(draft: DraftPayload, selectedPricing: DraftPayload["pricing"]["options"][number]) {
  const candidates = [
    selectedPricing.price > 0 ? { label: "Use AI", value: selectedPricing.price } : null,
    draft.pricing.rangeLow > 0 ? { label: "Low", value: draft.pricing.rangeLow } : null,
    draft.pricing.rangeMedian > 0 ? { label: "Median", value: draft.pricing.rangeMedian } : null,
    draft.pricing.rangeHigh > 0 ? { label: "High", value: draft.pricing.rangeHigh } : null,
  ].filter((item): item is { label: string; value: number } => Boolean(item));
  const seen = new Set<string>();
  return candidates
    .map((item) => ({ ...item, value: roundMoney(item.value) }))
    .filter((item) => {
      const key = `${item.label}:${item.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function PhotoOrderRail({
  photos,
  selectedLeadPhotoId,
  activePhotoId,
  onDragStateChange,
  onMovePhoto,
  onSelectLead,
}: {
  photos: DraftPayload["photos"];
  selectedLeadPhotoId: string | null;
  activePhotoId: string | null;
  onDragStateChange: (photoId: string | null) => void;
  onMovePhoto: (photoId: string, targetIndex: number) => void;
  onSelectLead: (photoId: string) => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.photoRailShell}>
      <View style={styles.photoRailHeader}>
        <Text selectable style={styles.photoRailTitle}>Photo order</Text>
        <Text selectable style={styles.photoRailHint}>Hold and drag. Leftmost is main.</Text>
      </View>
      <ScrollView horizontal contentContainerStyle={styles.photoStrip} showsHorizontalScrollIndicator={false}>
        {photos.slice(0, 12).map((photo, index) => (
          <DraggablePhotoTile
            key={photo.id}
            photo={photo}
            index={index}
            total={photos.length}
            isLead={photo.id === selectedLeadPhotoId || index === 0}
            isActive={photo.id === activePhotoId}
            onDragStateChange={onDragStateChange}
            onMovePhoto={onMovePhoto}
            onSelectLead={onSelectLead}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function DraggablePhotoTile({
  photo,
  index,
  total,
  isLead,
  isActive,
  onDragStateChange,
  onMovePhoto,
  onSelectLead,
}: {
  photo: DraftPayload["photos"][number];
  index: number;
  total: number;
  isLead: boolean;
  isActive: boolean;
  onDragStateChange: (photoId: string | null) => void;
  onMovePhoto: (photoId: string, targetIndex: number) => void;
  onSelectLead: (photoId: string) => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [dragX] = useState(() => new Animated.Value(0));
  const startIndexRef = useRef(index);
  const activatedRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line react-hooks/refs -- PanResponder stores ref reads for gesture callbacks, not render output.
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 6,
    onPanResponderGrant: () => {
      startIndexRef.current = index;
      activatedRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        activatedRef.current = true;
        onDragStateChange(photo.id);
      }, 180);
    },
    onPanResponderMove: (_event, gesture) => {
      if (!activatedRef.current) return;
      dragX.setValue(gesture.dx);
      const targetIndex = Math.max(0, Math.min(total - 1, startIndexRef.current + Math.round(gesture.dx / 76)));
      onMovePhoto(photo.id, targetIndex);
    },
    onPanResponderRelease: (_event, gesture) => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (!activatedRef.current && Math.abs(gesture.dx) < 8) onSelectLead(photo.id);
      activatedRef.current = false;
      onDragStateChange(null);
      Animated.spring(dragX, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 8 }).start();
    },
    onPanResponderTerminate: () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      activatedRef.current = false;
      onDragStateChange(null);
      Animated.spring(dragX, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 8 }).start();
    },
  }), [dragX, index, onDragStateChange, onMovePhoto, onSelectLead, photo.id, total]);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.photoTile,
        isLead ? styles.photoTileLead : null,
        isActive ? styles.photoTileActive : null,
        { transform: [{ translateX: isActive ? dragX : 0 }, { scale: isActive ? 1.06 : 1 }] },
      ]}
    >
      <Image contentFit="cover" source={{ uri: photo.url }} style={styles.stripPhoto} transition={160} />
      {isLead ? <Text style={styles.leadBadge}>Main</Text> : null}
      <View style={styles.photoNudgeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Move photo left"
          disabled={index === 0}
          onPress={() => onMovePhoto(photo.id, index - 1)}
          style={[styles.photoNudgeButton, index === 0 ? styles.photoNudgeDisabled : null]}
        >
          <Text style={styles.photoNudgeText}>‹</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Move photo right"
          disabled={index === total - 1}
          onPress={() => onMovePhoto(photo.id, index + 1)}
          style={[styles.photoNudgeButton, index === total - 1 ? styles.photoNudgeDisabled : null]}
        >
          <Text style={styles.photoNudgeText}>›</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function QuickChip({ label, onPress, tone = "default" }: { label: string; onPress: () => void; tone?: "default" | "muted" }) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickChip,
        tone === "muted" ? styles.quickChipMuted : null,
        pressed ? styles.quickChipPressed : null,
      ]}
    >
      <Text style={styles.quickChipText}>{label}</Text>
    </Pressable>
  );
}

function DisclosureRow({
  title,
  meta,
  expanded,
  onPress,
}: {
  title: string;
  meta: string;
  expanded: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${expanded ? "Hide" : "Show"} ${title}`}
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [styles.disclosureRow, pressed ? styles.disclosurePressed : null]}
    >
      <View style={styles.disclosureCopy}>
        <Text style={styles.disclosureTitle}>{title}</Text>
        <Text style={styles.disclosureMeta}>{meta}</Text>
      </View>
      <Text style={styles.disclosureIcon}>{expanded ? "−" : "+"}</Text>
    </Pressable>
  );
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.fieldBlock}>
      <Text selectable style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function InfoPanel({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <AppGlass intensity={65} style={styles.infoPanel}>
      <Text selectable style={styles.infoLabel}>{label}</Text>
      <Text selectable style={styles.infoValue}>{value}</Text>
    </AppGlass>
  );
}

function StatBubble({ value, label, wide }: { value: string; label: string; wide?: boolean }) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <AppGlass intensity={60} style={[styles.statBubble, wide ? styles.statBubbleWide : null]}>
      <Text selectable style={styles.statValue}>{value}</Text>
      <Text selectable style={styles.statLabel}>{label}</Text>
    </AppGlass>
  );
}

function toneForDraftStatus(status: DraftPayload["status"]): "neutral" | "success" | "warning" | "danger" | "accent" {
  if (status === "ready" || status === "published") return "success";
  if (status === "blocked" || status === "failed") return "danger";
  if (status === "needs_input") return "warning";
  return "accent";
}

function toneForPublishStatus(status: string): "neutral" | "success" | "warning" | "danger" | "accent" {
  if (status === "published") return "success";
  if (status === "failed") return "danger";
  if (status === "queued" || status === "publishing") return "warning";
  return "accent";
}

const createStyles = (palette: Palette) => StyleSheet.create({
  hero: {
    borderRadius: 34,
    overflow: "hidden",
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: palette.borderStrong,
    boxShadow: `0 24px 80px ${palette.shadow}`,
  },
  heroGlass: {
    borderRadius: 34,
    borderCurve: "continuous",
    overflow: "hidden",
    padding: 20,
    gap: 16,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  brandMini: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  brandMiniMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
  heroPhoto: {
    width: "100%",
    aspectRatio: 1.15,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  heroCopy: {
    gap: 8,
  },
  heroTitle: {
    color: palette.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  heroStats: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  footerStack: {
    gap: 10,
  },
  statBubble: {
    minWidth: 96,
    borderRadius: 22,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statBubbleWide: {
    flex: 1,
  },
  statValue: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  statLabel: {
    color: palette.textSoft,
    fontSize: 12,
    marginTop: 3,
  },
  photoStrip: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
    paddingRight: 10,
  },
  photoRailShell: {
    gap: 10,
  },
  photoRailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  photoRailTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  photoRailHint: {
    color: palette.textSoft,
    fontSize: 12,
    flexShrink: 1,
    textAlign: "right",
  },
  photoTile: {
    width: 74,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 5,
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  photoTileLead: {
    borderColor: palette.gold,
    backgroundColor: "rgba(255,217,125,0.1)",
  },
  photoTileActive: {
    zIndex: 20,
    borderColor: palette.cyan,
    backgroundColor: "rgba(142,208,255,0.14)",
  },
  leadBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.64)",
    color: palette.gold,
    fontSize: 9,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  photoNudgeRow: {
    flexDirection: "row",
    gap: 4,
  },
  photoNudgeButton: {
    flex: 1,
    minHeight: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  photoNudgeDisabled: {
    opacity: 0.35,
  },
  photoNudgeText: {
    color: palette.text,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "800",
  },
  stripPhoto: {
    width: "100%",
    height: 62,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  helperText: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  listingSummary: {
    color: palette.text,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
  },
  editorStack: {
    gap: 14,
  },
  autosaveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 24,
  },
  autosaveText: {
    color: palette.green,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  autosaveError: {
    color: palette.rose,
  },
  retryText: {
    color: palette.cyan,
    fontSize: 13,
    fontWeight: "800",
  },
  titleInput: {
    backgroundColor: palette.cardStrong,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 24,
    borderCurve: "continuous",
    color: palette.text,
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 28,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  fieldGrid: {
    gap: 12,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  fieldInput: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 20,
    borderCurve: "continuous",
    color: palette.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  notesInput: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 20,
    borderCurve: "continuous",
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 90,
    textAlignVertical: "top",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  descriptionInput: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 24,
    borderCurve: "continuous",
    color: palette.text,
    fontSize: 15,
    lineHeight: 23,
    minHeight: 160,
    textAlignVertical: "top",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  pricingShell: {
    borderRadius: 28,
    overflow: "hidden",
    borderCurve: "continuous",
  },
  pricingCard: {
    borderRadius: 28,
    overflow: "hidden",
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 6,
  },
  priceValue: {
    color: palette.text,
    fontSize: 38,
    fontWeight: "800",
    lineHeight: 42,
  },
  priceLabel: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  manualPricePanel: {
    marginTop: 8,
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.18)",
    padding: 14,
    gap: 12,
  },
  manualPriceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  manualPriceCopy: {
    flex: 1,
    gap: 4,
  },
  manualPriceTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
  },
  priceEditRow: {
    minHeight: 58,
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  currencySymbol: {
    color: palette.gold,
    fontSize: 28,
    fontWeight: "900",
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    color: palette.text,
    fontSize: 28,
    fontWeight: "900",
    paddingVertical: 10,
  },
  quickChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(142,208,255,0.32)",
    backgroundColor: "rgba(142,208,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quickChipMuted: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  quickChipPressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: "rgba(142,208,255,0.18)",
  },
  quickChipText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "800",
  },
  specificStack: {
    gap: 10,
  },
  disclosureRow: {
    minHeight: 64,
    borderRadius: 22,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  disclosurePressed: {
    backgroundColor: "rgba(142,208,255,0.08)",
  },
  disclosureCopy: {
    flex: 1,
    gap: 3,
  },
  disclosureTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  disclosureMeta: {
    color: palette.textSoft,
    fontSize: 13,
  },
  disclosureIcon: {
    color: palette.cyan,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "500",
  },
  specificRow: {
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: palette.cardStrong,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    gap: 10,
  },
  specificNameInput: {
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.04)",
    color: palette.textSoft,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  specificValueInput: {
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.04)",
    color: palette.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  identityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  evidenceCard: {
    borderRadius: 22,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.14)",
    padding: 14,
    gap: 8,
  },
  evidenceText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  evidenceNote: {
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 17,
  },
  insightsStack: {
    gap: 12,
  },
  infoPanel: {
    flex: 1,
    minWidth: 140,
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 6,
  },
  infoLabel: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "600",
  },
  compsStack: {
    gap: 10,
  },
  readinessHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  readinessGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  readinessCheck: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 58,
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  readinessCheckPassed: {
    backgroundColor: "rgba(107,227,165,0.08)",
    borderColor: "rgba(107,227,165,0.20)",
  },
  readinessCheckOpen: {
    backgroundColor: "rgba(249,199,114,0.08)",
    borderColor: "rgba(249,199,114,0.20)",
  },
  readinessCheckMark: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
  },
  readinessCheckText: {
    color: palette.text,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  proofModeHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  proofModeNote: {
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(142,208,255,0.16)",
    backgroundColor: "rgba(142,208,255,0.08)",
    padding: 14,
  },
  proofModeNoteText: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  pricingTrustHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  pricingTrustGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  pricingTrustNoteStack: {
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.12)",
    padding: 14,
    gap: 6,
  },
  pricingTrustLists: {
    gap: 12,
  },
  pricingTrustColumn: {
    gap: 10,
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 12,
  },
  pricingTrustAcceptedColumn: {
    backgroundColor: "rgba(107,227,165,0.06)",
    borderColor: "rgba(107,227,165,0.18)",
  },
  pricingTrustRejectedColumn: {
    backgroundColor: "rgba(249,199,114,0.06)",
    borderColor: "rgba(249,199,114,0.18)",
  },
  pricingTrustAcceptedTitle: {
    color: palette.green,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  pricingTrustRejectedTitle: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  fixedPriceFormat: {
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(107,227,165,0.18)",
    backgroundColor: "rgba(107,227,165,0.06)",
    padding: 14,
    gap: 8,
  },
  pricingTrustComp: {
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    gap: 6,
  },
  opportunityHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  scoreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  scoreTile: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 96,
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.045)",
    padding: 12,
    gap: 7,
  },
  scoreValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "900",
  },
  scoreLabel: {
    color: palette.textSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  scoreTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  scoreFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.teal,
  },
  auditEvidenceStack: {
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.14)",
    padding: 14,
    gap: 6,
  },
  auditLimitation: {
    color: palette.gold,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  remixNotice: {
    overflow: "hidden",
    borderRadius: 22,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(102,225,209,0.22)",
    padding: 14,
  },
  remixNoticeText: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  remixHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  remixList: {
    gap: 12,
  },
  remixCard: {
    overflow: "hidden",
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(142,208,255,0.18)",
    padding: 14,
    gap: 12,
  },
  remixCardRejected: {
    opacity: 0.62,
    borderColor: "rgba(255,255,255,0.08)",
  },
  remixCardTop: {
    flexDirection: "row",
    gap: 12,
  },
  remixImage: {
    width: 82,
    height: 82,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  remixImagePlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  remixImageInitial: {
    color: palette.cyan,
    fontSize: 36,
    fontWeight: "900",
  },
  remixCopy: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  remixPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  remixTitle: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  remixActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  openComparableButton: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  openComparablePressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: "rgba(142,208,255,0.08)",
  },
  openComparableText: {
    color: palette.cyan,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyCompState: {
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 8,
  },
  emptyCompTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
  },
  compCard: {
    borderRadius: 22,
    borderCurve: "continuous",
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: palette.border,
    gap: 6,
  },
  compTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  compMeta: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  rejectedCompText: {
    color: palette.gold,
    fontSize: 12,
    lineHeight: 17,
  },
  blockerStack: {
    gap: 12,
  },
  blockerCard: {
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 16,
    backgroundColor: "rgba(243,154,177,0.06)",
    borderWidth: 1,
    borderColor: "rgba(243,154,177,0.18)",
    gap: 10,
  },
  blockerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  blockerTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },
  blockerField: {
    gap: 6,
  },
  blockerFieldLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "800",
  },
  blockerFieldHint: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  failureFieldList: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  blockerInput: {
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    color: palette.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  publishState: {
    gap: 10,
  },
});
