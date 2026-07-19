import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppGlass } from "@/components/app-glass";
import { billingPlans } from "@/config/billing";
import type { PurchasesPackage, RevenueCatState } from "@/lib/revenuecat";
import type { BillingSummary } from "@/shared/contracts";
import { type Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

export function BillingCard({
  billing,
  loading,
  onUpgrade,
}: {
  billing?: BillingSummary;
  loading?: boolean;
  onUpgrade: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const plan = billing?.plan ?? "free";
  const planInfo = billingPlans[plan];
  const remaining = billing?.usage.remainingCredits ?? planInfo.includedCredits;
  const total = (billing?.usage.includedCredits ?? planInfo.includedCredits) + (billing?.usage.extraCredits ?? 0);
  const usedRatio = total > 0 ? Math.min(1, Math.max(0, (billing?.usage.usedCredits ?? 0) / total)) : 0;

  return (
    <AppGlass intensity={72} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.planBubble}>
          <Text selectable style={styles.planBubbleText}>{planInfo.title}</Text>
        </View>
        <Text selectable style={styles.statusText}>
          {billing?.featureAccess.enforcementMode === "observe" ? "Metering live" : "Limits enforced"}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text selectable style={styles.title}>{remaining} AI listings left</Text>
        <Text selectable style={styles.body}>
          {loading ? "Checking subscription..." : `${billing?.usage.usedCredits ?? 0} of ${total} used this month. Upgrade when ListingOS becomes part of your daily flow.`}
        </Text>
      </View>
      <View style={styles.meterTrack}>
        <LinearGradient
          colors={["#8ED0FF", "#66E1D1"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.meterFill, { width: `${Math.max(4, usedRatio * 100)}%` }]}
        />
      </View>
      <View style={styles.footer}>
        <Text selectable style={styles.footerText}>{planInfo.monthlyPrice} · {planInfo.includedCredits} credits/mo</Text>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onUpgrade}>
          <Text style={styles.upgradeText}>{plan === "free" ? "See plans" : "Manage plan"}</Text>
        </Pressable>
      </View>
    </AppGlass>
  );
}

export function PaywallPanel({
  billing,
  revenueCat,
  purchasingPackageId,
  onPurchase,
  onRestore,
  onClose,
}: {
  billing?: BillingSummary;
  revenueCat: RevenueCatState | null;
  purchasingPackageId: string | null;
  onPurchase: (pkg: PurchasesPackage) => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const nativeReady = Boolean(revenueCat?.configured && revenueCat.packages.length > 0);
  const packageByProduct = new Map(
    (revenueCat?.packages ?? []).map((pkg) => [normalizePlanProductId(pkg.product.identifier), pkg]),
  );

  return (
    <View style={styles.paywall}>
      <View style={styles.paywallHeader}>
        <Text selectable style={styles.paywallEyebrow}>RevenueCat subscriptions</Text>
        <Pressable accessibilityRole="button" onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
      <Text selectable style={styles.paywallTitle}>Pay for saved time, not random locks.</Text>
      <Text selectable style={styles.paywallBody}>
        Free gets you to the aha moment. Paid plans unlock more monthly AI listings, autopublish, and higher-volume workflow.
      </Text>
      {!nativeReady ? (
        <View style={styles.setupNotice}>
          <Text selectable style={styles.setupTitle}>RevenueCat catalog pending in this build</Text>
          <Text selectable style={styles.setupBody}>
            {revenueCat?.errorMessage ?? "Install a native build with RevenueCat keys and a current offering to purchase. Usage metering still works."}
          </Text>
        </View>
      ) : null}
      <View style={styles.planStack}>
        {(["starter", "pro", "studio"] as const).map((plan) => {
          const info = billingPlans[plan];
          const monthlyPackage = packageByProduct.get(`listingos_${plan}_monthly`);
          const annualPackage = packageByProduct.get(`listingos_${plan}_annual`);
          return (
            <View key={plan} style={[styles.planCard, billing?.plan === plan ? styles.planCardActive : null]}>
              <View style={styles.planTop}>
                <Text selectable style={styles.planTitle}>{info.title}</Text>
                <Text selectable style={styles.planPrice}>{info.monthlyPrice}</Text>
              </View>
              <Text selectable style={styles.planDescription}>{info.description}</Text>
              {info.benefits.map((benefit) => (
                <Text selectable key={benefit} style={styles.benefit}>- {benefit}</Text>
              ))}
              <View style={styles.planActions}>
                <PlanButton
                  disabled={!monthlyPackage}
                  label={monthlyPackage?.product.priceString ?? info.monthlyPrice}
                  loading={purchasingPackageId === monthlyPackage?.identifier}
                  onPress={() => monthlyPackage ? onPurchase(monthlyPackage) : undefined}
                />
                <PlanButton
                  disabled={!annualPackage}
                  label={annualPackage?.product.priceString ?? info.annualPrice}
                  loading={purchasingPackageId === annualPackage?.identifier}
                  onPress={() => annualPackage ? onPurchase(annualPackage) : undefined}
                />
              </View>
            </View>
          );
        })}
      </View>
      <AppButton label="Restore purchases" tone="secondary" onPress={onRestore} />
    </View>
  );
}

function normalizePlanProductId(identifier: string) {
  const [baseId, basePlan] = identifier.split(":");
  if (!basePlan) return identifier;
  if (basePlan === "annual" && baseId.endsWith("_annual")) return baseId;
  return `${baseId}_${basePlan}`;
}

function PlanButton({ label, disabled, loading, onPress }: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.planButton, pressed ? styles.planButtonPressed : null, disabled ? styles.planButtonDisabled : null]}
    >
      {loading ? <ActivityIndicator color="#07111B" size="small" /> : <Text style={styles.planButtonText}>{label}</Text>}
    </Pressable>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  card: {
    borderColor: "rgba(102,225,209,0.18)",
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    gap: 14,
    overflow: "hidden",
    padding: 18,
  },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  planBubble: { backgroundColor: "rgba(102,225,209,0.14)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  planBubbleText: { color: palette.teal, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  statusText: { color: palette.textSoft, fontSize: 12, fontWeight: "700" },
  copy: { gap: 4 },
  title: { color: palette.text, fontSize: 22, fontWeight: "900" },
  body: { color: palette.textMuted, fontSize: 13, lineHeight: 19 },
  meterTrack: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, height: 8, overflow: "hidden" },
  meterFill: { borderRadius: 999, height: "100%" },
  footer: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  footerText: { color: palette.textSoft, flex: 1, fontSize: 12, fontWeight: "700" },
  upgradeText: { color: palette.cyan, fontSize: 13, fontWeight: "900" },
  paywall: { gap: 16, paddingBottom: 24 },
  paywallHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  paywallEyebrow: { color: palette.teal, fontSize: 12, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  closeText: { color: palette.cyan, fontSize: 14, fontWeight: "800" },
  paywallTitle: { color: palette.text, fontSize: 26, fontWeight: "900", lineHeight: 30 },
  paywallBody: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },
  setupNotice: { backgroundColor: "rgba(249,199,114,0.1)", borderColor: "rgba(249,199,114,0.2)", borderRadius: 22, borderWidth: 1, gap: 4, padding: 14 },
  setupTitle: { color: palette.gold, fontSize: 14, fontWeight: "900" },
  setupBody: { color: palette.textMuted, fontSize: 13, lineHeight: 19 },
  planStack: { gap: 12 },
  planCard: { backgroundColor: "rgba(255,255,255,0.055)", borderColor: "rgba(255,255,255,0.08)", borderRadius: 24, borderWidth: 1, gap: 10, padding: 16 },
  planCardActive: { borderColor: "rgba(102,225,209,0.42)" },
  planTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  planTitle: { color: palette.text, fontSize: 19, fontWeight: "900" },
  planPrice: { color: palette.cyan, fontSize: 14, fontWeight: "900" },
  planDescription: { color: palette.textMuted, fontSize: 13, lineHeight: 19 },
  benefit: { color: palette.text, fontSize: 13, lineHeight: 20 },
  planActions: { flexDirection: "row", gap: 10 },
  planButton: { alignItems: "center", backgroundColor: palette.teal, borderRadius: 16, flex: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  planButtonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  planButtonDisabled: { backgroundColor: "rgba(255,255,255,0.14)" },
  planButtonText: { color: "#07111B", fontSize: 13, fontWeight: "900" },
});
