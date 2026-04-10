import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProBadge } from "@/components/subscription/pro-badge";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSubscription } from "@/hooks/use-subscription";

interface BenefitItemProps {
  iconName: "bolt.fill" | "chart.xyaxis.line" | "timer" | "scope";
  title: string;
  description: string;
}

function BenefitItem({ iconName, title, description }: BenefitItemProps) {
  const primarySurface = useThemeColor({}, "primarySurface");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  return (
    <View
      style={styles.benefitItem}
      accessible
      accessibilityLabel={`${title}. ${description}`}
    >
      <View style={[styles.benefitIcon, { backgroundColor: primarySurface }]}>
        <IconSymbol name={iconName} size={22} color={primary} />
      </View>
      <View style={styles.benefitText}>
        <Text style={[Typography.titleSm, { color: textColor }]}>{title}</Text>
        <Text
          style={[
            Typography.caption,
            { color: textSecondary },
            styles.benefitDescription,
          ]}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

export default function SubscriptionScreen() {
  const { t } = useTranslation("subscription");
  const { tier, isProActive, weeklyUsage, weeklyLimit, isLoading } =
    useSubscription();

  const background = useThemeColor({}, "background");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const borderSubtle = useThemeColor({}, "borderSubtle");

  const ratio =
    weeklyLimit === 0 || !isFinite(weeklyLimit)
      ? 0
      : Math.min(weeklyUsage / weeklyLimit, 1);

  function handleUpgrade() {
    Alert.alert(t("screen.upgradeCta"), t("screen.comingSoon"));
  }

  const planTitle = isProActive
    ? t("screen.currentPlan.proTitle")
    : t("screen.currentPlan.freeTitle");

  const planDescription = isProActive
    ? t("screen.currentPlan.proDescription")
    : t("screen.currentPlan.freeDescription");

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton accessibilityLabel="Go back" />
          <Text
            style={[Typography.titleMd, { color: textColor }]}
            accessibilityRole="header"
          >
            {t("screen.title")}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Current Plan Card */}
          <View
            style={[
              styles.planCard,
              { backgroundColor: backgroundSubtle, borderColor: border },
            ]}
          >
            <View style={styles.planTitleRow}>
              <Text style={[Typography.titleLg, { color: textColor }]}>
                {planTitle}
              </Text>
              {isProActive && <ProBadge />}
            </View>
            <Text
              style={[
                Typography.body,
                { color: textSecondary },
                styles.planDescription,
              ]}
            >
              {planDescription}
            </Text>

            {!isLoading && !isProActive && (
              <>
                <View style={[styles.divider, { backgroundColor: border }]} />

                <Text
                  style={[
                    Typography.label,
                    { color: textMuted },
                    styles.weekLabel,
                  ]}
                >
                  {t("screen.currentPlan.thisWeek")}
                </Text>

                <Text
                  style={[
                    Typography.displaySm,
                    { color: textColor, fontVariant: ["tabular-nums"] },
                    styles.usageCount,
                  ]}
                >
                  {weeklyUsage} / {weeklyLimit}
                </Text>

                {/* Progress bar */}
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: borderSubtle },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: primary,
                        width: `${ratio * 100}%`,
                      },
                    ]}
                  />
                </View>
              </>
            )}
          </View>

          {/* Benefits */}
          {!isProActive && (
            <>
              <Text
                style={[
                  Typography.titleMd,
                  { color: textColor },
                  styles.benefitsTitle,
                ]}
              >
                {t("screen.benefitsTitle")}
              </Text>

              <View style={styles.benefitsList}>
                <BenefitItem
                  iconName="bolt.fill"
                  title={t("screen.benefits.unlimited.title")}
                  description={t("screen.benefits.unlimited.description")}
                />
                <BenefitItem
                  iconName="chart.xyaxis.line"
                  title={t("screen.benefits.insights.title")}
                  description={t("screen.benefits.insights.description")}
                />
                <BenefitItem
                  iconName="timer"
                  title={t("screen.benefits.priority.title")}
                  description={t("screen.benefits.priority.description")}
                />
                <BenefitItem
                  iconName="scope"
                  title={t("screen.benefits.focus.title")}
                  description={t("screen.benefits.focus.description")}
                />
              </View>

              <Button
                label={t("screen.upgradeCta")}
                onPress={handleUpgrade}
                accessibilityLabel={t("screen.upgradeCta")}
                style={styles.upgradeCta}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerSpacer: {
    width: 44,
  },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  planCard: {
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  planDescription: {
    marginBottom: Spacing.xs,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  weekLabel: {
    marginBottom: Spacing.xs,
  },
  usageCount: {
    marginBottom: Spacing.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: Radii.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: Radii.full,
  },
  benefitsTitle: {
    marginTop: Spacing["2xl"],
    marginBottom: Spacing.lg,
  },
  benefitsList: {
    gap: 0,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
  },
  benefitDescription: {
    marginTop: Spacing.xs,
  },
  upgradeCta: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
});
