import { Image } from "expo-image";
import { Platform, StyleSheet } from "react-native";
import { useTranslation, Trans } from "react-i18next";

import { HelloWave } from "@/components/hello-wave";
import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Link } from "expo-router";

export default function HomeScreen() {
  const { t } = useTranslation("home");

  const shortcut = Platform.select({
    ios: "cmd + d",
    android: "cmd + m",
    web: "F12",
  });

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
      headerImage={
        <Image
          source={require("@/assets/images/partial-react-logo.png")}
          style={styles.reactLogo}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="titleLg">{t("welcome")}</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="titleMd">{t("step1.title")}</ThemedText>
        <Trans
          i18nKey="step1.description"
          ns="home"
          values={{ shortcut }}
          components={{ bold: <ThemedText type="bodyMedium" /> }}
        />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="titleMd">{t("step2.title")}</ThemedText>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction
              title={t("action.action", { ns: "common" })}
              icon="cube"
              onPress={() => alert(t("alert.actionPressed", { ns: "common" }))}
            />
            <Link.MenuAction
              title={t("action.share", { ns: "common" })}
              icon="square.and.arrow.up"
              onPress={() => alert(t("alert.sharePressed", { ns: "common" }))}
            />
            <Link.Menu title={t("menu.more")} icon="ellipsis">
              <Link.MenuAction
                title={t("action.delete", { ns: "common" })}
                icon="trash"
                destructive
                onPress={() =>
                  alert(t("alert.deletePressed", { ns: "common" }))
                }
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <ThemedText>{t("step2.description")}</ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="titleMd">{t("step3.title")}</ThemedText>
        <Trans
          i18nKey="step3.description"
          ns="home"
          components={{ bold: <ThemedText type="bodyMedium" /> }}
        />
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
