import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

export function ProBadge() {
  const { t } = useTranslation("subscription");
  const primarySurface = useThemeColor({}, "primarySurface");
  const primary = useThemeColor({}, "primary");

  return (
    <View
      style={[styles.badge, { backgroundColor: primarySurface }]}
      accessibilityLabel={t("badge.pro")}
      accessibilityRole="text"
    >
      <Text style={[styles.label, { color: primary }]}>{t("badge.pro")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.full,
    alignSelf: "flex-start",
  },
  label: {
    ...Typography.label,
  },
});
