import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import {
  Elevation,
  Opacity,
  Radii,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

interface HealthPrimingScreenProps {
  onConnect: () => void;
  onSkip: () => void;
  loading?: boolean;
}

const isAndroid = Platform.OS === "android";

/** Heart icon with a subtle pulse line through it. */
function HeartPulseIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      {/* Heart shape */}
      <Path
        d="M40 68C40 68 10 50 10 30C10 18 19 12 28 12C33 12 37 14.5 40 18.5C43 14.5 47 12 52 12C61 12 70 18 70 30C70 50 40 68 40 68Z"
        fill={color}
        opacity={0.15}
      />
      <Path
        d="M40 68C40 68 10 50 10 30C10 18 19 12 28 12C33 12 37 14.5 40 18.5C43 14.5 47 12 52 12C61 12 70 18 70 30C70 50 40 68 40 68Z"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Pulse line */}
      <Path
        d="M14 38H28L32 28L38 48L44 32L48 38H66"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface BenefitRowProps {
  icon: React.ReactNode;
  text: string;
  textColor: string;
  delay: number;
}

function BenefitRow({ icon, text, textColor, delay }: BenefitRowProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400).springify()}
      style={styles.benefitRow}
    >
      <View style={styles.benefitIcon}>{icon}</View>
      <Text style={[Typography.body, { color: textColor }, styles.benefitText]}>
        {text}
      </Text>
    </Animated.View>
  );
}

/** Small icon for benefit rows. */
function SmallIcon({
  type,
  color,
}: {
  type: "heart" | "chart" | "check";
  color: string;
}) {
  const size = 20;
  if (type === "heart") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 21C12 21 3 15 3 9C3 5.5 5.5 3 8.5 3C10 3 11.5 4 12 5.5C12.5 4 14 3 15.5 3C18.5 3 21 5.5 21 9C21 15 12 21 12 21Z"
          fill={color}
          opacity={0.9}
        />
      </Svg>
    );
  }
  if (type === "chart") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 20V13H8V20H4ZM10 20V4H14V20H10ZM16 20V9H20V20H16Z"
          fill={color}
          opacity={0.9}
        />
      </Svg>
    );
  }
  // check
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"
        fill={color}
        opacity={0.9}
      />
    </Svg>
  );
}

export function HealthPrimingScreen({
  onConnect,
  onSkip,
  loading = false,
}: HealthPrimingScreenProps) {
  const { t } = useTranslation("healthSync");

  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const background = useThemeColor({}, "background");

  const handleConnect = useCallback(() => {
    if (!loading) onConnect();
  }, [loading, onConnect]);

  const handleSkip = useCallback(() => {
    if (!loading) onSkip();
  }, [loading, onSkip]);

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="hero" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          {/* Hero illustration */}
          <Animated.View
            entering={FadeIn.delay(100).duration(600)}
            style={[
              styles.heroContainer,
              { backgroundColor: backgroundSubtle },
              Elevation.sm,
            ]}
          >
            <HeartPulseIcon color={primary} size={80} />
          </Animated.View>

          {/* Title */}
          <Animated.Text
            entering={FadeInUp.delay(250).duration(500)}
            style={[Typography.displayLg, { color: textColor }, styles.title]}
          >
            {isAndroid ? t("priming.titleAndroid") : t("priming.title")}
          </Animated.Text>

          {/* Subtitle */}
          <Animated.Text
            entering={FadeInUp.delay(350).duration(500)}
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            {isAndroid ? t("priming.subtitleAndroid") : t("priming.subtitle")}
          </Animated.Text>

          {/* Benefits */}
          <View style={styles.benefits}>
            <BenefitRow
              icon={<SmallIcon type="heart" color={primary} />}
              text={t("priming.benefits.heartRate")}
              textColor={textColor}
              delay={450}
            />
            <BenefitRow
              icon={<SmallIcon type="chart" color={primary} />}
              text={t("priming.benefits.dashboard")}
              textColor={textColor}
              delay={550}
            />
            <BenefitRow
              icon={<SmallIcon type="check" color={primary} />}
              text={t("priming.benefits.onePlace")}
              textColor={textColor}
              delay={650}
            />
          </View>

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Privacy note */}
          <Animated.Text
            entering={FadeIn.delay(700).duration(500)}
            style={[Typography.caption, { color: textMuted }, styles.privacy]}
          >
            {t("priming.privacy")}
          </Animated.Text>

          {/* Buttons */}
          <Animated.View
            entering={FadeInUp.delay(800).duration(500)}
            style={styles.buttons}
          >
            <Button
              label={loading ? t("priming.connecting") : t("priming.connect")}
              onPress={handleConnect}
              disabled={loading}
              accessibilityLabel={t("priming.connect")}
            />
            <Pressable
              onPress={handleSkip}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={t("priming.notNow")}
              style={({ pressed }) => [
                styles.ghostButton,
                pressed && { opacity: Opacity.pressed },
                loading && { opacity: Opacity.disabled },
              ]}
            >
              <Text style={[Typography.titleSm, { color: textSecondary }]}>
                {t("priming.notNow")}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["4xl"],
    paddingBottom: Spacing["2xl"],
  },
  heroContainer: {
    alignSelf: "center",
    width: 140,
    height: 140,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["3xl"],
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing["2xl"],
  },
  benefits: {
    gap: Spacing.lg,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  privacy: {
    textAlign: "center",
    lineHeight: 18,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  buttons: {
    gap: Spacing.md,
  },
  ghostButton: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderRadius: Radii.lg,
  },
});
