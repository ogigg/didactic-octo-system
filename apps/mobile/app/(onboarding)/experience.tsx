import { useOnboardingStore } from "@/stores/onboarding-store";
import type { Experience } from "@/stores/onboarding-store";
import { trackEvent } from "@/lib/track-event";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ExperienceOption = {
  label: string;
  description: string;
  value: Experience;
  icon: keyof typeof Ionicons.glyphMap;
};

const OPTIONS: ExperienceOption[] = [
  {
    label: "Just Starting",
    description: "Never trained or less than a month",
    value: "beginner",
    icon: "leaf-outline",
  },
  {
    label: "A Few Months",
    description: "Been training 1–6 months",
    value: "intermediate",
    icon: "trending-up-outline",
  },
  {
    label: "Over a Year",
    description: "Consistent training 1+ years",
    value: "advanced",
    icon: "trophy-outline",
  },
];

export default function ExperienceScreen() {
  const { experience, setExperience } = useOnboardingStore();
  const { editMode } = useLocalSearchParams<{ editMode?: string }>();

  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");

  const canContinue = experience !== null;

  function handleContinue() {
    if (!canContinue) return;
    trackEvent("onboarding_step_completed", {
      step: "experience",
      skipped: false,
    });
    if (editMode === "1") {
      router.back();
    } else {
      router.push("/(onboarding)/strength");
    }
  }

  return (
    <View style={styles.root}>
      <AmbientGlow variant="hero" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.progressRow}>
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: border }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={[Typography.label, { color: textMuted }, styles.stepLabel]}
          >
            STEP 5 OF 6
          </Text>
          <Text
            style={[Typography.titleLg, { color: textColor }, styles.title]}
          >
            How long have you been training?
          </Text>
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            We'll adjust difficulty and volume to match.
          </Text>

          {OPTIONS.map((opt) => {
            const selected = experience === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setExperience(opt.value)}
                style={[
                  styles.card,
                  {
                    backgroundColor: selected
                      ? primarySurface
                      : backgroundSubtle,
                    borderColor: selected ? primary : border,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${opt.label} — ${opt.description}`}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: selected ? primary : backgroundSubtle,
                      borderColor: selected ? primary : border,
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={22}
                    color={selected ? "#FFFFFF" : textSecondary}
                  />
                </View>

                <View style={styles.cardText}>
                  <Text
                    style={[
                      Typography.titleSm,
                      {
                        color: selected ? textColor : textSecondary,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={[Typography.caption, { color: textMuted }]}>
                    {opt.description}
                  </Text>
                </View>

                <View style={styles.radioOuter}>
                  {selected && (
                    <View
                      style={[styles.radioInner, { backgroundColor: primary }]}
                    />
                  )}
                  <View
                    style={[
                      styles.radioCircle,
                      { borderColor: selected ? primary : border },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <Button
            label="Continue"
            onPress={handleContinue}
            disabled={!canContinue}
            accessibilityLabel="Continue to strength baseline"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  progressRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  segment: { flex: 1, height: 3, borderRadius: Radii.full },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  stepLabel: { marginBottom: Spacing.sm },
  title: { marginBottom: Spacing.sm },
  subtitle: { marginBottom: Spacing["3xl"] },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  cardText: { flex: 1 },
  radioOuter: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircle: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: Radii.full,
    borderWidth: 2,
  },
  radioInner: { width: 10, height: 10, borderRadius: Radii.full, zIndex: 1 },
  actions: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
});
