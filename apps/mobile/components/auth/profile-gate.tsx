import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useAuthStore } from "@/stores/auth-store";
import { Radii, Spacing, Typography } from "@/constants/theme";

export const FORCE_PROFILE_GATE = false;

function ProfileSkeleton({ onboarding }: { onboarding: boolean }) {
  const fill = useThemeColor({}, "inputFill");
  const surface = useThemeColor({}, "backgroundSubtle");
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!reducedMotion) {
      opacity.value = withRepeat(
        withTiming(0.65, { duration: 1400 }),
        -1,
        true
      );
    }
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID="profile-skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.skeleton, pulse]}
    >
      {onboarding ? (
        <View testID="onboarding-skeleton" style={styles.skeleton}>
          <View
            style={[styles.line, styles.short, { backgroundColor: fill }]}
          />
          {[0, 1, 2, 3].map((item) => (
            <View
              key={item}
              style={[styles.choice, { backgroundColor: surface }]}
            >
              <View
                style={[styles.line, styles.medium, { backgroundColor: fill }]}
              />
              <View style={[styles.radio, { borderColor: fill }]} />
            </View>
          ))}
          <View style={[styles.placeholderButton, { backgroundColor: fill }]} />
        </View>
      ) : (
        <View testID="home-skeleton" style={styles.skeleton}>
          <View style={styles.skeletonHeader}>
            <View style={[styles.avatar, { backgroundColor: fill }]} />
            <View style={styles.lines}>
              <View
                style={[styles.line, styles.medium, { backgroundColor: fill }]}
              />
              <View
                style={[styles.line, styles.short, { backgroundColor: fill }]}
              />
            </View>
          </View>
          <View style={[styles.preview, { backgroundColor: surface }]}>
            <View
              style={[styles.line, styles.short, { backgroundColor: fill }]}
            />
            <View style={[styles.headline, { backgroundColor: fill }]} />
            <View style={styles.metrics}>
              {[0, 1, 2].map((item) => (
                <View
                  key={item}
                  style={[styles.metric, { backgroundColor: fill }]}
                />
              ))}
            </View>
          </View>
          {[0, 1].map((item) => (
            <View key={item} style={styles.skeletonHeader}>
              <View style={[styles.thumbnail, { backgroundColor: fill }]} />
              <View style={styles.lines}>
                <View
                  style={[
                    styles.line,
                    styles.medium,
                    { backgroundColor: fill },
                  ]}
                />
                <View
                  style={[styles.line, styles.short, { backgroundColor: fill }]}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

export function ProfileGate() {
  const { t } = useTranslation("auth");
  const status = useAuthStore((s) => s.profileStatus);
  const retry = useAuthStore((s) => s.retryProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const background = useThemeColor({}, "background");
  const isError = status === "error";
  const userId = useAuthStore((s) => s.session?.user.id);
  const returning = useOnboardingStore((s) =>
    Boolean(userId && s.ownerUserId === userId && s.isCompleted)
  );
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setSlow(false);
    if (status !== "loading") return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [status, attempt]);
  function retryLoading() {
    setSlow(false);
    setAttempt((value) => value + 1);
    void retry();
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="subtle" animated={false} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text
            accessibilityRole="header"
            style={[Typography.titleLg, { color: text }]}
          >
            {t(isError ? "profile.errorTitle" : "profile.loadingTitle")}
          </Text>
          <Text
            accessibilityRole={isError ? "alert" : undefined}
            accessibilityLiveRegion="polite"
            style={[Typography.body, styles.description, { color: secondary }]}
          >
            {t(isError ? "profile.error" : "profile.loading")}
          </Text>
        </View>
        {isError ? (
          <View style={styles.actions}>
            <Button label={t("profile.retry")} onPress={retryLoading} />
            <Button
              label={t("profile.signOut")}
              variant="ghost"
              onPress={() => void signOut()}
            />
          </View>
        ) : (
          <>
            <ProfileSkeleton onboarding={!returning} />
            {slow && (
              <View style={styles.actions}>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[
                    Typography.body,
                    styles.description,
                    { color: secondary },
                  ]}
                >
                  {t("profile.slow")}
                </Text>
                <Button
                  label={t("profile.retry")}
                  variant="ghost"
                  onPress={retryLoading}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: Spacing.xl,
    paddingTop: Spacing["3xl"],
    paddingBottom: Spacing.xl,
    gap: Spacing["2xl"],
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  heading: { gap: Spacing.md, marginBottom: Spacing.sm },
  description: { lineHeight: 22 },
  actions: { gap: Spacing.md },
  skeleton: { gap: Spacing.lg },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: { width: 48, height: 48, borderRadius: Radii.full },
  thumbnail: { width: 48, height: 48, borderRadius: Radii.md },
  lines: { flex: 1, gap: Spacing.sm },
  line: { height: 10, borderRadius: Radii.sm },
  medium: { width: "65%" },
  short: { width: "40%" },
  headline: { height: 22, width: "80%", borderRadius: Radii.sm },
  preview: {
    padding: Spacing.xl,
    borderRadius: Radii.lg,
    gap: Spacing.xl,
    marginVertical: Spacing.sm,
  },
  choice: {
    minHeight: 72,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  radio: { width: 20, height: 20, borderRadius: Radii.full, borderWidth: 2 },
  placeholderButton: {
    height: 48,
    borderRadius: Radii.md,
    marginTop: Spacing.lg,
  },
  metrics: { flexDirection: "row", gap: Spacing.sm },
  metric: { flex: 1, height: 40, borderRadius: Radii.sm },
});
