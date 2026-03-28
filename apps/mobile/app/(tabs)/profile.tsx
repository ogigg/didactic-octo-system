import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuthStore } from "@/stores/auth-store";

import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  Elevation,
  Fonts,
  Opacity,
  Radii,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

const MOCK_TOTAL_TRAININGS = 47;
const MOCK_WEEKLY_DURATIONS = [
  { week: "W1", minutes: 65 },
  { week: "W2", minutes: 90 },
  { week: "W3", minutes: 45 },
  { week: "W4", minutes: 110 },
  { week: "W5", minutes: 80 },
  { week: "W6", minutes: 0 },
  { week: "W7", minutes: 95 },
  { week: "W8", minutes: 70 },
  { week: "W9", minutes: 55 },
  { week: "W10", minutes: 100 },
  { week: "W11", minutes: 85 },
  { week: "W12", minutes: 60 },
];

const VISIBLE_WEEK_LABELS = new Set(["W1", "W4", "W7", "W10"]);

const MAX_BAR_HEIGHT = 120;

interface NavItem {
  icon: "chart.bar.fill" | "calendar" | "ruler.fill" | "clock.arrow.circlepath";
  labelKey: string;
  disabled: boolean;
  route?: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: "chart.bar.fill", labelKey: "nav.statistics", disabled: true },
  {
    icon: "calendar",
    labelKey: "nav.calendar",
    disabled: false,
    route: "/(tabs)/calendar",
  },
  { icon: "ruler.fill", labelKey: "nav.measures", disabled: true },
  {
    icon: "clock.arrow.circlepath",
    labelKey: "nav.history",
    disabled: false,
    route: "/history",
  },
];

export default function ProfileScreen() {
  const { t } = useTranslation("profile");
  const { t: tAuth } = useTranslation("auth");
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);

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
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const border = useThemeColor({}, "border");
  const errorColor = useThemeColor({}, "error");

  const maxMinutes = Math.max(...MOCK_WEEKLY_DURATIONS.map((d) => d.minutes));

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <Text style={[Typography.displayLg, { color: textColor }]}>
            {t("title")}
          </Text>
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            {t("subtitle")}
          </Text>

          {/* Stat Card */}
          <View
            style={[
              styles.card,
              styles.statCard,
              { backgroundColor: backgroundSubtle },
              Elevation.sm,
            ]}
          >
            <Text
              style={[
                styles.statNumber,
                { color: primary, fontFamily: Fonts?.rounded },
              ]}
            >
              {MOCK_TOTAL_TRAININGS}
            </Text>
            <Text style={[Typography.label, { color: textMuted }]}>
              {t("stats.trainingsCompleted")}
            </Text>
          </View>

          {/* Bar Chart Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: backgroundSubtle },
              Elevation.sm,
            ]}
          >
            <Text style={[Typography.titleSm, { color: textColor }]}>
              {t("chart.title")}
            </Text>
            <Text
              style={[
                Typography.caption,
                { color: textMuted },
                styles.chartSubtitle,
              ]}
            >
              {t("chart.subtitle")}
            </Text>
            <View style={styles.chartContainer}>
              {MOCK_WEEKLY_DURATIONS.map((entry) => {
                const barHeight =
                  maxMinutes > 0
                    ? (entry.minutes / maxMinutes) * MAX_BAR_HEIGHT
                    : 0;
                return (
                  <View key={entry.week} style={styles.barColumn}>
                    <View style={styles.barWrapper}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: Math.max(barHeight, 2),
                            backgroundColor:
                              entry.minutes > 0 ? primary : border,
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
          </View>

          {/* Nav Grid */}
          <View style={styles.navGrid}>
            {NAV_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.labelKey}
                style={[
                  styles.navButton,
                  { backgroundColor: backgroundSubtle },
                  Elevation.sm,
                  item.disabled && { opacity: Opacity.disabled },
                ]}
                disabled={item.disabled}
                accessibilityRole="button"
                accessibilityLabel={t(item.labelKey)}
                onPress={
                  item.route
                    ? () => router.navigate(item.route as never)
                    : undefined
                }
              >
                <IconSymbol
                  name={item.icon}
                  size={24}
                  color={item.disabled ? textMuted : primary}
                />
                <Text
                  style={[
                    Typography.titleSm,
                    {
                      color: item.disabled ? textMuted : textColor,
                    },
                    styles.navLabel,
                  ]}
                >
                  {t(item.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Logout */}
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { backgroundColor: backgroundSubtle },
              Elevation.sm,
            ]}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel={tAuth("logout.button")}
          >
            <Text style={[Typography.titleSm, { color: errorColor }]}>
              {tAuth("logout.button")}
            </Text>
          </TouchableOpacity>
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
  subtitle: {
    marginTop: Spacing.xs,
  },
  card: {
    borderRadius: Radii.lg,
    padding: Spacing.xl,
  },
  statCard: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 48,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  chartSubtitle: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.xs,
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
    borderTopLeftRadius: Radii.sm,
    borderTopRightRadius: Radii.sm,
  },
  navGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  navButton: {
    width: "48%",
    flexGrow: 1,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    marginTop: Spacing.sm,
  },
  logoutButton: {
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
});
