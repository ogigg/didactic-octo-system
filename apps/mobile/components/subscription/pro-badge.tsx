import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";

export function ProBadge() {
  const { t } = useTranslation("subscription");

  return (
    <Badge
      label={t("badge.pro")}
      style={styles.badge}
      accessibilityLabel={t("badge.pro")}
      accessibilityRole="text"
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
  },
});
