import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { HealthPrimingScreen } from "@/components/health/health-priming-screen";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useHealthStatus } from "@/hooks/use-health-status";

const isAndroid = Platform.OS === "android";

export default function HealthSettingsScreen() {
  const { t } = useTranslation("healthSync");
  const {
    status,
    available,
    syncEnabled,
    loading,
    requestPermission,
    openSettings,
    skip,
    enable,
    disable,
  } = useHealthStatus();

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const background = useThemeColor({}, "background");
  const successColor = useThemeColor({}, "success");
  const errorColor = useThemeColor({}, "error");

  const [showPriming, setShowPriming] = useState(false);

  const handleConnect = useCallback(async () => {
    if (status === "granted") {
      await enable();
      return;
    }

    if (status === "unknown" || status === "not-requested") {
      setShowPriming(true);
    } else if (status === "denied" || status === "restricted") {
      await enable();
      openSettings();
    }
  }, [status, enable, openSettings]);

  const handlePrimingConnect = useCallback(async () => {
    const result = await requestPermission();
    setShowPriming(false);
    if (result === "denied") {
      // Permission was denied at the OS level — user needs to go to settings
    }
  }, [requestPermission]);

  const handlePrimingSkip = useCallback(async () => {
    await skip();
    setShowPriming(false);
  }, [skip]);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      t("settings.resetConfirmTitle"),
      t("settings.resetConfirmMessage"),
      [
        { text: t("settings.resetConfirmCancel"), style: "cancel" },
        {
          text: t("settings.resetConfirmOk"),
          style: "destructive",
          onPress: async () => {
            await disable();
          },
        },
      ]
    );
  }, [t, disable]);

  // Show full priming screen when user taps connect
  if (showPriming) {
    return (
      <HealthPrimingScreen
        onConnect={handlePrimingConnect}
        onSkip={handlePrimingSkip}
        loading={loading}
      />
    );
  }

  const statusLabel = (() => {
    switch (status) {
      case "granted":
        return syncEnabled
          ? t("settings.status.connected")
          : t("settings.status.syncOff");
      case "denied":
        return t("settings.status.notConnected");
      case "restricted":
        return t("settings.status.restricted");
      case "not-requested":
        return t("settings.status.notRequested");
      case "unavailable":
        return t("settings.status.unavailable");
      default:
        return t("settings.status.unknown");
    }
  })();

  const statusColor =
    status === "granted" && syncEnabled
      ? successColor
      : status === "denied" || status === "restricted"
        ? errorColor
        : textMuted;

  const platformLabel = isAndroid
    ? t("settings.platformLabelAndroid")
    : t("settings.platformLabel");

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title={t("settings.title")}
          titleStyle={Typography.titleMd}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Status card */}
          <View
            style={[
              styles.card,
              { backgroundColor: backgroundSubtle },
              Elevation.sm,
            ]}
          >
            <Text style={[Typography.titleSm, { color: textColor }]}>
              {platformLabel}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[styles.statusDot, { backgroundColor: statusColor }]}
              />
              <Text style={[Typography.body, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text
            style={[
              Typography.body,
              { color: textSecondary },
              styles.description,
            ]}
          >
            {isAndroid
              ? t("settings.descriptionAndroid")
              : t("settings.description")}
          </Text>

          {/* Actions */}
          {!available ? (
            <Text style={[Typography.caption, { color: textMuted }]}>
              {t("settings.status.unavailable")}
            </Text>
          ) : status === "granted" && syncEnabled ? (
            <View style={styles.actions}>
              <Button
                label={
                  isAndroid
                    ? t("settings.openSettingsButton")
                    : t("settings.recoveryButton")
                }
                variant="secondary"
                onPress={openSettings}
                accessibilityLabel={
                  isAndroid
                    ? t("settings.openSettingsButton")
                    : t("settings.recoveryButton")
                }
              />
              <Button
                label={t("settings.resetButton")}
                variant="destructive"
                onPress={handleDisconnect}
                accessibilityLabel={t("settings.resetButton")}
              />
            </View>
          ) : status === "granted" ? (
            <View style={styles.actions}>
              <Button
                label={t("settings.connectButton")}
                onPress={handleConnect}
                accessibilityLabel={t("settings.connectButton")}
              />
              <Text
                style={[Typography.caption, { color: textMuted }, styles.hint]}
              >
                {t("settings.nativeAccessRetainedHint")}
              </Text>
            </View>
          ) : status === "denied" || status === "restricted" ? (
            <View style={styles.actions}>
              <Button
                label={
                  isAndroid
                    ? t("settings.openSettingsButton")
                    : t("settings.recoveryButton")
                }
                onPress={openSettings}
                accessibilityLabel={
                  isAndroid
                    ? t("settings.openSettingsButton")
                    : t("settings.recoveryButton")
                }
              />
              <Text
                style={[Typography.caption, { color: textMuted }, styles.hint]}
              >
                {isAndroid
                  ? t("settings.recoveryHintAndroid")
                  : status === "restricted"
                    ? t("settings.restrictedHint")
                    : t("settings.recoveryHint")}
              </Text>
            </View>
          ) : (
            <Button
              label={t("settings.connectButton")}
              onPress={handleConnect}
              disabled={loading}
              accessibilityLabel={t("settings.connectButton")}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.xl,
  },
  card: {
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  description: {
    lineHeight: 20,
  },
  actions: {
    gap: Spacing.md,
  },
  hint: {
    textAlign: "center",
    marginTop: Spacing.xs,
  },
});
