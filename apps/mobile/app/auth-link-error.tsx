import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
export default function AuthLinkError() {
  const { t } = useTranslation("auth");
  const color = useThemeColor({}, "text");
  return (
    <SafeAreaView style={styles.root}>
      <Text accessibilityRole="header" style={[Typography.titleLg, { color }]}>
        {t("linkError.title")}
      </Text>
      <Text style={[Typography.body, { color }]}>{t("linkError.body")}</Text>
      <Button
        label={t("signUp.signInLink")}
        onPress={() => router.replace("/(auth)/sign-in")}
      />
      <Button
        variant="secondary"
        label={t("forgotPassword.submitButton")}
        onPress={() => router.replace("/(auth)/forgot-password")}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: Spacing.xl,
    gap: Spacing.lg,
    justifyContent: "center",
  },
});
