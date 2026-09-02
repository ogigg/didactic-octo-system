import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { GradientSurface } from "@/components/ui/gradient-surface";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSubscription } from "@/hooks/use-subscription";
import { openSubscriptionManagement } from "@/lib/subscription-management";
import { supabase } from "@/lib/supabase";

export default function AccountSettingsScreen() {
  const { t } = useTranslation("accountSettings");
  const router = useRouter();
  const { isProActive } = useSubscription();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  const background = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  const navigate = (route: Href) => router.navigate(route);

  useEffect(() => {
    let active = true;

    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active && data.user) {
          setHasPassword(
            data.user.identities?.some(
              ({ provider }) => provider === "email"
            ) ?? false
          );
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  async function handleManageSubscription() {
    try {
      await openSubscriptionManagement();
    } catch {
      Alert.alert(t("subscription.errorTitle"), t("subscription.errorMessage"));
    }
  }

  function handleDeleteAccount() {
    if (!isProActive) {
      navigate("/delete-account");
      return;
    }

    Alert.alert(
      t("deletion.subscriptionWarning.title"),
      t("deletion.subscriptionWarning.message"),
      [
        {
          text: t("deletion.subscriptionWarning.cancel"),
          style: "cancel",
        },
        {
          text: t("deletion.subscriptionWarning.manage"),
          onPress: () => void handleManageSubscription(),
        },
        {
          text: t("deletion.subscriptionWarning.continue"),
          style: "destructive",
          onPress: () => navigate("/delete-account"),
        },
      ]
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title={t("header.title")}
          titleStyle={Typography.titleMd}
          backAccessibilityLabel={t("accessibility.back")}
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
                icon="lock.fill"
                label={
                  hasPassword === null
                    ? t("password.label")
                    : hasPassword
                      ? t("password.changeLabel")
                      : t("password.setLabel")
                }
                description={t("password.description")}
                onPress={() => navigate("/change-password")}
                position="first"
              />
              <ListRow
                icon="star.fill"
                label={t("subscription.label")}
                description={t("subscription.description")}
                onPress={() => navigate("/subscription")}
                position="last"
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
                onPress={handleDeleteAccount}
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
