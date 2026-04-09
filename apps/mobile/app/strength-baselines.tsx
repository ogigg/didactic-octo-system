import { useState, useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ScreenHeader } from "@/components/ui/screen-header";
import { Button } from "@/components/ui/button";
import { NumericKeyboardAccessory } from "@/components/numeric-keyboard-accessory";
import { StrengthBaselineForm } from "@/components/strength-baseline-form";
import { AmbientGlow } from "@/components/ambient-glow";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useProfile } from "@/hooks/use-profile-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchStrengthBaselines,
  saveStrengthBaselines,
} from "@/lib/api/strength-baselines";
import { trackEvent } from "@/lib/track-event";
import type { StrengthBaseline } from "@/stores/onboarding-store";

const BASELINE_KEYS = ["strength-baselines"] as const;

export const strengthBaselineKeys = {
  all: ["strength-baselines"] as const,
};

export default function StrengthBaselinesScreen() {
  const { t } = useTranslation("strengthBaselines");

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const background = useThemeColor({}, "background");
  const border = useThemeColor({}, "border");
  const errorColor = useThemeColor({}, "error");

  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  // Fetch current baselines
  const { data: fetchedBaselines } = useQuery({
    queryKey: strengthBaselineKeys.all,
    queryFn: fetchStrengthBaselines,
  });

  // Local state
  const [baselines, setBaselines] = useState<StrengthBaseline[]>([]);

  // Sync fetched data to local state
  useEffect(() => {
    if (fetchedBaselines) {
      setBaselines(fetchedBaselines);
    }
  }, [fetchedBaselines]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => saveStrengthBaselines(baselines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: strengthBaselineKeys.all });
      baselines.forEach((baseline) => {
        trackEvent("strength_baseline_entered", {
          exercise_key: baseline.exercise_key,
          has_load: baseline.load_kg !== null,
          source: "settings",
        });
      });
      Alert.alert("", t("success"));
    },
  });

  const equipment = (profile?.equipment_level ?? "full_gym") as
    | "bodyweight"
    | "dumbbells"
    | "full_gym";
  const experience = (profile?.difficulty_level ?? "intermediate") as
    | "beginner"
    | "intermediate"
    | "advanced";

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <ScreenHeader
          title={t("header.title")}
          titleStyle={Typography.titleMd}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Subtitle */}
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            {t("subtitle")}
          </Text>
          <Text
            style={[Typography.caption, { color: textMuted }, styles.skipHint]}
          >
            {t("skipHint")}
          </Text>

          {/* Form */}
          <StrengthBaselineForm
            equipment={equipment}
            experience={experience}
            baselines={baselines}
            onChange={setBaselines}
          />
        </ScrollView>

        {/* Error */}
        {saveMutation.error ? (
          <Text style={[styles.errorText, { color: errorColor }]}>
            {t("error")}
          </Text>
        ) : null}

        {/* Save CTA */}
        <View style={[styles.ctaContainer, { backgroundColor: background }]}>
          <Button
            label={saveMutation.isPending ? t("save.saving") : t("save.button")}
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            accessibilityLabel={t("save.button")}
          />
        </View>
      </SafeAreaView>
      <NumericKeyboardAccessory />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing["3xl"],
  },
  subtitle: {
    marginBottom: Spacing.xs,
  },
  skipHint: {
    marginBottom: Spacing.xl,
  },
  ctaContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.caption,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
});
