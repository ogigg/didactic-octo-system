import { useCallback, useEffect, useState } from "react";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/stores/auth-store";

import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { GradientSurface } from "@/components/ui/gradient-surface";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Fonts, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeeklyDurations } from "@/hooks/use-weekly-durations";
import { useWorkoutStats } from "@/hooks/use-workout-stats";
import {
  changeAppLanguage,
  getCurrentLanguage,
  languageLabels,
  type AppLanguage,
} from "@/i18n";

const VISIBLE_WEEK_LABELS = new Set(["W1", "W4", "W7", "W10"]);

const MAX_BAR_HEIGHT = 96;

type IconName =
  | "chart.bar.fill"
  | "calendar"
  | "ruler.fill"
  | "clock.arrow.circlepath"
  | "gearshape.fill"
  | "flame.fill"
  | "globe"
  | "megaphone.fill"
  | "star.fill"
  | "heart.text.square";

interface NavItem {
  icon: IconName;
  labelKey:
    | "nav.statistics"
    | "nav.calendar"
    | "nav.measures"
    | "nav.history"
    | "nav.trainingPreferences"
    | "nav.strengthBaselines"
    | "nav.health"
    | "nav.subscription"
    | "nav.feedback";
  route?: Href;
}

const TRACKING_ITEMS: NavItem[] = [
  {
    icon: "chart.bar.fill",
    labelKey: "nav.statistics",
    route: "/statistics",
  },
  {
    icon: "calendar",
    labelKey: "nav.calendar",
    route: "/(tabs)/calendar",
  },
  {
    icon: "ruler.fill",
    labelKey: "nav.measures",
    route: "/measurements",
  },
  {
    icon: "clock.arrow.circlepath",
    labelKey: "nav.history",
    route: "/history",
  },
];

const SETTINGS_ITEMS: NavItem[] = [
  {
    icon: "gearshape.fill",
    labelKey: "nav.trainingPreferences",
    route: "/training-preferences",
  },
  {
    icon: "flame.fill",
    labelKey: "nav.strengthBaselines",
    route: "/strength-baselines",
  },
  {
    icon: "heart.text.square",
    labelKey: "nav.health",
    route: "/health-settings",
  },
];

const ACCOUNT_ITEMS: NavItem[] = [
  {
    icon: "star.fill",
    labelKey: "nav.subscription",
    route: "/subscription",
  },
  {
    icon: "megaphone.fill",
    labelKey: "nav.feedback",
    route: "/feedback",
  },
];

const LANGUAGE_OPTIONS: AppLanguage[] = ["en", "pl"];

export default function ProfileScreen() {
  const { t, i18n } = useTranslation("profile");
  const { t: tAuth } = useTranslation("auth");
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const [selectedLanguage, setSelectedLanguage] =
    useState<AppLanguage>(getCurrentLanguage);

  function handleLogout() {
    Alert.alert(tAuth("logout.confirmTitle"), tAuth("logout.confirmMessage"), [
      { text: tAuth("logout.cancel"), style: "cancel" },
      {
        text: tAuth("logout.confirm"),
        style: "destructive",
        onPress: () => signOut(),
      },
    ]);
  }

  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");
  const errorColor = useThemeColor({}, "error");
  const primaryContainer = useThemeColor({}, "primaryContainer");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");

  const {
    totalWorkouts,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useWorkoutStats();
  const {
    weeklyDurations,
    isLoading: weeklyLoading,
    refetch: refetchWeekly,
  } = useWeeklyDurations(12);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const updateLanguage = () => setSelectedLanguage(getCurrentLanguage());

    i18n.on("languageChanged", updateLanguage);
    updateLanguage();

    return () => {
      i18n.off("languageChanged", updateLanguage);
    };
  }, [i18n]);

  const handleLanguageChange = useCallback((language: AppLanguage) => {
    setSelectedLanguage(language);
    void changeAppLanguage(language).catch(() => {
      setSelectedLanguage(getCurrentLanguage());
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchWeekly()]);
    setRefreshing(false);
  }, [refetchStats, refetchWeekly]);

  const maxMinutes = weeklyLoading
    ? 0
    : Math.max(...weeklyDurations.map((d) => d.minutes), 0);

  const renderGroup = (items: NavItem[]) => (
    <ListGroup>
      {items.map((item, i) => {
        const route = item.route;

        return (
          <ListRow
            key={item.labelKey}
            icon={item.icon}
            label={t(item.labelKey)}
            onPress={route ? () => router.navigate(route) : undefined}
            position={
              items.length === 1
                ? "only"
                : i === 0
                  ? "first"
                  : i === items.length - 1
                    ? "last"
                    : "middle"
            }
          />
        );
      })}
    </ListGroup>
  );

  return (
    <View style={styles.root}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <Text style={[Typography.displayLg, { color: textColor }]}>
              {t("title")}
            </Text>
            <Text style={[Typography.body, { color: textSecondary }]}>
              {t("subtitle")}
            </Text>
          </View>

          {/* Hero stat — gradient wash, no hard card edge */}
          <GradientSurface variant="accent" radius="lg" style={styles.heroStat}>
            <Text
              style={[
                styles.heroNumber,
                { color: primary, fontFamily: Fonts?.rounded },
              ]}
            >
              {statsLoading ? "—" : (totalWorkouts ?? 0)}
            </Text>
            <Text style={[Typography.label, { color: textMuted }]}>
              {t("stats.trainingsCompleted")}
            </Text>
          </GradientSurface>

          {/* Weekly duration chart — soft surface gradient, inline title */}
          <GradientSurface
            variant="surface"
            radius="lg"
            style={styles.chartCard}
          >
            <View style={styles.chartHeader}>
              <Text style={[Typography.titleSm, { color: textColor }]}>
                {t("chart.title")}
              </Text>
              <Text style={[Typography.caption, { color: textMuted }]}>
                {t("chart.subtitle")}
              </Text>
            </View>
            <View style={styles.chartContainer}>
              {weeklyDurations.map((entry) => {
                const barHeight =
                  !weeklyLoading && maxMinutes > 0
                    ? (entry.minutes / maxMinutes) * MAX_BAR_HEIGHT
                    : 0;
                return (
                  <View key={entry.week} style={styles.barColumn}>
                    <View style={styles.barWrapper}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: weeklyLoading ? 2 : Math.max(barHeight, 2),
                            backgroundColor:
                              !weeklyLoading && entry.minutes > 0
                                ? primary
                                : border,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[Typography.micro, { color: textMuted }]}>
                      {VISIBLE_WEEK_LABELS.has(entry.week) ? entry.week : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          </GradientSurface>

          {/* Tracking group */}
          <View style={styles.group}>
            <SectionHeader title={t("sections.tracking")} />
            {renderGroup(TRACKING_ITEMS)}
          </View>

          {/* Settings group */}
          <View style={styles.group}>
            <SectionHeader title={t("sections.settings")} />
            <ListGroup>
              <ListRow
                icon="globe"
                label={t("language.label")}
                showChevron={false}
                position="first"
                trailing={
                  <View
                    style={[
                      styles.languageToggle,
                      { backgroundColor: backgroundSubtle },
                    ]}
                  >
                    {LANGUAGE_OPTIONS.map((language) => {
                      const selected = selectedLanguage === language;
                      const label =
                        language === "en"
                          ? t("language.english")
                          : t("language.polish");

                      return (
                        <Pressable
                          key={language}
                          onPress={() => handleLanguageChange(language)}
                          accessibilityRole="button"
                          accessibilityLabel={t("language.accessibility", {
                            language: languageLabels[language],
                          })}
                          accessibilityState={{ selected }}
                          style={({ pressed }) => [
                            styles.languageOption,
                            selected && { backgroundColor: primaryContainer },
                            pressed && { opacity: 0.75 },
                          ]}
                        >
                          <Text
                            style={[
                              Typography.caption,
                              styles.languageOptionLabel,
                              { color: selected ? primary : textSecondary },
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                }
              />
              {SETTINGS_ITEMS.map((item, i) => {
                const route = item.route;

                return (
                  <ListRow
                    key={item.labelKey}
                    icon={item.icon}
                    label={t(item.labelKey)}
                    onPress={route ? () => router.navigate(route) : undefined}
                    position={
                      i === SETTINGS_ITEMS.length - 1 ? "last" : "middle"
                    }
                  />
                );
              })}
            </ListGroup>
          </View>

          {/* Account group */}
          <View style={styles.group}>
            <SectionHeader title={t("sections.account")} />
            {renderGroup(ACCOUNT_ITEMS)}
          </View>

          {/* Logout */}
          <Button
            variant="destructive"
            label={tAuth("logout.button")}
            onPress={handleLogout}
            accessibilityLabel={tAuth("logout.button")}
            style={styles.logoutButton}
          />

          {/* Danger zone — irreversible account deletion. */}
          <Pressable
            onPress={() => router.navigate("/delete-account" as Href)}
            accessibilityRole="button"
            accessibilityLabel={t("nav.deleteAccount")}
            style={({ pressed }) => [
              styles.deleteAccountButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text
              style={[
                Typography.body,
                styles.deleteAccountLabel,
                { color: errorColor },
              ]}
            >
              {t("nav.deleteAccount")}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing["3xl"],
    gap: Spacing.xl,
  },
  headerBlock: {
    gap: Spacing.xs,
  },
  heroStat: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  heroNumber: {
    fontSize: 56,
    fontWeight: "700",
    letterSpacing: -1,
    marginBottom: Spacing.xs,
  },
  chartCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  chartHeader: {
    gap: 2,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
  },
  barWrapper: {
    height: MAX_BAR_HEIGHT,
    justifyContent: "flex-end",
    width: "100%",
  },
  bar: {
    width: "100%",
    borderRadius: 3,
  },
  group: {
    gap: Spacing.md,
  },
  logoutButton: {
    marginTop: Spacing.md,
  },
  deleteAccountButton: {
    alignSelf: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  deleteAccountLabel: {
    textAlign: "center",
  },
  languageToggle: {
    flexDirection: "row",
    borderRadius: Radii.sm,
    padding: 2,
  },
  languageOption: {
    minWidth: 48,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.sm - 2,
    paddingHorizontal: Spacing.sm,
  },
  languageOptionLabel: {
    fontWeight: "700",
  },
});
