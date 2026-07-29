import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { GradientSurface } from "@/components/ui/gradient-surface";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  scheduleAccountDeletion,
  type ScheduleDeletionResult,
} from "@/lib/api/delete-account";
import { useAuthStore } from "@/stores/auth-store";

const CONFIRMATION_PHRASE = "DELETE";

function formatScheduledDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

interface ConsequenceRow {
  icon: "trash" | "clock.arrow.circlepath" | "ruler.fill" | "flame.fill";
  key:
    | "consequences.items.account"
    | "consequences.items.history"
    | "consequences.items.measurements"
    | "consequences.items.preferences";
}

const CONSEQUENCES: ConsequenceRow[] = [
  { icon: "trash", key: "consequences.items.account" },
  { icon: "clock.arrow.circlepath", key: "consequences.items.history" },
  { icon: "ruler.fill", key: "consequences.items.measurements" },
  { icon: "flame.fill", key: "consequences.items.preferences" },
];

export default function DeleteAccountScreen() {
  const { t } = useTranslation("deleteAccount");
  const router = useRouter();
  const navigation = useNavigation();
  const signOut = useAuthStore((s) => s.signOut);

  const background = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const errorColor = useThemeColor({}, "error");
  const inputFill = useThemeColor({}, "inputFill");
  const inputFillFocused = useThemeColor({}, "inputFillFocused");
  const border = useThemeColor({}, "border");

  const [confirmation, setConfirmation] = useState("");
  const [focused, setFocused] = useState(false);

  const canDelete = useMemo(
    () => confirmation.trim().toUpperCase() === CONFIRMATION_PHRASE,
    [confirmation]
  );

  const deleteMutation = useMutation<ScheduleDeletionResult>({
    mutationFn: scheduleAccountDeletion,
    onSuccess: async (result) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {}
      );
      Alert.alert(
        t("scheduled.title"),
        t("scheduled.message", {
          days: result.grace_days,
          date: formatScheduledDate(result.scheduled_at),
        }),
        [
          {
            text: t("scheduled.button"),
            onPress: async () => {
              // Drops the session locally so the RootLayout bounces to (auth).
              await signOut();
            },
          },
        ],
        { cancelable: false }
      );
    },
    onError: (error: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {}
      );
      Alert.alert(t("error.title"), error.message || t("error.message"));
    },
  });

  const isPending = deleteMutation.isPending;

  // #12 — Freeze the swipe-to-go-back and hardware back while the deletion
  // request is in flight. If we let the user navigate away mid-call we could
  // end up in a half-signed-out state.
  useLayoutEffect(() => {
    navigation.setOptions({
      gestureEnabled: !isPending,
    });
  }, [navigation, isPending]);

  useEffect(() => {
    if (!isPending) return;
    const sub = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();
    });
    return sub;
  }, [navigation, isPending]);

  function handleDelete() {
    if (!canDelete || isPending) return;

    // #11 — warning haptic on tap so the destructive intent is tactile.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );

    Alert.alert(t("finalConfirm.title"), t("finalConfirm.message"), [
      { text: t("finalConfirm.cancel"), style: "cancel" },
      {
        text: t("finalConfirm.confirm"),
        style: "destructive",
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  }

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title={t("header.title")}
          titleStyle={Typography.titleMd}
          onBack={isPending ? () => {} : undefined}
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* Warning hero — translucent red wash, not a sharp card. */}
            <GradientSurface
              variant="surface"
              radius="lg"
              style={{ ...styles.warningCard, borderColor: errorColor + "33" }}
            >
              <View
                style={[
                  styles.warningIconCircle,
                  { backgroundColor: errorColor + "1A" },
                ]}
              >
                <IconSymbol
                  name="exclamationmark.triangle.fill"
                  size={22}
                  color={errorColor}
                />
              </View>
              <Text style={[Typography.titleMd, { color: textColor }]}>
                {t("warning.title")}
              </Text>
              <Text
                style={[
                  Typography.body,
                  { color: textSecondary },
                  styles.warningBody,
                ]}
              >
                {t("warning.body")}
              </Text>
            </GradientSurface>

            {/* Consequences list. */}
            <View style={styles.section}>
              <Text
                style={[
                  Typography.label,
                  styles.sectionLabel,
                  { color: textMuted },
                ]}
              >
                {t("consequences.heading")}
              </Text>
              <View
                style={[
                  styles.consequencesGroup,
                  { borderColor: border, backgroundColor: background },
                ]}
              >
                {CONSEQUENCES.map((row, idx) => (
                  <View
                    key={row.key}
                    style={[
                      styles.consequenceRow,
                      idx < CONSEQUENCES.length - 1 && {
                        borderBottomColor: border,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <View style={styles.consequenceIcon}>
                      <IconSymbol
                        name={row.icon}
                        size={16}
                        color={errorColor}
                      />
                    </View>
                    <Text
                      style={[
                        Typography.body,
                        { color: textColor },
                        styles.consequenceLabel,
                      ]}
                    >
                      {t(row.key)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text
                style={[
                  Typography.label,
                  styles.sectionLabel,
                  { color: textMuted },
                ]}
              >
                {t("retention.heading")}
              </Text>
              <Text
                style={[
                  Typography.body,
                  styles.detailBody,
                  { color: textSecondary },
                ]}
              >
                {t("retention.body")}
              </Text>
            </View>

            <View style={styles.section}>
              <Text
                style={[
                  Typography.label,
                  styles.sectionLabel,
                  { color: textMuted },
                ]}
              >
                {t("subscription.heading")}
              </Text>
              <Text
                style={[
                  Typography.body,
                  styles.detailBody,
                  { color: textSecondary },
                ]}
              >
                {t("subscription.body")}
              </Text>
            </View>

            {/* Confirmation input — friction for an irreversible action. */}
            <View style={styles.section}>
              <Text
                style={[
                  Typography.label,
                  styles.sectionLabel,
                  { color: textMuted },
                ]}
              >
                {t("confirm.heading")}
              </Text>
              <Text
                style={[
                  Typography.body,
                  { color: textSecondary },
                  styles.confirmHelp,
                ]}
              >
                {t("confirm.instruction", { phrase: CONFIRMATION_PHRASE })}
              </Text>
              <TextInput
                value={confirmation}
                onChangeText={setConfirmation}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={CONFIRMATION_PHRASE}
                placeholderTextColor={textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isPending}
                accessibilityLabel={t("confirm.ariaLabel")}
                style={[
                  styles.input,
                  {
                    backgroundColor: focused ? inputFillFocused : inputFill,
                    color: textColor,
                    borderColor: focused
                      ? canDelete
                        ? errorColor
                        : border
                      : "transparent",
                  },
                ]}
              />
            </View>

            <View style={styles.footerSpacer} />
          </ScrollView>

          <View
            style={[
              styles.ctaContainer,
              { backgroundColor: background, borderTopColor: border },
            ]}
          >
            <Button
              label={isPending ? t("cta.deleting") : t("cta.delete")}
              variant="destructive"
              onPress={handleDelete}
              disabled={!canDelete || isPending}
              accessibilityLabel={t("cta.accessibilityLabel")}
            />
            <Button
              label={t("cta.cancel")}
              variant="ghost"
              onPress={() => router.back()}
              disabled={isPending}
              style={styles.cancelButton}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  warningCard: {
    paddingVertical: Spacing["2xl"],
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  warningIconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  warningBody: {
    textAlign: "center",
  },
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    textTransform: "uppercase",
    paddingHorizontal: Spacing.xs,
  },
  consequencesGroup: {
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  consequenceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  consequenceIcon: {
    width: 24,
    alignItems: "center",
  },
  consequenceLabel: {
    flex: 1,
  },
  confirmHelp: {
    paddingHorizontal: Spacing.xs,
  },
  detailBody: {
    paddingHorizontal: Spacing.xs,
  },
  input: {
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 2,
    borderWidth: 1.5,
    textAlign: "center",
  },
  footerSpacer: {
    height: Spacing.xl,
  },
  ctaContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  cancelButton: {
    paddingVertical: Spacing.md,
  },
});
