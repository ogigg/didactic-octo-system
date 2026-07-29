import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { GradientSurface } from "@/components/ui/gradient-surface";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function AccountSettingsScreen() {
  const { t } = useTranslation("accountSettings");
  const router = useRouter();

  const background = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  const navigate = (route: Href) => router.navigate(route);

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title={t("header.title")}
          titleStyle={Typography.titleMd}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text style={[Typography.titleLg, { color: textColor }]}>
              {t("intro.title")}
            </Text>
            <Text style={[Typography.body, { color: textSecondary }]}>
              {t("intro.body")}
            </Text>
          </View>

          <View style={styles.section}>
            <SectionHeader title={t("sections.management")} />
            <ListGroup>
              <ListRow
                icon="star.fill"
                label={t("subscription.label")}
                description={t("subscription.description")}
                onPress={() => navigate("/subscription")}
                position="only"
              />
            </ListGroup>
          </View>

          <GradientSurface
            variant="surface"
            bordered
            style={styles.explanation}
          >
            <Text style={[Typography.titleSm, { color: textColor }]}>
              {t("difference.title")}
            </Text>
            <Text style={[Typography.body, { color: textSecondary }]}>
              {t("difference.body")}
            </Text>
          </GradientSurface>

          <View style={styles.section}>
            <SectionHeader title={t("sections.deletion")} />
            <ListGroup>
              <ListRow
                icon="person.crop.circle.badge.xmark"
                label={t("deletion.label")}
                description={t("deletion.description")}
                onPress={() => navigate("/delete-account")}
                accessibilityLabel={t("deletion.accessibilityLabel")}
                position="only"
              />
            </ListGroup>
          </View>
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
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing["3xl"],
    gap: Spacing.xl,
  },
  intro: {
    gap: Spacing.sm,
  },
  section: {
    gap: Spacing.md,
  },
  explanation: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
});
