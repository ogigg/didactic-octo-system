import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export function SetHeader() {
  const { t } = useTranslation("workout");
  const textMuted = useThemeColor({}, "textMuted");

  return (
    <View style={styles.row}>
      <Text style={[styles.label, styles.setCol, { color: textMuted }]}>
        {t("setHeader.set")}
      </Text>
      <Text style={[styles.label, styles.prevCol, { color: textMuted }]}>
        {t("setHeader.previous")}
      </Text>
      <Text style={[styles.label, styles.inputCol, { color: textMuted }]}>
        {t("setHeader.kg")}
      </Text>
      <Text style={[styles.label, styles.inputCol, { color: textMuted }]}>
        {t("setHeader.reps")}
      </Text>
      <Text style={[styles.label, styles.rpeCol, { color: textMuted }]}>
        {t("setHeader.rpe")}
      </Text>
      <Text style={[styles.label, styles.checkCol, { color: textMuted }]}>
        {t("setHeader.done")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  label: {
    ...Typography.label,
  },
  setCol: {
    width: 32,
    textAlign: "center",
  },
  prevCol: {
    flex: 1,
    textAlign: "center",
  },
  inputCol: {
    width: 56,
    textAlign: "center",
  },
  rpeCol: {
    width: 44,
    textAlign: "center",
  },
  checkCol: {
    width: 36,
    textAlign: "center",
  },
});
