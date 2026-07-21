import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppButton } from "@/components/app-button";
import { AppGlass } from "@/components/app-glass";
import { AppScreen } from "@/components/app-screen";
import { BillingCard, PaywallPanel } from "@/components/billing-card";
import { CameraFirstSurface } from "@/components/camera-first-surface";
import { ProofModeSection } from "@/components/proof-mode-section";
import { StatusPill } from "@/components/status-pill";
import { SurfaceCard } from "@/components/surface-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/components/toast-provider";
import { StrategyControl } from "@/components/strategy-control";
import { appConfig } from "@/config/app";
import { brand } from "@/config/brand";
import { api } from "@/lib/api";
import {
  captureModeLabel,
  captureModeSupportsAutoImport,
  collectPhotosForListing,
  photoImportRecoveryMessage,
} from "@/lib/camera/capture";
import { confirmHaptic, tapHaptic } from "@/lib/haptics";
import {
  notificationFailureReason,
  publishNotificationFailureMessage,
  registerPublishNotifications,
  type PublishNotificationPermissionState,
} from "@/lib/notifications";
import { analyzePhotoSelection, type PhotoQualityReport } from "@/lib/photo-quality";
import { clearWatchedPublishedDraft, isWatchedPublishedDraft } from "@/lib/publish-watch";
import {
  addRevenueCatCustomerInfoListener,
  configureRevenueCat,
  loadRevenueCatState,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  revenueCatStateToSyncRequest,
  signOutRevenueCat,
  type PurchasesPackage,
  type RevenueCatState,
} from "@/lib/revenuecat";
import { type UploadProgress, uploadProgressKey } from "@/lib/upload-progress";
import {
  clearSessionToken,
  getHiddenQueueBatchIds,
  getLastBatchId,
  getSessionToken,
  setHiddenQueueBatchIds,
  setLastBatchId,
  setSessionToken,
} from "@/lib/storage";
import { workStatusGradient, workStatusTone } from "@/lib/work-status";
import {
  CaptureSource,
  PricingStrategySchema,
  type VisionFrameContext,
  type QueueItem,
  type PricingStrategy,
} from "@/shared/contracts";
import { type Palette } from "@/theme/palette";
import { useGradients, usePalette } from "@/theme/theme";

type BillingPlanId = "starter" | "pro" | "studio";
type RevenueCatPurchaseTerm = "monthly" | "annual";
type UploadMutationInput = {
  assets?: ImagePicker.ImagePickerAsset[];
  source?: CaptureSource;
  captureDeviceModel?: string | null;
  captureProfile?: string | null;
  pricingStrategy?: PricingStrategy;
  visionContext?: VisionFrameContext | null;
  retryOfBatchId?: string;
};
type RetainedFailedUpload = {
  assets: ImagePicker.ImagePickerAsset[];
  source: CaptureSource;
  captureDeviceModel: string | null;
  captureProfile: string | null;
  pricingStrategy: PricingStrategy;
  visionContext: VisionFrameContext | null;
};

export function DashboardScreen({ footer }: { footer?: ReactNode }) {
  if (appConfig.proofModeEnabled) {
    return <ProofDashboardScreen footer={footer} />;
  }

  return <SellerDashboardScreen footer={footer} />;
}

function ProofDashboardScreen({ footer }: { footer?: ReactNode }) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const router = useRouter();

  return (
    <View style={styles.screenShell}>
      <AppScreen footer={footer}>
        <View style={styles.identityRow}>
          <View style={styles.identityLeft}>
            <Image accessibilityLabel="ListingOS" accessibilityRole="image" contentFit="cover" source={brand.mark} style={styles.identityMark} transition={180} />
            <View style={styles.identityCopy}>
              <Text numberOfLines={1} selectable style={styles.identityWordmark}>{brand.name}</Text>
              <Text numberOfLines={1} selectable style={styles.identityTagline}>{brand.tagline}</Text>
            </View>
          </View>
          <HeaderActions style={styles.identityActions}>
            <StatusPill label="Non-mutating build" tone="success" />
            <ThemeToggle />
          </HeaderActions>
        </View>

        <SurfaceCard
          eyebrow="Hackathon proof"
          title="Explore the review system without a seller account"
          subtitle="This build mounts fixture-backed proof only. It does not load seller sessions, poll queues, sync billing, register push notifications, or expose live publish controls."
        >
          <Text selectable style={styles.bodyText}>
            Each replay uses the production review interface with local illustrative data. Any stored publish metadata is labeled separately as historical evidence.
          </Text>
        </SurfaceCard>

        <ProofModeSection onOpen={(scenarioId) => router.push(`/drafts/${encodeURIComponent(scenarioId)}`)} />
      </AppScreen>
    </View>
  );
}

function SellerDashboardScreen({ footer }: { footer?: ReactNode }) {
  const palette = usePalette();
  const gradients = useGradients();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { width } = useWindowDimensions();
  const compactHeader = width < 560;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const apiBaseUrl = appConfig.apiBaseUrl;
  const [sessionToken, setSessionTokenState] = useState<string | null>(null);
  const [authSessionId, setAuthSessionId] = useState<string | null>(null);
  const [pricingStrategy, setPricingStrategy] = useState<PricingStrategy>("balanced");
  const [selectedAssets, setSelectedAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [captureSource, setCaptureSource] = useState<CaptureSource>("manual");
  const [captureSessionId, setCaptureSessionId] = useState<string | null>(null);
  const [captureDeviceModel, setCaptureDeviceModel] = useState<string | null>(null);
  const [captureProfile, setCaptureProfile] = useState<string | null>(null);
  const [cameraFirst, setCameraFirst] = useState(Platform.OS !== "web");
  const [cameraProductNumber, setCameraProductNumber] = useState(1);
  const [lastBatchId, setLastBatchIdState] = useState<string | null>(null);
  const [optimisticQueueItems, setOptimisticQueueItems] = useState<QueueItem[]>([]);
  const [failedUploadsByBatch, setFailedUploadsByBatch] = useState<Map<string, RetainedFailedUpload>>(() => new Map());
  const [hiddenQueueBatchIds, setHiddenQueueBatchIdsState] = useState<Set<string>>(() => new Set());
  const [actionSheetItem, setActionSheetItem] = useState<QueueItem | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [revenueCatState, setRevenueCatState] = useState<RevenueCatState | null>(null);
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);
  const lastQueueStatusesRef = useRef(new Map<string, QueueItem["status"]>());
  const [notificationPermissionState, setNotificationPermissionState] = useState<PublishNotificationPermissionState>("not-available");
  const notificationRegistrationAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    void (async () => {
      setSessionTokenState(await getSessionToken());
      setLastBatchIdState(await getLastBatchId());
      setHiddenQueueBatchIdsState(new Set(await getHiddenQueueBatchIds()));
    })();
  }, []);

  useEffect(() => {
    function handleAuthReturn(url: string | null) {
      if (!url) return;
      const parsedAuthSession = parseAuthSessionFromUrl(url);
      const authSessionIdFromUrl = parsedAuthSession.authSessionId;
      if (!authSessionIdFromUrl) return;
      setAuthSessionId(authSessionIdFromUrl);
      if (parsedAuthSession.authStatus === "failed") {
        showToast({
          title: "eBay sign-in failed",
          message: "eBay returned a failure state. ListingOS will verify details on the next poll.",
          tone: "error",
        });
      }
      showToast({
        title: "Finishing eBay sign-in",
        message: "ListingOS is checking your connected seller account.",
        tone: "info",
      });
      clearAuthSessionFromUrl(url);
    }

    void Linking.getInitialURL().then(handleAuthReturn);
    // React Native defines a global `window`, but it has no `location`, so
    // `typeof window !== "undefined"` is NOT a web check — it passes on native
    // and then throws on `window.location.href`. Gate on Platform.OS instead.
    if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
      handleAuthReturn(window.location.href);
    }
    const subscription = Linking.addEventListener("url", (event) => {
      handleAuthReturn(event.url);
    });
    return () => subscription.remove();
  }, [showToast]);

  const apiContext = useMemo(() => ({
    apiBaseUrl,
    sessionToken,
  }), [apiBaseUrl, sessionToken]);

  const meQuery = useQuery({
    queryKey: ["session", apiBaseUrl, sessionToken],
    enabled: Boolean(sessionToken && apiBaseUrl),
    queryFn: () => api.getSessionMe(apiContext),
  });

  const queueQuery = useQuery({
    queryKey: ["queue", apiBaseUrl, sessionToken],
    enabled: Boolean(sessionToken && connectedSessionReady(meQuery.data)),
    refetchInterval: (query) => {
      const items = query.state.data ?? [];
      return items.some((item) => ["uploading", "queued", "processing", "publishing"].includes(item.status)) ? 2_000 : 6_000;
    },
    queryFn: () => api.listQueue(apiContext),
  });

  const billingQuery = useQuery({
    queryKey: ["billing", apiBaseUrl, sessionToken],
    enabled: Boolean(sessionToken && connectedSessionReady(meQuery.data)),
    queryFn: () => api.getBillingSummary(apiContext),
    staleTime: 30_000,
  });

  const pendingSessionQuery = useQuery({
    queryKey: ["pending-session", apiBaseUrl, authSessionId],
    enabled: Boolean(authSessionId && apiBaseUrl),
    refetchInterval: (query) =>
      query.state.data?.status === "complete" || query.state.data?.status === "failed"
        ? false
        : 2_000,
    queryFn: () => api.getPendingSession({ apiBaseUrl }, authSessionId!),
  });

  useEffect(() => {
    const pending = pendingSessionQuery.data;
    if (!pending || pending.status === "pending") return;
    if (pending.status === "failed") {
      queueMicrotask(() => {
        showToast({
          title: "eBay sign-in failed",
          message: pending.errorMessage ?? "Start the seller sign-in flow again.",
          tone: "error",
        });
        setAuthSessionId(null);
      });
      return;
    }
    if (!pending.sessionToken) return;
    const nextSessionToken = pending.sessionToken;
    void (async () => {
      await setSessionToken(nextSessionToken);
      await confirmHaptic();
      setSessionTokenState(nextSessionToken);
      setAuthSessionId(null);
      showToast({
        title: "eBay connected",
        message: pending.sellerUsername ? `Posting as ${pending.sellerUsername}.` : "Your seller account is ready.",
        tone: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["session", apiBaseUrl, nextSessionToken] });
    })();
  }, [apiBaseUrl, pendingSessionQuery.data, queryClient, showToast]);

  useEffect(() => {
    if (!sessionToken || notificationRegistrationAttemptedRef.current === sessionToken) return;
    notificationRegistrationAttemptedRef.current = sessionToken;
    void registerPublishNotifications({ apiBaseUrl, sessionToken, requestPermission: false }).then((result) => {
      setNotificationPermissionState(result.permissionState);
      if (
        result.ok
        || result.reason === "permission-not-determined"
        || result.reason === "permission-denied"
        || result.reason === "not-available"
        || result.reason === "push-native-config-missing"
      ) return;
      showToast({
        title: "Background alerts need setup",
        message: result.reason === "missing-project-id"
          ? "EAS project id is missing from this build."
          : "Listing queue still works, but closed-app alerts are not connected yet.",
        tone: "info",
      });
    }).catch((error) => {
      showToast({
        title: "Background alerts not connected",
        message: error instanceof Error ? error.message : "Listing queue still works, but push alerts need attention.",
        tone: "error",
      });
    });
  }, [apiBaseUrl, sessionToken, showToast]);

  useEffect(() => {
    if (!sessionToken || !meQuery.data) return;
    const appUserId = `seller:${meQuery.data.sellerAccountId}`;
    let canceled = false;
    let unsubscribe: (() => void) | null = null;
    void configureRevenueCat(appUserId).then(async (state) => {
      if (canceled) return;
      setRevenueCatState(state);
      const synced = await api.syncBilling(apiContext, revenueCatStateToSyncRequest(state, appUserId));
      queryClient.setQueryData(["billing", apiBaseUrl, sessionToken], synced);

      // Keep the UI honest for entitlement changes that happen outside the
      // purchase button: renewals, restores, another device, or a webhook
      // landing after we already synced.
      unsubscribe = await addRevenueCatCustomerInfoListener(async (nextState) => {
        if (canceled) return;
        setRevenueCatState(nextState);
        try {
          const resynced = await api.syncBilling(
            apiContext,
            revenueCatStateToSyncRequest(nextState, appUserId),
          );
          if (canceled) return;
          queryClient.setQueryData(["billing", apiBaseUrl, sessionToken], resynced);
        } catch {
          // A failed background resync should not surface an error to the
          // seller; the next foreground refresh will reconcile.
        }
      });
      if (canceled) unsubscribe?.();
    }).catch((error) => {
      if (canceled) return;
      setRevenueCatState({
        configured: false,
        appUserId,
        packages: [],
        activeEntitlements: [],
        managementUrl: null,
        errorMessage: error instanceof Error ? error.message : "RevenueCat sync failed.",
        platformSupported: Platform.OS === "ios" || Platform.OS === "android",
      });
    });
    return () => {
      canceled = true;
      unsubscribe?.();
    };
  }, [apiBaseUrl, apiContext, meQuery.data, queryClient, sessionToken]);

  const connectMutation = useMutation({
    mutationFn: () => api.connectSeller({ apiBaseUrl }),
    onSuccess: async (payload) => {
      setAuthSessionId(payload.authSessionId);
      await Linking.openURL(payload.authUrl);
    },
    onError: (error) =>
      Alert.alert(
        "Seller sign-in failed",
        error instanceof Error ? error.message : "Unknown error",
      ),
  });

  const uploadMutation = useMutation({
    mutationFn: async (input?: UploadMutationInput) => {
      const source = input?.source ?? captureSource;
      const deviceModel = input?.captureDeviceModel ?? captureDeviceModel;
      const profile = input?.captureProfile ?? captureProfile;
      const resolvedCaptureSessionId = source === "sony_monitor"
        ? await ensureCaptureSession(source)
        : captureSessionId;
      const assets = [...(input?.assets ?? selectedAssets)];
      if (assets.length === 0) {
        throw new Error("Choose at least one product photo before starting a listing.");
      }
      const strategy = input?.pricingStrategy ?? pricingStrategy;
      const batch = await api.createUploadBatch(apiContext, {
        marketplaceId: appConfig.defaultMarketplaceId,
        pricingStrategy: strategy,
        captureSource: source,
        captureSessionId: resolvedCaptureSessionId,
        captureDeviceModel: deviceModel,
        captureProfile: profile,
      });
      setCaptureSessionId(null);
      return {
        assets,
        batch,
        strategy,
        source,
        captureDeviceModel: deviceModel,
        captureProfile: profile,
        visionContext: input?.visionContext ?? null,
        retryOfBatchId: input?.retryOfBatchId ?? null,
      };
    },
    onSuccess: ({ assets, batch, strategy, source, captureDeviceModel: deviceModel, captureProfile: profile, visionContext, retryOfBatchId }) => {
      const initialProgress: UploadProgress = {
        batchId: batch.id,
        pricingStrategy: strategy,
        status: "uploading",
        completed: 0,
        total: assets.length,
        errorMessage: null,
      };
      const optimisticItem: QueueItem = {
        id: `upload:${batch.id}`,
        batchId: batch.id,
        jobId: null,
        draftId: null,
        title: "Uploading new listing",
        subtitle: `${assets.length} photo${assets.length === 1 ? "" : "s"} uploading. Start the next item now.`,
        status: "uploading",
        statusLabel: "Uploading",
        progress: 0.08,
        thumbnailUrl: assets[0]?.uri ?? null,
        errorMessage: null,
        buyerFacingUrl: null,
        updatedAt: new Date().toISOString(),
        canOpen: false,
        canCancel: false,
        canRetry: false,
      };
      queryClient.setQueryData(uploadProgressKey(batch.id), initialProgress);
      queryClient.setQueryData(["batch-jobs", apiBaseUrl, sessionToken, batch.id], []);
      setOptimisticQueueItems((current) => [
        optimisticItem,
        ...current.filter((item) => item.batchId !== batch.id && item.batchId !== retryOfBatchId),
      ].slice(0, 8));
      if (retryOfBatchId) {
        setFailedUploadsByBatch((current) => {
          const next = new Map(current);
          next.delete(retryOfBatchId);
          return next;
        });
      }
      setSelectedAssets((current) => samePhotoSelection(current, assets) ? [] : current);
      setLastBatchIdState(batch.id);
      void setLastBatchId(batch.id);
      void confirmHaptic();
      void api.uploadAssetsToBatchAndQueue(apiContext, {
        batchId: batch.id,
        pricingStrategy: strategy,
        // Every eBay publish must stop at the review screen and require the
        // seller's explicit action. Photo intake is never publish consent.
        autoPublish: false,
        assets,
        visionContext,
        onProgress: (completed, total) => {
          setOptimisticQueueItems((current) => current.map((item) => item.batchId === batch.id ? {
            ...item,
            subtitle: `Uploading ${completed} of ${total} photos. Keep listing.`,
            progress: Math.max(0.08, Math.min(0.48, completed / Math.max(total, 1) * 0.48)),
            updatedAt: new Date().toISOString(),
          } : item));
          queryClient.setQueryData<UploadProgress>(uploadProgressKey(batch.id), (current) => ({
            ...(current ?? initialProgress),
            batchId: batch.id,
            pricingStrategy: strategy,
            status: "uploading",
            completed,
            total,
            errorMessage: null,
          }));
        },
      }).then(() => {
        setOptimisticQueueItems((current) => current.map((item) => item.batchId === batch.id ? {
          ...item,
          status: "processing",
          statusLabel: "Processing",
          subtitle: "AI is identifying, pricing, and drafting in the background.",
          progress: 0.58,
          updatedAt: new Date().toISOString(),
        } : item));
        queryClient.setQueryData<UploadProgress>(uploadProgressKey(batch.id), {
          batchId: batch.id,
          pricingStrategy: strategy,
          status: "analyzing",
          completed: assets.length,
          total: assets.length,
          errorMessage: null,
        });
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["batch-jobs", apiBaseUrl, sessionToken, batch.id] }),
          queryClient.invalidateQueries({ queryKey: ["queue", apiBaseUrl, sessionToken] }),
        ]);
      }).catch((error) => {
        setFailedUploadsByBatch((current) => new Map(current).set(batch.id, {
          assets,
          source,
          captureDeviceModel: deviceModel,
          captureProfile: profile,
          pricingStrategy: strategy,
          visionContext,
        }));
        setOptimisticQueueItems((current) => current.map((item) => item.batchId === batch.id ? {
          ...item,
          status: "failed",
          statusLabel: "Failed",
          subtitle: "Upload stopped. Photos are retained in this app; retry from the queue.",
          progress: 1,
          errorMessage: error instanceof Error ? error.message : "Upload failed. Try again.",
          updatedAt: new Date().toISOString(),
          canRetry: true,
        } : item));
        queryClient.setQueryData<UploadProgress>(uploadProgressKey(batch.id), {
          batchId: batch.id,
          pricingStrategy: strategy,
          status: "failed",
          completed: queryClient.getQueryData<UploadProgress>(uploadProgressKey(batch.id))?.completed ?? 0,
          total: assets.length,
          errorMessage: error instanceof Error ? error.message : "Upload failed. Try again.",
        });
        showToast({
          title: "Photo upload stopped",
          message: "This product is retained in the queue. Your next photo selection was not changed.",
          tone: "error",
        });
      });
    },
    onError: (error, input) => {
      if (input?.retryOfBatchId) {
        setOptimisticQueueItems((current) => current.map((item) => item.batchId === input.retryOfBatchId ? {
          ...item,
          status: "failed",
          statusLabel: "Retry failed",
          subtitle: "The retained photos are still safe in this app. Try again when your connection improves.",
          errorMessage: error instanceof Error ? error.message : "Retry failed. Try again.",
          canRetry: true,
          updatedAt: new Date().toISOString(),
        } : item));
      }
      if (input?.assets?.length) {
        if (!input.retryOfBatchId) {
          setSelectedAssets(input.assets);
          setCameraFirst(false);
        }
      }
      if (error instanceof Error && "status" in error && error.status === 402) {
        setPaywallOpen(true);
        showToast({
          title: "AI listing limit reached",
          message: error.message,
          tone: "info",
        });
        return;
      }
      if (input?.retryOfBatchId) {
        showToast({
          title: "Retry did not start",
          message: error instanceof Error ? error.message : "The retained photos are still available in the queue.",
          tone: "error",
        });
        return;
      }
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Unknown error");
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      if (Platform.OS !== "ios" && Platform.OS !== "android") {
        throw new Error("Billing is available only on iOS and Android in this build.");
      }
      setPurchasingPackageId(pkg.identifier);
      await api.recordBillingEvent(apiContext, {
        eventName: "purchase_started",
        packageId: pkg.identifier,
      });
      return purchaseRevenueCatPackage(pkg);
    },
    onSuccess: async (outcome, pkg) => {
      setPurchasingPackageId(null);
      if (outcome.status === "canceled") {
        await api.recordBillingEvent(apiContext, { eventName: "purchase_cancelled", packageId: pkg.identifier });
        return;
      }
      setRevenueCatState(outcome.state);
      if (outcome.status === "failed") {
        await api.recordBillingEvent(apiContext, { eventName: "purchase_failed", packageId: pkg.identifier, metadata: { error: outcome.errorMessage } });
        showToast({
          title: "Purchase failed",
          message: outcome.errorMessage ?? "Try again or restore purchases.",
          tone: "error",
        });
        return;
      }
      const fallbackAppUserId = meQuery.data ? `seller:${meQuery.data.sellerAccountId}` : "seller:unknown";
      // The Worker verifies entitlements against RevenueCat's REST API, which
      // can still report the old state for a moment after the SDK confirms the
      // purchase. Syncing once and writing that straight into the cache is what
      // leaves the UI showing "Free" after a successful upgrade. Retry until
      // the server agrees with the entitlement the SDK just granted.
      const expectedEntitlements = outcome.state.activeEntitlements;
      let synced = await api.syncBilling(apiContext, revenueCatStateToSyncRequest(outcome.state, fallbackAppUserId));
      for (let attempt = 0; attempt < 4 && synced.plan === "free" && expectedEntitlements.length > 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        synced = await api.syncBilling(
          apiContext,
          revenueCatStateToSyncRequest(await loadRevenueCatState(), fallbackAppUserId),
        );
      }
      queryClient.setQueryData(["billing", apiBaseUrl, sessionToken], synced);
      // Also invalidate so anything else reading billing refetches, and so a
      // late webhook is picked up rather than pinned by staleTime.
      await queryClient.invalidateQueries({ queryKey: ["billing", apiBaseUrl, sessionToken] });
      await api.recordBillingEvent(apiContext, { eventName: "purchase_completed", packageId: pkg.identifier, plan: synced.plan });
      if (synced.plan === "free" && expectedEntitlements.length > 0) {
        // Purchase succeeded on the store but the server has not confirmed it.
        // Say so plainly instead of claiming an upgrade that did not land.
        showToast({
          title: "Purchase received",
          message: "Confirming with our servers. Your plan will update shortly — pull to refresh if it doesn't.",
          tone: "info",
        });
      } else {
        showToast({
          title: "Plan upgraded",
          message: `${synced.usage.remainingCredits} AI listings are available this month.`,
          tone: "success",
        });
      }
      setPaywallOpen(false);
    },
    onError: async (error) => {
      setPurchasingPackageId(null);
      await api.recordBillingEvent(apiContext, { eventName: "purchase_failed", metadata: { error: error instanceof Error ? error.message : String(error) } }).catch(() => undefined);
      showToast({
        title: "Purchase failed",
        message: error instanceof Error ? error.message : "Try again or restore purchases.",
        tone: "error",
      });
    },
  });

  const refreshWebBillingStatus = async () => {
    if (!sessionToken) return;
    await api.recordBillingEvent(apiContext, { eventName: "restore_attempted" }).catch(() => undefined);
    await queryClient.invalidateQueries({ queryKey: ["billing", apiBaseUrl, sessionToken] });
    showToast({
      title: "Checking subscription status",
      message: "If you just finished checkout, refresh again in about a minute.",
      tone: "info",
    });
  };

  const startWebRevenueCatCheckout = async (plan: BillingPlanId, term: RevenueCatPurchaseTerm, checkoutUrl: string) => {
    const packageId = `${plan}:${term}`;
    await api.recordBillingEvent(apiContext, { eventName: "purchase_started", packageId });
    try {
      await Linking.openURL(checkoutUrl);
    } catch (error) {
      showToast({
        title: "Checkout failed",
        message: error instanceof Error ? error.message : "Could not open the checkout link from this browser.",
        tone: "error",
      });
    }
  };

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (Platform.OS !== "ios" && Platform.OS !== "android") {
        throw new Error("Billing restore is available only on iOS and Android in this build.");
      }
      await api.recordBillingEvent(apiContext, { eventName: "restore_attempted" });
      const state = await restoreRevenueCatPurchases();
      const fallbackAppUserId = meQuery.data ? `seller:${meQuery.data.sellerAccountId}` : "seller:unknown";
      const synced = await api.syncBilling(apiContext, revenueCatStateToSyncRequest(state, fallbackAppUserId));
      return { state, synced };
    },
    onSuccess: async ({ state, synced }) => {
      setRevenueCatState(state);
      await api.recordBillingEvent(apiContext, { eventName: "restore_completed", plan: synced.plan }).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: ["billing", apiBaseUrl, sessionToken] });
      showToast({
        title: "Purchases restored",
        message: synced.plan === "free" ? "No active paid plan was found." : `${synced.plan} is active.`,
        tone: synced.plan === "free" ? "info" : "success",
      });
    },
    onError: (error) => {
      showToast({
        title: "Restore failed",
        message: error instanceof Error ? error.message : "Try again from your store account.",
        tone: "error",
      });
    },
  });

  const readinessQuery = useQuery({
    queryKey: ["seller-readiness", apiBaseUrl, sessionToken],
    enabled: Boolean(meQuery.data && apiBaseUrl),
    queryFn: () => api.getSellerReadiness(apiContext, "EBAY_US"),
  });

  const cancelQueueMutation = useMutation({
    mutationFn: (itemId: string) => api.cancelQueueItem(apiContext, itemId),
    onSuccess: async (item) => {
      setOptimisticQueueItems((current) => current.filter((entry) => entry.batchId !== item.batchId));
      await queryClient.invalidateQueries({ queryKey: ["queue", apiBaseUrl, sessionToken] });
    },
    onError: (error) => {
      showToast({
        title: "Could not cancel that item",
        message: error instanceof Error ? error.message : "Refresh the queue and try again.",
        tone: "error",
      });
    },
  });

  const retryQueueMutation = useMutation({
    mutationFn: (itemId: string) => api.retryQueueItem(apiContext, itemId),
    onSuccess: async (item) => {
      setOptimisticQueueItems((current) => current.filter((entry) => entry.batchId !== item.batchId));
      await queryClient.invalidateQueries({ queryKey: ["queue", apiBaseUrl, sessionToken] });
    },
    onError: (error) => {
      showToast({
        title: "Retry did not start",
        message: error instanceof Error ? error.message : "Refresh the queue and try again.",
        tone: "error",
      });
    },
  });

  function retryQueueItem(item: QueueItem) {
    const retained = failedUploadsByBatch.get(item.batchId);
    if (!retained) {
      retryQueueMutation.mutate(item.id);
      return;
    }
    setOptimisticQueueItems((current) => current.map((entry) => entry.batchId === item.batchId ? {
      ...entry,
      status: "uploading",
      statusLabel: "Restarting",
      subtitle: "Starting a fresh upload batch from the retained photos.",
      errorMessage: null,
      canRetry: false,
      progress: 0.05,
      updatedAt: new Date().toISOString(),
    } : entry));
    uploadMutation.mutate({
      ...retained,
      retryOfBatchId: item.batchId,
    });
  }

  const testNotificationsMutation = useMutation({
    mutationFn: async () => {
      const registration = await registerPublishNotifications({ apiBaseUrl, sessionToken });
      setNotificationPermissionState(registration.permissionState);
      if (!registration.ok) {
        const error = new Error(publishNotificationFailureMessage(registration.reason));
        Object.assign(error, { notificationReason: registration.reason });
        throw error;
      }
      return api.sendTestPushNotification(apiContext);
    },
    onSuccess: (result) => {
      showToast({
        title: result.sentCount > 0 ? "Test alert sent" : "No active device token",
        message: result.sentCount > 0
          ? `Expo accepted ${result.sentCount} alert${result.sentCount === 1 ? "" : "s"} for this seller.`
          : "Allow notifications, then try again from this device.",
        tone: result.sentCount > 0 ? "success" : "info",
      });
    },
    onError: (error) => {
      if (notificationFailureReason(error) === "permission-denied" && Platform.OS === "ios") {
        Alert.alert(
          "Notifications are off",
          "ListingOS cannot ask again after notifications are denied. You can enable alerts in iPhone Settings; the in-app queue still works either way.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }
      showToast({
        title: "Alert test failed",
        message: error instanceof Error ? error.message : "Push alerts are not connected yet.",
        tone: "error",
      });
    },
  });

  async function choosePhotos() {
    try {
      if (captureSource === "sony_remote") {
        showToast({
          title: "Sony remote mode",
          message: "Remote camera control is not enabled yet. Use Sony monitor mode or mobile photos.",
          tone: "info",
        });
      }
      const result = await collectPhotosForListing(captureSource);
      if (result.assets.length) {
        await tapHaptic();
        if (captureSource !== "manual") {
          const autoSource = captureSource === "sony_monitor" ? "Sony A7 III" : null;
          setCaptureDeviceModel(autoSource);
          setCaptureProfile(captureSource === "sony_monitor" ? "monitor_plus_v1" : "sony_remote_v1");
          await ensureCaptureSession();
        } else {
          setCaptureSessionId(null);
          setCaptureDeviceModel(null);
          setCaptureProfile(null);
        }
        setSelectedAssets(result.assets);
      }
    } catch (error) {
      console.error("[photo-picker] Could not import selected photos", error);
      Alert.alert(
        "Could not import photos",
        captureSource === "sony_monitor"
          ? "Sony auto-import could not read the camera roll. Choose the photos in Apple's picker instead; full-library access is optional."
          : photoImportRecoveryMessage(error),
        [
          { text: "Cancel", style: "cancel" },
          { text: "Try again", onPress: () => void choosePhotos() },
        ],
      );
    }
  }

  function handleCameraProductComplete(assets: ImagePicker.ImagePickerAsset[], visionContext: VisionFrameContext | null) {
    setCameraProductNumber((current) => current + 1);
    if (!connected) {
      setSelectedAssets(assets);
      setCameraFirst(false);
      showToast({
        title: "Photos saved for your first listing",
        message: "Connect eBay to send this product into the AI queue.",
        tone: "info",
      });
      return;
    }
    uploadMutation.mutate({
      assets,
      source: "manual",
      captureProfile: "phone_camera_single_product_v1",
      visionContext,
    });
  }

  async function ensureCaptureSession(source: CaptureSource = captureSource) {
    if (source !== "sony_monitor") return null;
    if (captureSessionId) return captureSessionId;
    const session = await api.startCameraSession(apiContext, {
      source,
      deviceModel: captureDeviceModel ?? "Sony A7 III",
      profile: captureProfile ?? "monitor_plus_v1",
      metadata: {
        captureMode: captureModeLabel(source),
        captureWindowMinutes: 20,
      },
    });
    setCaptureSessionId(session.sessionId);
    setCaptureDeviceModel(session.deviceModel);
    setCaptureProfile(session.profile);
    return session.sessionId;
  }

  async function signOut() {
    let revocationError: unknown = null;
    if (sessionToken) {
      try {
        await api.logoutSession(apiContext);
      } catch (error) {
        revocationError = error;
      }
    }
    await Promise.allSettled([clearSessionToken(), signOutRevenueCat()]);
    queryClient.removeQueries({ queryKey: ["session"] });
    queryClient.removeQueries({ queryKey: ["billing"] });
    queryClient.removeQueries({ queryKey: ["queue"] });
    setOptimisticQueueItems([]);
    setFailedUploadsByBatch(new Map());
    setRevenueCatState(null);
    setCaptureSessionId(null);
    setSessionTokenState(null);
    if (revocationError) {
      showToast({
        title: "Signed out on this device",
        message: "The server session could not be revoked while offline. Reconnect before signing in again if this is a shared device.",
        tone: "info",
      });
    }
  }

  function promoteSelectedAsset(index: number) {
    setSelectedAssets((current) => {
      if (index <= 0 || index >= current.length) return current;
      const next = [...current];
      const [asset] = next.splice(index, 1);
      return asset ? [asset, ...next] : current;
    });
    void tapHaptic();
  }

  function removeSelectedAsset(index: number) {
    setSelectedAssets((current) => current.filter((_asset, assetIndex) => assetIndex !== index));
    void confirmHaptic();
  }

  const connected = Boolean(meQuery.data);
  const queueItems = mergeQueueItems(optimisticQueueItems, queueQuery.data ?? [])
    .filter((item) => !hiddenQueueBatchIds.has(item.batchId));
  const clearableQueueItems = queueItems.filter(isQueueItemInactive);
  const readinessBlockers = readinessQuery.data?.blockers.length ?? 0;
  const heroAsset = selectedAssets[0];
  const photoQualityReport = useMemo(() => analyzePhotoSelection(selectedAssets), [selectedAssets]);
  const readinessLabel = !connected
    ? "Sign-in required"
    : readinessBlockers === 0
      ? "Publish ready"
      : `${readinessBlockers} blocker${readinessBlockers === 1 ? "" : "s"}`;
  const primaryActionLabel = meQuery.isLoading && sessionToken
    ? "Checking eBay account..."
    : !connected
      ? "Connect eBay to start"
      : !heroAsset
        ? "Choose product photos"
        : uploadMutation.isPending
          ? "Starting your listing..."
          : `Create listing from ${selectedAssets.length} photo${selectedAssets.length === 1 ? "" : "s"}`;

  useEffect(() => {
    if (!queueQuery.data) return;
    const previousStatuses = lastQueueStatusesRef.current;
    const nextStatuses = new Map<string, QueueItem["status"]>();
    for (const item of queueItems) {
      nextStatuses.set(item.id, item.status);
      const previousStatus = previousStatuses.get(item.id);
      const watched = isWatchedPublishedDraft(item.draftId);
      const transitionedFromActive = previousStatus && ["queued", "processing", "publishing"].includes(previousStatus);
      if (!watched && !transitionedFromActive) continue;
      if (item.status === "published") {
        showToast({
          title: "Published to eBay",
          message: item.buyerFacingUrl ? `${item.title} is live.` : item.title,
          tone: "success",
        });
        clearWatchedPublishedDraft(item.draftId);
      } else if (item.status === "failed") {
        showToast({
          title: "eBay needs a fix",
          message: item.errorMessage ?? "Open the draft to review the eBay requirement and retry.",
          tone: "error",
          durationMs: 6_500,
        });
        clearWatchedPublishedDraft(item.draftId);
      }
    }
    lastQueueStatusesRef.current = nextStatuses;
  }, [queueItems, queueQuery.data, showToast]);

  if (cameraFirst && Platform.OS !== "web") {
    return (
      <View style={styles.screenShell}>
        <CameraFirstSurface
          connected={connected}
          onOpenQueue={() => setCameraFirst(false)}
          onProductComplete={handleCameraProductComplete}
          onUseExistingPhotos={() => {
            setCameraFirst(false);
            void choosePhotos();
          }}
          productNumber={cameraProductNumber}
          queueCount={queueItems.length}
        />
      </View>
    );
  }

  async function refreshDashboard() {
    await Promise.allSettled([
      meQuery.refetch(),
      queueQuery.refetch(),
      readinessQuery.refetch(),
      pendingSessionQuery.refetch(),
    ]);
  }

  function hideQueueBatches(batchIds: string[], toastTitle = "Queue cleaned up") {
    const uniqueBatchIds = Array.from(new Set(batchIds.filter(Boolean)));
    if (uniqueBatchIds.length === 0) return;
    setHiddenQueueBatchIdsState((current) => {
      const next = new Set(current);
      for (const batchId of uniqueBatchIds) next.add(batchId);
      void setHiddenQueueBatchIds(Array.from(next));
      return next;
    });
    setOptimisticQueueItems((current) => current.filter((item) => !uniqueBatchIds.includes(item.batchId)));
    setFailedUploadsByBatch((current) => {
      const next = new Map(current);
      for (const batchId of uniqueBatchIds) next.delete(batchId);
      return next;
    });
    void confirmHaptic();
    showToast({
      title: toastTitle,
      message: uniqueBatchIds.length === 1 ? "Removed from this device's home queue." : `${uniqueBatchIds.length} items removed from this device's home queue.`,
      tone: "success",
    });
  }

  function clearInactiveQueueItems() {
    hideQueueBatches(clearableQueueItems.map((item) => item.batchId), "Cleared finished queue items");
  }

  function confirmClearAllQueueItems() {
    if (queueItems.length === 0) return;
    Alert.alert(
      "Clear visible queue?",
      "This only cleans up the home queue on this device. It will not delete drafts, listings, or live eBay items.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear queue",
          style: "destructive",
          onPress: () => hideQueueBatches(queueItems.map((item) => item.batchId), "Queue cleared"),
        },
      ],
    );
  }

  return (
    <View style={styles.screenShell}>
      <AppScreen footer={footer} onRefresh={refreshDashboard}>
        <View style={styles.identityRow}>
          <View style={styles.identityLeft}>
            <Image accessibilityLabel="ListingOS" accessibilityRole="image" contentFit="cover" source={brand.mark} style={styles.identityMark} transition={180} />
            <View style={styles.identityCopy}>
              <Text numberOfLines={1} selectable style={styles.identityWordmark}>{brand.name}</Text>
              <Text numberOfLines={1} selectable style={styles.identityTagline}>{brand.tagline}</Text>
            </View>
          </View>
          <HeaderActions
            style={[
              styles.identityActions,
              Platform.OS === "ios" || compactHeader ? styles.identityActionsStacked : null,
            ]}
          >
            <StatusPill
              label={connected ? (meQuery.data?.sellerUsername ?? "Connected") : "Not connected"}
              tone={connected ? "success" : "warning"}
            />
            {Platform.OS !== "web" ? (
              <Pressable accessibilityLabel="Open camera" accessibilityRole="button" hitSlop={10} onPress={() => setCameraFirst(true)} style={styles.cameraEntryButton}>
                <SymbolView name="camera.fill" size={16} tintColor={palette.text} />
                <Text style={styles.cameraEntryText}>Camera</Text>
              </Pressable>
            ) : null}
            <ThemeToggle />
          </HeaderActions>
        </View>

        {Platform.OS === "web" ? (
          <ProofModeSection onOpen={(scenarioId) => router.push(`/drafts/${scenarioId}`)} />
        ) : null}

        <IosHeroClip style={styles.heroClipShell}>
            <HeroBackdrop
              colors={gradients.hero as [string, string, string]}
              style={styles.hero}
            >
          <AppGlass disableBlur={Platform.OS === "ios"} intensity={58} style={styles.heroGlass}>
            {connected ? (
              <View style={styles.heroHeadRow}>
                <Text aria-level={1} role="heading" selectable style={styles.heroHeadline}>
                  {heroAsset ? "Ready to list" : "Pick one product"}
                </Text>
                <StatusPill
                  label={readinessLabel}
                  tone={readinessBlockers === 0 ? "accent" : "warning"}
                />
              </View>
            ) : (
              <Text aria-level={1} role="heading" selectable style={styles.heroHeadline}>Connect eBay, then pick one product</Text>
            )}

            <View style={styles.heroMetaRow}>
              <Text selectable style={styles.bodyText}>Capture → AI draft → review/proof → fixed-price eBay publish.</Text>
              <Text selectable style={styles.bodyText}>
                Live publish creates a real listing. Use Proof Mode for non-mutating review and publish evidence.
              </Text>
            </View>

            <View style={styles.captureModeStrip}>
              <CaptureModePill
                label="Mobile Photos"
                selected={captureSource === "manual"}
                onPress={() => {
                  setCaptureSource("manual");
                  setCaptureSessionId(null);
                  setCaptureDeviceModel(null);
                  setCaptureProfile(null);
                }}
              />
              {Platform.OS !== "web" ? (
                <>
                  <CaptureModePill
                    label="Sony Monitor"
                    selected={captureSource === "sony_monitor"}
                    onPress={() => {
                      setCaptureSource("sony_monitor");
                      void ensureCaptureSession();
                    }}
                  />
                  <CaptureModePill
                    label="Sony Remote"
                    selected={captureSource === "sony_remote"}
                    onPress={() => {
                      setCaptureSource("sony_remote");
                      setCaptureSessionId(null);
                      setCaptureDeviceModel(null);
                      setCaptureProfile("sony_remote_v1");
                    }}
                  />
                </>
              ) : null}
            </View>

            <View style={styles.captureStage}>
              <Text selectable style={styles.captureModeHint}>
                Source: {captureModeLabel(captureSource)}
                {captureSource === "sony_monitor" && captureModeSupportsAutoImport(captureSource)
                  ? " • importing latest camera shots when available"
                  : ""}
              </Text>
              {Platform.OS === "ios" && captureSource === "manual" ? (
                <View style={styles.iosPhotoPrivacyNote}>
                  <SymbolView name="lock.shield.fill" size={16} tintColor={palette.cyan} />
                  <Text selectable style={styles.iosPhotoPrivacyText}>
                    Apple shares only the photos you choose. “Private Access” is expected, and full-library permission is not required.
                  </Text>
                </View>
              ) : null}
              {heroAsset ? (
                <>
                  <View style={styles.heroPhotoFrame}>
                    <Image contentFit="cover" source={{ uri: heroAsset.uri }} style={styles.heroPhoto} transition={220} />
                    <LinearGradient
                      colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.5)"]}
                      pointerEvents="none"
                      style={styles.heroPhotoScrim}
                    />
                    <View style={styles.heroPhotoBadge}>
                      <Text selectable style={styles.heroPhotoBadgeText}>
                        {selectedAssets.length} photo{selectedAssets.length === 1 ? "" : "s"} selected
                      </Text>
                    </View>
                  </View>
                  <ScrollView horizontal contentContainerStyle={styles.photoRail} showsHorizontalScrollIndicator={false}>
                    {selectedAssets.map((asset, index) => (
                      <SelectedPhotoTile
                        asset={asset}
                        isLead={index === 0}
                        key={`${asset.assetId ?? asset.uri}-${index}`}
                        onMakeLead={() => promoteSelectedAsset(index)}
                        onRemove={() => removeSelectedAsset(index)}
                      />
                    ))}
                  </ScrollView>
                  <PhotoQualityCoach report={photoQualityReport} />
                  <View style={styles.strategyBlock}>
                    <Text selectable style={styles.strategyLabel}>Choose the selling goal</Text>
                    <StrategyControl
                      value={pricingStrategy}
                      onChange={(value) => setPricingStrategy(PricingStrategySchema.parse(value))}
                    />
                  </View>
                </>
              ) : (
                <Pressable
                  accessibilityHint="Opens your photo library"
                  accessibilityLabel="Choose product photos"
                  accessibilityRole="button"
                  onPress={() => void choosePhotos()}
                  style={({ pressed }) => [styles.emptyCapture, pressed ? styles.emptyCapturePressed : null]}
                >
                  <View style={styles.captureIconRing}>
                    {Platform.OS === "ios" ? (
                      <SymbolView name="plus.viewfinder" size={30} tintColor={palette.cyan} />
                    ) : (
                      <Text selectable style={styles.captureIconPlus}>+</Text>
                    )}
                  </View>
                  <Text selectable style={styles.emptyCaptureTitle}>Start with photos</Text>
                  <Text selectable style={styles.emptyCaptureBody}>3 to 8 clear shots of one item. ListingOS builds the draft around them.</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.heroCtas}>
              <AppButton
                accessibilityHint={connected && !heroAsset ? "Opens your photo library" : undefined}
                label={primaryActionLabel}
                loading={connectMutation.isPending || uploadMutation.isPending || Boolean(meQuery.isLoading && sessionToken)}
                onPress={() => {
                  if (!connected) {
                    connectMutation.mutate();
                  } else if (!heroAsset) {
                    void choosePhotos();
                  } else {
                    uploadMutation.mutate({});
                  }
                }}
                disabled={Boolean(meQuery.isLoading && sessionToken)}
              />
              {heroAsset ? <AppButton label="Replace photos" tone="secondary" onPress={choosePhotos} /> : null}
              <AppButton label="Preview ListingOS Market beta" tone="secondary" onPress={() => router.push("/market" as never)} />
              {lastBatchId ? (
                <AppButton label="Open last listing" tone="secondary" onPress={() => router.push(`/batches/${lastBatchId}`)} />
              ) : null}
            </View>
              </AppGlass>
            </HeroBackdrop>
        </IosHeroClip>

        {connected ? (
          <BillingCard
            billing={billingQuery.data}
            loading={billingQuery.isLoading}
            onUpgrade={() => {
              setPaywallOpen(true);
              void api.recordBillingEvent(apiContext, {
                eventName: "upgrade_initiated",
                trigger: "home_billing_card",
                plan: billingQuery.data?.plan,
              }).catch(() => undefined);
            }}
          />
        ) : null}

        {connected && paywallOpen ? (
          <SurfaceCard
            eyebrow="Plans"
            title="Upgrade ListingOS"
            subtitle="The app stays useful for casual sellers, while heavy AI usage pays for itself."
          >
            <PaywallPanel
              billing={billingQuery.data}
              purchasingPackageId={purchasingPackageId}
              revenueCat={revenueCatState}
              onClose={() => setPaywallOpen(false)}
              onPurchase={(pkg) => purchaseMutation.mutate(pkg)}
              onWebPurchase={(plan, term, checkoutUrl) => {
                void startWebRevenueCatCheckout(plan, term, checkoutUrl);
              }}
              onRestore={() => {
                if (Platform.OS === "web") {
                  void refreshWebBillingStatus();
                  return;
                }
                restoreMutation.mutate();
              }}
            />
          </SurfaceCard>
        ) : null}

        {connected ? (
          <SurfaceCard
            eyebrow="Assembly line"
            title={queueItems.length > 0 ? "Processing queue" : "Queue is clear"}
            subtitle={queueItems.length > 0
              ? "Keep listing. Open anything that needs review, cancel active work, or retry failed steps."
              : "New listings will appear here immediately while they upload, draft, publish, or wait for review."}
          >
            {queueItems.length > 0 ? (
              <>
                <View style={styles.queueToolbar}>
                  <Text selectable style={styles.queueToolbarText}>
                    {queueItems.length} visible · {clearableQueueItems.length} done/failed
                  </Text>
                  <View style={styles.queueToolbarActions}>
                    {clearableQueueItems.length > 0 ? (
                      <QueueAction label="Clear done" onPress={clearInactiveQueueItems} />
                    ) : null}
                    <QueueAction label="Clear all" onPress={confirmClearAllQueueItems} />
                  </View>
                </View>
                <View style={styles.queueStack}>
                  {queueItems.slice(0, 8).map((item) => (
                    <QueueItemCard
                      key={item.id}
                      item={item}
                      onOpen={() => {
                        if (!item.canOpen) {
                          setActionSheetItem(item);
                          return;
                        }
                        if (item.draftId) {
                          router.push(`/drafts/${item.draftId}`);
                        } else {
                          router.push(`/batches/${item.batchId}`);
                        }
                      }}
                      onCancel={() => cancelQueueMutation.mutate(item.id)}
                      onRetry={() => retryQueueItem(item)}
                      onClear={() => hideQueueBatches([item.batchId], "Removed from queue")}
                      onMore={() => setActionSheetItem(item)}
                    />
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.emptyQueueCard}>
                <Text selectable style={styles.emptyQueueTitle}>Ready for the next product</Text>
                <Text selectable style={styles.bodyText}>Choose photos above and ListingOS will keep the work moving here.</Text>
              </View>
            )}
            {queueQuery.isError ? (
              <Text selectable style={styles.errorText}>
                {queueQuery.error instanceof Error ? queueQuery.error.message : "Could not refresh queue."}
              </Text>
            ) : null}
          </SurfaceCard>
        ) : null}

        {(pendingSessionQuery.isFetching || meQuery.isError) ? (
          <SurfaceCard
            eyebrow="Account"
            title={pendingSessionQuery.isFetching ? "Finish eBay sign-in" : "Reconnect eBay"}
            subtitle={pendingSessionQuery.isFetching ? "Come back here after approving access. ListingOS will finish setup automatically." : "Your seller session needs a fresh sign-in before publishing."}
          >
            {pendingSessionQuery.isFetching ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={palette.cyan} />
                <Text selectable style={styles.bodyText}>Waiting for eBay approval...</Text>
              </View>
            ) : (
              <AppButton label="Reconnect eBay" onPress={() => connectMutation.mutate()} loading={connectMutation.isPending} />
            )}
          </SurfaceCard>
        ) : null}

        {connected ? (
          <View style={styles.accountBar}>
            <View style={styles.accountCopy}>
              <Text selectable style={styles.accountLabel}>Posting to</Text>
              <Text selectable style={styles.accountValue}>{meQuery.data?.sellerUsername} on eBay US</Text>
            </View>
            <View style={styles.accountActions}>
              <Pressable
                accessibilityRole="button"
                disabled={testNotificationsMutation.isPending}
                hitSlop={12}
                onPress={() => testNotificationsMutation.mutate()}
              >
                <Text style={[styles.signOutText, testNotificationsMutation.isPending ? styles.accountActionDisabled : null]}>
                  {testNotificationsMutation.isPending
                    ? "Testing..."
                    : notificationPermissionState === "authorized" || notificationPermissionState === "provisional"
                      ? "Test alerts"
                      : "Enable alerts"}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" hitSlop={12} onPress={() => void signOut()}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <QueueActionSheet
          item={actionSheetItem}
          onDismiss={() => setActionSheetItem(null)}
          onOpen={() => {
            if (!actionSheetItem) return;
            const item = actionSheetItem;
            setActionSheetItem(null);
            if (item.draftId) {
              router.push(`/drafts/${item.draftId}`);
            } else {
              router.push(`/batches/${item.batchId}`);
            }
          }}
          onCancel={() => {
            if (!actionSheetItem) return;
            const item = actionSheetItem;
            setActionSheetItem(null);
            cancelQueueMutation.mutate(item.id);
          }}
          onRetry={() => {
            if (!actionSheetItem) return;
            const item = actionSheetItem;
            setActionSheetItem(null);
            retryQueueItem(item);
          }}
          onClear={() => {
            if (!actionSheetItem) return;
            const item = actionSheetItem;
            setActionSheetItem(null);
            hideQueueBatches([item.batchId], "Removed from queue");
          }}
        />
      </AppScreen>
    </View>
  );
}

function CaptureModePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.captureModePill,
        selected ? styles.captureModePillActive : styles.captureModePillInactive,
        pressed ? styles.captureModePillPressed : null,
      ]}
    >
      <Text selectable style={[styles.captureModePillText, selected ? styles.captureModePillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function PhotoQualityCoach({ report }: { report: PhotoQualityReport }) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const primaryIssue = report.issues[0];
  const toneStyle = {
    success: styles.photoCoachSuccess,
    warning: styles.photoCoachWarning,
    danger: styles.photoCoachDanger,
  }[report.tone];

  return (
    <AppGlass intensity={62} style={[styles.photoCoach, toneStyle]}>
      <View style={styles.photoCoachHeader}>
        <View style={styles.photoCoachScore}>
          <Text selectable style={styles.photoCoachScoreText}>{Math.round(report.score)}</Text>
        </View>
        <View style={styles.photoCoachCopy}>
          <Text selectable style={styles.photoCoachTitle}>{report.label}</Text>
          {primaryIssue ? (
            <Text selectable style={styles.photoCoachBody}>
              {primaryIssue.title}: {primaryIssue.message}
            </Text>
          ) : null}
        </View>
      </View>
      {report.issues.length > 1 ? (
        <View style={styles.photoCoachChipRow}>
          {report.issues.slice(1, 4).map((issue) => (
            <View key={issue.id} style={styles.photoCoachChip}>
              <Text selectable style={styles.photoCoachChipText}>{issue.title}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </AppGlass>
  );
}

function SelectedPhotoTile({
  asset,
  isLead,
  onMakeLead,
  onRemove,
}: {
  asset: ImagePicker.ImagePickerAsset;
  isLead: boolean;
  onMakeLead: () => void;
  onRemove: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [translateX] = useState(() => new Animated.Value(0));
  const didSwipeRef = useRef(false);
  // eslint-disable-next-line react-hooks/refs -- PanResponder stores ref reads for gesture callbacks, not render output.
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dx) > 7 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_event, gesture) => {
      if (gesture.dx <= 0) return;
      didSwipeRef.current = true;
      translateX.setValue(Math.min(82, gesture.dx));
    },
    onPanResponderRelease: (_event, gesture) => {
      const shouldRemove = gesture.dx > 58;
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 7 }).start(() => {
        didSwipeRef.current = false;
      });
      if (shouldRemove) onRemove();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 7 }).start(() => {
        didSwipeRef.current = false;
      });
    },
  }), [onRemove, translateX]);

  return (
    <View style={styles.selectedPhotoSwipeShell}>
      <View style={styles.selectedPhotoRemoveLane}>
        <Text style={styles.selectedPhotoRemoveText}>Remove</Text>
      </View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        <Pressable
          accessibilityHint={isLead ? "Swipe right to remove this photo" : "Tap to make this the cover photo, or swipe right to remove it"}
          accessibilityLabel={isLead ? "Cover photo" : "Selected product photo"}
          accessibilityRole="button"
          accessibilityState={{ selected: isLead }}
          onPress={() => {
            if (didSwipeRef.current) return;
            onMakeLead();
          }}
          style={({ pressed }) => [
            styles.thumbnailShell,
            isLead ? styles.thumbnailShellActive : null,
            pressed ? styles.thumbnailShellPressed : null,
          ]}
        >
          <Image contentFit="cover" source={{ uri: asset.uri }} style={styles.thumbnail} transition={160} />
          {isLead ? (
            <View style={styles.thumbnailLeadBadge}>
              <Text style={styles.thumbnailLeadText}>Main</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityLabel="Remove selected photo"
            accessibilityRole="button"
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            style={({ pressed }) => [styles.thumbnailRemoveButton, pressed ? styles.thumbnailRemoveButtonPressed : null]}
          >
            <Text style={styles.thumbnailRemoveText}>×</Text>
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function QueueItemCard({
  item,
  onOpen,
  onCancel,
  onRetry,
  onClear,
  onMore,
}: {
  item: QueueItem;
  onOpen: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onClear: () => void;
  onMore: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [translateX] = useState(() => new Animated.Value(0));
  const didSwipeRef = useRef(false);
  const clearable = isQueueItemInactive(item);
  const swipeAction = item.canCancel ? "Cancel" : item.canRetry ? "Retry" : clearable ? "Clear" : item.canOpen ? "Open" : "More";
  const swipeEnabled = item.canCancel || item.canRetry || clearable || item.canOpen;
  // eslint-disable-next-line react-hooks/refs -- PanResponder stores ref reads for gesture callbacks, not render output.
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      swipeEnabled && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_event, gesture) => {
      if (gesture.dx <= 0) return;
      didSwipeRef.current = true;
      translateX.setValue(Math.min(132, gesture.dx));
    },
    onPanResponderRelease: (_event, gesture) => {
      const shouldCommit = gesture.dx > 104;
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 8 }).start(() => {
        setTimeout(() => {
          didSwipeRef.current = false;
        }, 0);
      });
      if (!shouldCommit) return;
      void confirmHaptic();
      if (item.canCancel) {
        onCancel();
      } else if (item.canRetry) {
        onRetry();
      } else if (clearable) {
        onClear();
      } else if (item.canOpen) {
        onOpen();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 8 }).start(() => {
        didSwipeRef.current = false;
      });
    },
  }), [clearable, item.canCancel, item.canOpen, item.canRetry, onCancel, onClear, onOpen, onRetry, swipeEnabled, translateX]);

  return (
    <View style={styles.swipeShell}>
      <LinearGradient
        colors={item.canRetry ? ["rgba(249,199,114,0.24)", "rgba(249,199,114,0.06)"] : ["rgba(243,154,177,0.26)", "rgba(243,154,177,0.06)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.swipeActionBackground}
      >
        <Text style={styles.swipeActionText}>{swipeAction}</Text>
        <Text style={styles.swipeActionHint}>Swipe right</Text>
      </LinearGradient>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        <Pressable
          accessibilityHint={swipeEnabled ? `Swipe right to ${swipeAction.toLowerCase()}` : undefined}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${item.statusLabel}`}
          onPress={() => {
            if (didSwipeRef.current) return;
            onOpen();
          }}
          style={({ pressed }) => [styles.queueCard, pressed ? styles.queueCardPressed : null]}
        >
          <LinearGradient
            colors={workStatusGradient(item.status)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.queueGlow}
          />
          <View style={styles.queueCardContent}>
            {item.thumbnailUrl ? (
              <Image contentFit="cover" source={{ uri: item.thumbnailUrl }} style={styles.queueThumb} transition={180} />
            ) : (
              <View style={styles.queueThumbPlaceholder}>
                <Text style={styles.queueThumbPlus}>+</Text>
              </View>
            )}
            <View style={styles.queueCopy}>
              <View style={styles.queueTitleRow}>
                <Text selectable numberOfLines={2} style={styles.queueTitle}>{item.title}</Text>
                <StatusPill label={item.statusLabel} tone={workStatusTone(item.status)} />
              </View>
              <Text selectable numberOfLines={2} style={styles.queueSubtitle}>{item.subtitle}</Text>
              {item.errorMessage ? <Text selectable numberOfLines={2} style={styles.errorText}>{item.errorMessage}</Text> : null}
              <View style={styles.queueProgressTrack}>
                <View style={[styles.queueProgressFill, { width: `${Math.max(6, Math.round(item.progress * 100))}%` }]} />
              </View>
              <View style={styles.queueActions}>
                <Text selectable style={styles.queueTimestamp}>{relativeQueueTime(item.updatedAt)}</Text>
                {item.canOpen ? <QueueAction label="Open" onPress={onOpen} /> : null}
                <QueueAction label="More" onPress={onMore} />
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function QueueActionSheet({
  item,
  onDismiss,
  onOpen,
  onCancel,
  onRetry,
  onClear,
}: {
  item: QueueItem | null;
  onDismiss: () => void;
  onOpen: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onClear: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const canOpen = Boolean(item?.canOpen);
  const canRetry = Boolean(item?.canRetry);
  const canCancel = Boolean(item?.canCancel);
  const canClear = Boolean(item);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={Boolean(item)}
      onRequestClose={onDismiss}
      statusBarTranslucent
      testID="queue-action-sheet"
    >
      <View style={styles.queueSheetRoot}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss queue actions" style={styles.queueSheetBackdrop} onPress={onDismiss} />
        <View style={[styles.queueSheet, { backgroundColor: palette.backgroundAlt, borderColor: palette.borderStrong }]}>
          <View style={styles.queueSheetHandle} />
          <Text style={[styles.queueSheetEyebrow, { color: palette.cyan }]}>QUEUE ACTIONS</Text>
          <Text numberOfLines={2} style={[styles.queueSheetTitle, { color: palette.text }]}>{item?.title ?? "Listing"}</Text>
          <Text numberOfLines={3} style={[styles.queueSheetSubtitle, { color: palette.textMuted }]}>{item?.subtitle ?? "Choose what to do next."}</Text>
          {canOpen ? <AppButton label="Open listing" onPress={onOpen} /> : null}
          {canRetry ? <QueueSheetButton label="Retry failed step" onPress={onRetry} palette={palette} /> : null}
          {canCancel ? <QueueSheetButton label="Cancel processing" onPress={onCancel} palette={palette} /> : null}
          {canClear ? <QueueSheetButton label="Clear from home queue" onPress={onClear} palette={palette} /> : null}
          {!canRetry && !canCancel ? (
            <Text style={[styles.queueSheetNote, { color: palette.textSoft }]}>Nothing is actively running for this item. You can open it or clear it from this device.</Text>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} style={styles.queueSheetDismiss}>
            <Text style={[styles.queueSheetDismissText, { color: palette.textMuted }]}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function QueueSheetButton({ label, onPress, palette }: { label: string; onPress: () => void; palette: Palette }) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.queueSheetButton,
        { borderColor: palette.borderStrong, backgroundColor: "rgba(142,208,255,0.08)" },
        pressed ? styles.queueSheetButtonPressed : null,
      ]}
    >
      <Text style={[styles.queueSheetButtonText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

function QueueAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [styles.queueAction, pressed ? styles.queueActionPressed : null, disabled ? styles.queueActionDisabled : null]}
    >
      <Text style={styles.queueActionText}>{label}</Text>
    </Pressable>
  );
}

function mergeQueueItems(localItems: QueueItem[], remoteItems: QueueItem[]) {
  const remoteBatchIds = new Set(remoteItems.map((item) => item.batchId));
  return [
    ...localItems.filter((item) => !remoteBatchIds.has(item.batchId) || item.status === "uploading"),
    ...remoteItems,
  ].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function samePhotoSelection(
  left: ImagePicker.ImagePickerAsset[],
  right: ImagePicker.ImagePickerAsset[],
) {
  return left.length === right.length && left.every((asset, index) => asset.uri === right[index]?.uri);
}

function isQueueItemInactive(item: QueueItem) {
  return item.status === "published" || item.status === "failed" || item.status === "canceled";
}

function connectedSessionReady(value: unknown) {
  return Boolean(value);
}

function parseAuthSessionFromUrl(url: string) {
  const result = {
    authSessionId: null as string | null,
    authStatus: null as "complete" | "failed" | null,
  };

  const updateResult = (
    nextSessionId: string | null | undefined,
    nextStatus?: string | null,
  ) => {
    if (typeof nextSessionId === "string" && nextSessionId.trim()) {
      result.authSessionId = nextSessionId.trim();
      const normalized = normalizeAuthStatus(nextStatus);
      if (normalized) result.authStatus = normalized;
    }
  };

  const parsed = Linking.parse(url);
  updateResult(
    typeof parsed.queryParams?.authSessionId === "string" ? parsed.queryParams.authSessionId : null,
    typeof parsed.queryParams?.authStatus === "string" ? parsed.queryParams.authStatus : null,
  );

  try {
    const parsedUrl = new URL(url);
    updateResult(
      parsedUrl.searchParams.get("authSessionId"),
      parsedUrl.searchParams.get("authStatus"),
    );

    const hash = parsedUrl.hash ? parsedUrl.hash.replace(/^#/, "") : "";
    if (hash.includes("authSessionId") || hash.includes("authStatus")) {
      const hashParts = hash.split("?");
      if (hashParts.length > 1) {
        const hashParams = new URLSearchParams(hashParts[1]);
        updateResult(hashParams.get("authSessionId"), hashParams.get("authStatus"));
      }
    }
  } catch {
    // Parsing is intentionally forgiving: if URL parsing fails, fallback to Linking.parse data.
  }

  return result;
}

function clearAuthSessionFromUrl(url: string) {
  // Same trap as above: native has `window` but no `window.history`, so this
  // must gate on the platform, not on the existence of `window`.
  if (Platform.OS !== "web" || typeof window === "undefined" || !window.history) return;
  let resolved = null as string | null;
  try {
    const parsedUrl = new URL(url);
    let changed = false;
    if (parsedUrl.searchParams.has("authSessionId") || parsedUrl.searchParams.has("authStatus")) {
      parsedUrl.searchParams.delete("authSessionId");
      parsedUrl.searchParams.delete("authStatus");
      changed = true;
    }

    if (parsedUrl.hash) {
      const hash = parsedUrl.hash.replace(/^#/, "");
      const hashParts = hash.split("?");
      if (hashParts.length > 1) {
        const pathPart = hashParts[0] ?? "";
        const hashParams = new URLSearchParams(hashParts[1]);
        const hadAuth = hashParams.has("authSessionId") || hashParams.has("authStatus");
        if (hadAuth) {
          hashParams.delete("authSessionId");
          hashParams.delete("authStatus");
          changed = true;
        }
        const nextHash = hashParams.toString();
        parsedUrl.hash = nextHash ? `${pathPart}?${nextHash}` : pathPart;
      }
    }

    if (!changed) return;
    resolved = parsedUrl.toString();
  } catch {
    return;
  }

  if (resolved) {
    window.history.replaceState({}, "", resolved);
  }
}

function normalizeAuthStatus(value: string | null | undefined) {
  if (value !== "complete" && value !== "failed") return null;
  return value;
}

function relativeQueueTime(value: string) {
  const elapsedMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "Just now";
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 60) return `${elapsedSeconds || 1}s ago`;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `${elapsedHours}h ago`;
}

function HeroBackdrop({
  children,
  colors,
  style,
}: {
  children: ReactNode;
  colors: [string, string, string];
  style: StyleProp<ViewStyle>;
}) {
  if (Platform.OS === "ios") {
    return <View style={[style, { backgroundColor: colors[1] }]}>{children}</View>;
  }

  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </LinearGradient>
  );
}

function IosHeroClip({
  children,
  style,
}: {
  children: ReactNode;
  style: StyleProp<ViewStyle>;
}) {
  if (Platform.OS !== "ios") return <>{children}</>;
  return <View style={style}>{children}</View>;
}

function HeaderActions({
  children,
  style,
}: {
  children: ReactNode;
  style: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}

const createStyles = (palette: Palette) => StyleSheet.create({
  screenShell: {
    flex: 1,
  },
  identityRow: Platform.select({
    ios: {
      gap: 12,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    default: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12,
      paddingHorizontal: 4,
    },
  }),
  identityLeft: Platform.select({
    ios: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minWidth: 0,
    },
    default: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
  }),
  identityActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 12,
  },
  identityActionsStacked: {
    width: "100%",
    justifyContent: "space-between",
  },
  identityMark: {
    width: Platform.select({ ios: 48, default: 40 }),
    height: Platform.select({ ios: 48, default: 40 }),
    borderRadius: Platform.select({ ios: 15, default: 12 }),
    borderCurve: Platform.select({ ios: "circular", default: "continuous" }),
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: Platform.select({ ios: 2, default: 1 }),
  },
  cameraEntryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: Platform.select({ ios: 44, default: undefined }),
    paddingHorizontal: Platform.select({ ios: 15, default: 12 }),
    paddingVertical: Platform.select({ ios: 10, default: 9 }),
    borderRadius: Platform.select({ ios: 22, default: 16 }),
    borderCurve: Platform.select({ ios: "circular", default: "continuous" }),
    backgroundColor: palette.cardStrong,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  cameraEntryText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "900",
  },
  identityWordmark: {
    color: palette.text,
    fontSize: Platform.select({ ios: 23, default: 15 }),
    lineHeight: Platform.select({ ios: 27, default: undefined }),
    fontWeight: "900",
    letterSpacing: Platform.select({ ios: -0.35, default: 0.2 }),
  },
  identityTagline: {
    color: palette.textSoft,
    fontSize: Platform.select({ ios: 11, default: 12 }),
    lineHeight: Platform.select({ ios: 15, default: undefined }),
    fontWeight: Platform.select({ ios: "800", default: "600" }),
    letterSpacing: Platform.select({ ios: 0.9, default: 0 }),
    textTransform: Platform.select({ ios: "uppercase", default: "none" }),
  },
  heroClipShell: Platform.select({
    ios: {
      borderRadius: 36,
      borderCurve: "circular",
      overflow: "hidden",
    },
    default: {},
  }),
  hero: {
    borderRadius: 36,
    overflow: "hidden",
    borderCurve: Platform.select({ ios: "circular", default: "continuous" }),
    borderWidth: 1,
    borderColor: palette.borderStrong,
    ...Platform.select({
      ios: {},
      default: { boxShadow: `0 30px 80px ${palette.shadow}` },
    }),
  },
  heroGlass: {
    borderRadius: 36,
    borderCurve: Platform.select({ ios: "circular", default: "continuous" }),
    overflow: "hidden",
    padding: 20,
    gap: 16,
  },
  heroHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  heroHeadline: {
    flex: 1,
    flexShrink: 1,
    color: palette.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
  },
  captureModeStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderRadius: 16,
    borderCurve: "continuous",
  },
  captureModeHint: {
    color: palette.textMuted,
    fontSize: 12,
    letterSpacing: 0.1,
  },
  iosPhotoPrivacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(102,225,209,0.2)",
    backgroundColor: "rgba(102,225,209,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iosPhotoPrivacyText: {
    flex: 1,
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  captureModePill: {
    borderRadius: 999,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  captureModePillActive: {
    borderColor: "rgba(142,208,255,0.58)",
    backgroundColor: "rgba(142,208,255,0.2)",
  },
  captureModePillInactive: {
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  captureModePillPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  captureModePillText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  captureModePillTextActive: {
    color: palette.text,
  },
  captureStage: {
    gap: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 2,
  },
  heroPhotoFrame: {
    position: "relative",
    width: "100%",
    aspectRatio: 0.92,
    borderRadius: 28,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  heroPhoto: {
    width: "100%",
    height: "100%",
  },
  heroPhotoScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "42%",
  },
  heroPhotoBadge: {
    position: "absolute",
    left: 14,
    bottom: 14,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  heroPhotoBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyCapture: {
    minHeight: 280,
    borderRadius: 30,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
    backgroundColor: "rgba(142,208,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(142,208,255,0.16)",
  },
  emptyCapturePressed: {
    backgroundColor: "rgba(142,208,255,0.11)",
    transform: [{ scale: 0.99 }],
  },
  captureIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(142,208,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(142,208,255,0.32)",
  },
  captureIconPlus: {
    color: palette.cyan,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "300",
  },
  emptyCaptureTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "800",
  },
  emptyCaptureBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 260,
  },
  photoRail: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 2,
  },
  photoCoach: {
    overflow: "hidden",
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  photoCoachSuccess: {
    borderColor: "rgba(107,227,165,0.26)",
    backgroundColor: "rgba(107,227,165,0.08)",
  },
  photoCoachWarning: {
    borderColor: "rgba(249,199,114,0.28)",
    backgroundColor: "rgba(249,199,114,0.08)",
  },
  photoCoachDanger: {
    borderColor: "rgba(243,154,177,0.26)",
    backgroundColor: "rgba(243,154,177,0.08)",
  },
  photoCoachHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderRadius: 12,
    borderCurve: "continuous",
  },
  photoCoachScore: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  photoCoachScoreText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
  },
  photoCoachCopy: {
    flex: 1,
    gap: 4,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  photoCoachTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
  },
  photoCoachBody: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  photoCoachChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 2,
  },
  photoCoachChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  photoCoachChipText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  selectedPhotoSwipeShell: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: "rgba(243,154,177,0.12)",
  },
  selectedPhotoRemoveLane: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
    paddingLeft: 8,
    backgroundColor: "rgba(243,154,177,0.18)",
    borderRadius: 20,
  },
  selectedPhotoRemoveText: {
    color: palette.rose,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  thumbnailShell: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderCurve: "continuous",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    opacity: 0.7,
    backgroundColor: palette.backgroundAlt,
  },
  thumbnailShellActive: {
    opacity: 1,
    borderColor: palette.cyan,
  },
  thumbnailShellPressed: {
    transform: [{ scale: 0.96 }],
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  thumbnailLeadBadge: {
    position: "absolute",
    left: 5,
    bottom: 5,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "rgba(4,17,29,0.74)",
    borderWidth: 1,
    borderColor: "rgba(142,208,255,0.35)",
  },
  thumbnailLeadText: {
    color: palette.text,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  thumbnailRemoveButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(4,17,29,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  thumbnailRemoveButtonPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: "rgba(243,154,177,0.86)",
  },
  thumbnailRemoveText: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "900",
  },
  morePill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  },
  morePillText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  placeholderStage: {
    minHeight: 360,
    borderRadius: 28,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  placeholderCard: {
    position: "absolute",
    width: "82%",
    aspectRatio: 0.84,
    borderRadius: 30,
    borderCurve: "continuous",
  },
  placeholderBack: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 30,
    borderCurve: "continuous",
    transform: [{ rotate: "-8deg" }, { translateX: -18 }, { translateY: 10 }],
  },
  placeholderMid: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 30,
    borderCurve: "continuous",
    transform: [{ rotate: "7deg" }, { translateX: 22 }, { translateY: -6 }],
  },
  placeholderFront: {
    overflow: "hidden",
    borderRadius: 30,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 24,
    justifyContent: "flex-end",
    gap: 10,
  },
  placeholderEyebrow: {
    color: palette.cyan,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  placeholderTitle: {
    color: palette.text,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
  },
  placeholderBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  heroCtas: {
    gap: 10,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 2,
  },
  strategyBlock: {
    gap: 10,
    paddingTop: 4,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 2,
  },
  strategyLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "700",
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 2,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 2,
  },
  queueStack: {
    gap: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 2,
  },
  queueToolbar: {
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(142,208,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.045)",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  queueToolbarText: {
    width: "100%",
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  queueToolbarActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 2,
  },
  swipeShell: {
    borderRadius: 28,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  swipeActionBackground: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
    paddingLeft: 22,
    gap: 2,
    borderRadius: 28,
  },
  swipeActionText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
  },
  swipeActionHint: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  queueCard: {
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#0F1F2E",
    overflow: "hidden",
  },
  queueCardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  queueGlow: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  queueCardContent: {
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderRadius: 16,
    borderCurve: "continuous",
  },
  queueThumb: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  queueThumbPlaceholder: {
    width: 74,
    height: 74,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  queueThumbPlus: {
    color: palette.cyan,
    fontSize: 30,
    fontWeight: "300",
  },
  queueCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  queueTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  queueTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  queueSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  queueProgressTrack: {
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  queueProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.teal,
  },
  queueActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  queueTimestamp: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "700",
    marginRight: "auto",
  },
  queueAction: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(142,208,255,0.28)",
    backgroundColor: "rgba(142,208,255,0.08)",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  queueActionPressed: {
    transform: [{ scale: 0.96 }],
  },
  queueActionDisabled: {
    opacity: 0.45,
  },
  queueActionText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "800",
  },
  queueSheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  queueSheetBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(2, 8, 18, 0.62)",
  },
  queueSheet: {
    width: "100%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  queueSheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginBottom: 4,
  },
  queueSheetEyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  queueSheetTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
  },
  queueSheetSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  queueSheetButton: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  queueSheetButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.82,
  },
  queueSheetButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  queueSheetNote: {
    fontSize: 13,
    lineHeight: 18,
  },
  queueSheetDismiss: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  queueSheetDismissText: {
    fontSize: 14,
    fontWeight: "800",
  },
  emptyQueueCard: {
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 5,
  },
  emptyQueueTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
  },
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
    color: palette.rose,
    fontSize: 13,
    lineHeight: 19,
  },
  accountBar: {
    minHeight: 72,
    borderRadius: 24,
    borderCurve: "continuous",
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  accountCopy: {
    flex: 1,
    gap: 3,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  accountActions: {
    alignItems: "flex-end",
    gap: 10,
    justifyContent: "center",
    borderRadius: 12,
    borderCurve: "continuous",
  },
  accountActionDisabled: {
    opacity: 0.45,
  },
  accountLabel: {
    color: palette.textSoft,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  accountValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  signOutText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoChip: {
    minWidth: 128,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  infoLabel: {
    color: palette.textSoft,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  featureStack: {
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  featureDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 6,
    backgroundColor: palette.cyanStrong,
  },
  featureCopy: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  featureBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
});
