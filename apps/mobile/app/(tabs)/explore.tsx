import { Image } from "expo-image";
import { Platform, StyleSheet } from "react-native";
import { useTranslation, Trans } from "react-i18next";

import { Collapsible } from "@/components/ui/collapsible";
import { ExternalLink } from "@/components/external-link";
import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Fonts } from "@/constants/theme";

export default function TabTwoScreen() {
  const { t } = useTranslation("explore");

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText
          type="titleLg"
          style={{
            fontFamily: Fonts.rounded,
          }}
        >
          {t("title")}
        </ThemedText>
      </ThemedView>
      <ThemedText>{t("intro")}</ThemedText>
      <Collapsible title={t("fileRouting.title")}>
        <Trans
          i18nKey="fileRouting.screens"
          ns="explore"
          components={{ bold: <ThemedText type="bodyMedium" /> }}
        />
        <Trans
          i18nKey="fileRouting.layout"
          ns="explore"
          components={{ bold: <ThemedText type="bodyMedium" /> }}
        />
        <ExternalLink href="https://docs.expo.dev/router/introduction">
          <ThemedText type="body" color="primary">
            {t("action.learnMore", { ns: "common" })}
          </ThemedText>
        </ExternalLink>
      </Collapsible>
      <Collapsible title={t("platformSupport.title")}>
        <Trans
          i18nKey="platformSupport.description"
          ns="explore"
          components={{ bold: <ThemedText type="bodyMedium" /> }}
        />
      </Collapsible>
      <Collapsible title={t("images.title")}>
        <Trans
          i18nKey="images.description"
          ns="explore"
          components={{ bold: <ThemedText type="bodyMedium" /> }}
        />
        <Image
          source={require("@/assets/images/react-logo.png")}
          style={{ width: 100, height: 100, alignSelf: "center" }}
        />
        <ExternalLink href="https://reactnative.dev/docs/images">
          <ThemedText type="body" color="primary">
            {t("action.learnMore", { ns: "common" })}
          </ThemedText>
        </ExternalLink>
      </Collapsible>
      <Collapsible title={t("theming.title")}>
        <Trans
          i18nKey="theming.description"
          ns="explore"
          components={{ bold: <ThemedText type="bodyMedium" /> }}
        />
        <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
          <ThemedText type="body" color="primary">
            {t("action.learnMore", { ns: "common" })}
          </ThemedText>
        </ExternalLink>
      </Collapsible>
      <Collapsible title={t("animations.title")}>
        <Trans
          i18nKey="animations.description"
          ns="explore"
          components={{
            bold: <ThemedText type="bodyMedium" />,
            mono: (
              <ThemedText type="bodyMedium" style={{ fontFamily: Fonts.mono }} />
            ),
          }}
        />
        {Platform.select({
          ios: (
            <Trans
              i18nKey="animations.parallax"
              ns="explore"
              components={{ bold: <ThemedText type="bodyMedium" /> }}
            />
          ),
        })}
      </Collapsible>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: "#808080",
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
  },
});
