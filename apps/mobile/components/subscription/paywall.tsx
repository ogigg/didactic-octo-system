import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { usePaywallStore } from "@/stores/paywall-store";

interface BenefitRowProps {
  iconName: "bolt.fill" | "chart.xyaxis.line" | "timer" | "scope";
  label: string;
}

function BenefitRow({ iconName, label }: BenefitRowProps) {
  const primarySurface = useThemeColor({}, "primarySurface");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");

  return (
    <View style={styles.benefitRow} accessible accessibilityLabel={label}>
      <View style={[styles.iconContainer, { backgroundColor: primarySurface }]}>
        <IconSymbol name={iconName} size={18} color={primary} />
      </View>
      <Text style={[Typography.bodyMedium, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function Paywall() {
  const { t } = useTranslation("subscription");
  const { isOpen, usedCount, limitCount, close } = usePaywallStore();

  const background = useThemeColor({}, "backgroundElevated");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textColor = useThemeColor({}, "text");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");

  function handleUpgrade() {
    close();
    Alert.alert(t("paywall.upgradeCta"), t("paywall.comingSoon"));
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={close}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable
          style={[styles.sheet, { backgroundColor: background }, Elevation.md]}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: textMuted }]} />

          {/* Title */}
          <Text
            style={[Typography.titleLg, { color: textColor }, styles.title]}
            accessibilityRole="header"
          >
            {t("paywall.title")}
          </Text>

          {/* Subtitle */}
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            {t("paywall.subtitle", { used: usedCount, limit: limitCount })}
          </Text>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: border }]} />

          {/* Benefits */}
          <View style={styles.benefits}>
            <BenefitRow
              iconName="bolt.fill"
              label={t("paywall.benefits.unlimited")}
            />
            <BenefitRow
              iconName="chart.xyaxis.line"
              label={t("paywall.benefits.insights")}
            />
            <BenefitRow
              iconName="timer"
              label={t("paywall.benefits.priority")}
            />
            <BenefitRow iconName="scope" label={t("paywall.benefits.focus")} />
          </View>

          {/* Upgrade CTA */}
          <Button
            label={t("paywall.upgradeCta")}
            onPress={handleUpgrade}
            accessibilityLabel={t("paywall.upgradeCta")}
            style={styles.upgradeButton}
          />

          {/* Dismiss */}
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t("paywall.dismiss")}
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            style={({ pressed }) => [
              styles.dismissButton,
              pressed && styles.dismissPressed,
            ]}
          >
            <Text style={[Typography.bodyMedium, { color: primary }]}>
              {t("paywall.dismiss")}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radii.full,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.xl,
  },
  benefits: {
    gap: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeButton: {
    marginBottom: Spacing.md,
  },
  dismissButton: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  dismissPressed: {
    opacity: 0.6,
  },
});
