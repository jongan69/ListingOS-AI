import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppButton } from "@/components/app-button";
import { AppGlass } from "@/components/app-glass";
import { AppScreen } from "@/components/app-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { StatusPill } from "@/components/status-pill";
import { SurfaceCard } from "@/components/surface-card";
import { appConfig } from "@/config/app";
import { brand } from "@/config/brand";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/storage";
import { type UploadProgress, uploadProgressKey } from "@/lib/upload-progress";
import { workStatusGradient, workStatusTone } from "@/lib/work-status";
import { type Palette } from "@/theme/palette";
import { useGradients, usePalette } from "@/theme/theme";

export function BatchDetailScreen() {
  const palette = usePalette();
  const gradients = useGradients();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const params = useLocalSearchParams<{ "batch-id": string }>();
  const batchId = params["batch-id"];
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiBaseUrl = appConfig.apiBaseUrl;
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const didAutoforwardRef = useRef(false);

  useEffect(() => {
    void (async () => {
      setSessionToken(await getSessionToken());
    })();
  }, []);

  const query = useQuery({
    queryKey: ["batch-jobs", apiBaseUrl, sessionToken, batchId],
    enabled: Boolean(batchId && sessionToken),
    refetchInterval: (result) => {
      const jobs = result.state.data ?? [];
      const terminal = jobs.length > 0 && jobs.every((job) => ["ready", "needs_input", "blocked", "published", "failed"].includes(job.status));
      return terminal ? false : 1_000;
    },
    queryFn: () => api.listBatchJobs({ apiBaseUrl, sessionToken }, batchId!),
  });

  const uploadProgressQuery = useQuery<UploadProgress>({
    queryKey: uploadProgressKey(batchId ?? "pending"),
    enabled: false,
    queryFn: async () => {
      const progress = queryClient.getQueryData<UploadProgress>(uploadProgressKey(batchId ?? "pending"));
      if (!progress) throw new Error("Upload progress is unavailable.");
      return progress;
    },
  });
  const uploadProgress = uploadProgressQuery.data;

  const retryMutation = useMutation({
    mutationFn: () => api.queueDraftGeneration(
      { apiBaseUrl, sessionToken },
      { batchId: batchId!, pricingStrategy: uploadProgress?.pricingStrategy ?? "balanced" },
    ),
    onSuccess: async () => {
      setElapsedSeconds(0);
      await queryClient.invalidateQueries({ queryKey: ["batch-jobs", apiBaseUrl, sessionToken, batchId] });
    },
  });

  const retryJobMutation = useMutation({
    mutationFn: (jobId: string) => api.retryQueueItem({ apiBaseUrl, sessionToken }, jobId),
    onSuccess: async () => {
      setElapsedSeconds(0);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["batch-jobs", apiBaseUrl, sessionToken, batchId] }),
        queryClient.invalidateQueries({ queryKey: ["queue", apiBaseUrl, sessionToken] }),
      ]);
    },
  });

  const summary = useMemo(() => {
    const jobs = query.data ?? [];
    return {
      total: jobs.length,
      ready: jobs.filter((job) => job.status === "ready" || job.status === "published").length,
      needsInput: jobs.filter((job) => job.status === "needs_input" || job.status === "blocked").length,
      processing: jobs.filter((job) => job.status === "queued" || job.status === "processing" || job.status === "publishing").length,
      singleDraftId:
        jobs.length === 1
          && jobs[0]?.draftId
          && ["ready", "needs_input", "blocked", "published"].includes(jobs[0].status)
          ? jobs[0].draftId
          : null,
    };
  }, [query.data]);

  useEffect(() => {
    if (!batchId || summary.total === 0) return;
    queryClient.setQueryData<UploadProgress>(uploadProgressKey(batchId), (current) => current ? {
      ...current,
      status: "complete",
      completed: current.total,
      errorMessage: null,
    } : current);
  }, [batchId, queryClient, summary.total]);

  useEffect(() => {
    if (!summary.singleDraftId || didAutoforwardRef.current) return;
    didAutoforwardRef.current = true;
    router.replace(`/drafts/${summary.singleDraftId}`);
  }, [router, summary.singleDraftId]);

  useEffect(() => {
    if (summary.ready > 0 || summary.needsInput > 0 || uploadProgress?.status === "failed") return;
    const timer = setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [summary.needsInput, summary.ready, uploadProgress?.status]);

  const phaseTitle = uploadProgress?.status === "failed"
    ? "Upload needs attention"
    : uploadProgress?.status === "uploading"
      ? `Uploading ${uploadProgress.completed} of ${uploadProgress.total} photos`
      : summary.needsInput > 0
        ? "One detail needs review"
        : summary.ready > 0
          ? "Your listing is ready"
          : summary.processing > 0
            ? "Finalizing the listing"
            : elapsedSeconds > 20
              ? "Still preparing the draft"
              : "Building your listing";
  const progressRatio = uploadProgress?.status === "uploading" && uploadProgress.total > 0
    ? Math.min(0.62, (uploadProgress.completed / uploadProgress.total) * 0.62)
    : summary.ready > 0 || summary.needsInput > 0
      ? 1
      : summary.processing > 0
        ? 0.78
        : uploadProgress?.status === "complete"
          ? 0.66
          : 0.08;
  const queueBadge = uploadProgress?.status === "failed"
    ? "Needs attention"
    : uploadProgress?.status === "uploading"
      ? "Keep app open"
      : summary.ready > 0 || summary.needsInput > 0
        ? "Review ready"
        : "Server queue active";
  const phaseSubtitle = uploadProgress?.status === "uploading"
    ? "Keep ListingOS open until the photo upload finishes. The server takes over drafting immediately after the last photo lands."
    : summary.ready > 0 || summary.needsInput > 0
      ? "The draft is saved and ready to review. Pull to refresh if this screen does not open it automatically."
      : "Your photos are uploaded and the server queue is building the draft. You can leave this screen and follow progress from Home.";

  async function refreshBatch() {
    await Promise.allSettled([
      query.refetch(),
      queryClient.invalidateQueries({ queryKey: ["queue", apiBaseUrl, sessionToken] }),
    ]);
  }

  return (
    <AppScreen onRefresh={refreshBatch}>
        <ScreenToolbar title={`${brand.shortName} progress`} onBack={() => router.replace("/")} />
        <LinearGradient
          colors={gradients.hero as [string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <AppGlass intensity={55} style={styles.heroGlass}>
            <View style={styles.heroTop}>
              <StatusPill label={queueBadge} tone="accent" />
              <StatusPill
                label={uploadProgress?.status === "failed" ? "Needs retry" : summary.ready > 0 ? "Ready" : "In progress"}
                tone={uploadProgress?.status === "failed" ? "danger" : summary.ready > 0 ? "success" : "warning"}
              />
            </View>
            <Text accessibilityLiveRegion="polite" selectable style={styles.heroTitle}>{phaseTitle}</Text>
            <Text selectable style={styles.heroSubtitle}>{phaseSubtitle}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(6, Math.round(progressRatio * 100))}%` }]} />
            </View>
            {uploadProgress?.status !== "failed" && summary.ready === 0 ? <ActivityIndicator color={palette.cyan} /> : null}
          </AppGlass>
        </LinearGradient>

        {uploadProgress?.status === "failed" ? (
          <SurfaceCard eyebrow="Could not finish" title="Your photos are still on this phone" subtitle={uploadProgress.errorMessage ?? "The upload stopped before ListingOS could start drafting."}>
            <AppButton label="Choose photos again" onPress={() => router.replace("/")} />
          </SurfaceCard>
        ) : null}

        {query.isError ? (
          <SurfaceCard eyebrow="Connection" title="Could not refresh progress" subtitle={query.error instanceof Error ? query.error.message : "Check your connection and try again."}>
            <AppButton label="Try again" onPress={() => void query.refetch()} loading={query.isFetching} />
          </SurfaceCard>
        ) : null}

        {summary.total > 0 ? <SurfaceCard
          eyebrow="Jobs"
          title={summary.total === 1 ? "Your listing" : `${summary.total} listings`}
          subtitle="Tap any item that is ready to review."
        >
          <View style={styles.jobStack}>
            {query.data?.map((job) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={!job.draftId}
                  key={job.id}
                  onPress={() => job.draftId && router.push(`/drafts/${job.draftId}`)}
                  style={({ pressed }) => [styles.jobCard, pressed ? styles.jobCardPressed : null]}
                >
                  <LinearGradient
                    colors={workStatusGradient(job.status)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.jobGlow}
                  />
                  <View style={styles.jobHeader}>
                    <View style={styles.jobTitleBlock}>
                      <Text selectable style={styles.jobTitle}>{job.clusterLabel ?? "Queued product"}</Text>
                      <Text selectable style={styles.jobMeta}>
                        {job.listingMode ? job.listingMode.replaceAll("_", " ") : "AI choosing best mode"}
                      </Text>
                    </View>
                    <StatusPill label={job.status.replaceAll("_", " ")} tone={workStatusTone(job.status)} />
                  </View>
                  {job.errorMessage ? <Text selectable style={styles.errorText}>{job.errorMessage}</Text> : null}
                  {job.status === "failed" ? (
                    <View style={styles.retryRow}>
                      <AppButton
                        label="Retry failed step"
                        tone="secondary"
                        onPress={() => retryJobMutation.mutate(job.id)}
                        loading={retryJobMutation.isPending && retryJobMutation.variables === job.id}
                        disabled={retryJobMutation.isPending}
                      />
                      <AppButton label="Edit from scratch" tone="secondary" onPress={() => router.replace("/")} />
                    </View>
                  ) : null}
                </Pressable>
            ))}
          </View>
        </SurfaceCard> : null}

        {!query.isError && summary.total === 0 && uploadProgress?.status !== "failed" ? (
          <SurfaceCard
            eyebrow="Draft queue"
            title={uploadProgress?.status === "uploading" ? "Uploading securely" : elapsedSeconds > 20 ? "This is taking longer than expected" : "Starting the draft"}
            subtitle={uploadProgress?.status === "uploading"
              ? "Keep the app open until uploads finish. Drafting starts as soon as the last photo lands."
              : elapsedSeconds > 20
                ? "Retry safely requeues this batch without duplicating listings."
                : "This normally takes only a few seconds."}
          >
            <View style={styles.retryRow}>
              <Text accessibilityLiveRegion="polite" selectable style={styles.waitingText}>
                {elapsedSeconds > 0 ? `${elapsedSeconds}s elapsed` : "Starting now"}
              </Text>
              {elapsedSeconds > 20 ? (
                <AppButton
                  label="Retry draft"
                  onPress={() => retryMutation.mutate()}
                  loading={retryMutation.isPending}
                />
              ) : null}
            </View>
            {retryMutation.isError ? (
              <Text selectable style={styles.errorText}>
                {retryMutation.error instanceof Error ? retryMutation.error.message : "Retry failed. Try again."}
              </Text>
            ) : null}
          </SurfaceCard>
        ) : null}
    </AppScreen>
  );
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
    padding: 22,
    gap: 16,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  heroTitle: {
    color: palette.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.teal,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statBubble: {
    minWidth: 90,
    borderRadius: 22,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    color: palette.textSoft,
    fontSize: 12,
    marginTop: 2,
  },
  batchIdCard: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 6,
  },
  batchIdValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700",
  },
  batchIdLabel: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "600",
  },
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  jobStack: {
    gap: 12,
  },
  jobCard: {
    borderRadius: 26,
    borderCurve: "continuous",
    padding: 16,
    backgroundColor: palette.cardStrong,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
    overflow: "hidden",
  },
  jobCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  jobGlow: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  jobTitleBlock: {
    flex: 1,
    minWidth: 180,
    gap: 5,
  },
  jobTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: "700",
  },
  jobMeta: {
    color: palette.textSoft,
    fontSize: 13,
  },
  errorText: {
    color: palette.rose,
    fontSize: 13,
    lineHeight: 19,
  },
  emptyState: {
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  retryRow: {
    gap: 12,
  },
  waitingText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    paddingVertical: 8,
  },
});
