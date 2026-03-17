import { Link } from "expo-router";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function ModalScreen() {
  const { t } = useTranslation("modal");

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="titleLg">{t("title")}</ThemedText>
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="body" color="primary">
          {t("action.goToHome", { ns: "common" })}
        </ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
