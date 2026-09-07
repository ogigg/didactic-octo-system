import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useAuthStore } from "@/stores/auth-store";
import { Spacing, Typography } from "@/constants/theme";

export function ProfileGate() {
  const { t } = useTranslation("auth");
  const status = useAuthStore((s) => s.profileStatus);
  const retry = useAuthStore((s) => s.retryProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const text = useThemeColor({}, "text");
  const primary = useThemeColor({}, "primary");
  const background = useThemeColor({}, "background");
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: background }]}>
      <View style={styles.content}>
        {status !== "error" && <ActivityIndicator color={primary} />}
        <Text
          accessibilityRole={status === "error" ? "alert" : undefined}
          accessibilityLiveRegion="polite"
          style={[Typography.body, { color: text }]}
        >
          {t(status === "error" ? "profile.error" : "profile.loading")}
        </Text>
        {status === "error" && (
          <>
            <Button label={t("profile.retry")} onPress={() => void retry()} />
            <Button
              label={t("profile.signOut")}
              variant="ghost"
              onPress={() => void signOut()}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center" },
  content: { padding: Spacing.xl, gap: Spacing.lg },
});
