import { useRouter } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { syncQueue, type SyncQueue } from "@/lib/sync-queue";

const RECOVERY_MESSAGE_MS = 3_000;

interface SyncHealthBannerProps {
  queue?: Pick<
    SyncQueue,
    "subscribe" | "getHealthSnapshot" | "acknowledgeRecovery" | "retryDeadItems"
  >;
}

export function SyncHealthBanner({ queue = syncQueue }: SyncHealthBannerProps) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const snapshot = useSyncExternalStore(
    queue.subscribe,
    queue.getHealthSnapshot,
    queue.getHealthSnapshot
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const background = useThemeColor({}, "backgroundElevated");
  const border = useThemeColor({}, "border");
  const text = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");
  const warning = useThemeColor({}, "warning");
  const error = useThemeColor({}, "error");
  const success = useThemeColor({}, "success");

  useEffect(() => {
    if (snapshot.state !== "recovered") return;
    const timer = setTimeout(
      () => queue.acknowledgeRecovery(),
      RECOVERY_MESSAGE_MS
    );
    return () => clearTimeout(timer);
  }, [queue, snapshot.state]);

  if (snapshot.state === "saved") return null;

  const isFailed = snapshot.state === "failed";
  const message =
    snapshot.state === "syncing"
      ? t("sync.syncing")
      : snapshot.state === "offline"
        ? t("sync.offline")
        : snapshot.state === "recovered"
          ? t("sync.recovered")
          : snapshot.canContactSupport
            ? t("sync.failedAgain")
            : t("sync.failed");
  const tone =
    snapshot.state === "failed"
      ? error
      : snapshot.state === "recovered"
        ? success
        : warning;

  async function handleRetry() {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await queue.retryDeadItems();
    } finally {
      setIsRetrying(false);
    }
  }

  function handleSupport() {
    router.push({
      pathname: "/feedback",
      params: {
        diagnosticReference: snapshot.diagnosticReference ?? "unknown",
      },
    });
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + Spacing.sm }]}
    >
      <View
        accessibilityLiveRegion={isFailed ? "assertive" : "polite"}
        accessibilityRole="alert"
        style={[
          styles.banner,
          {
            backgroundColor: background,
            borderColor: isFailed ? `${error}66` : border,
          },
        ]}
      >
        <View style={[styles.statusDot, { backgroundColor: tone }]} />
        <View style={styles.content}>
          <Text style={[Typography.bodyMedium, { color: text }]}>
            {message}
          </Text>
          {isFailed &&
            snapshot.canContactSupport &&
            snapshot.diagnosticReference && (
              <Text style={[Typography.caption, { color: textSecondary }]}>
                {t("sync.reference", {
                  reference: snapshot.diagnosticReference,
                })}
              </Text>
            )}
        </View>
        {isFailed && (
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel={
                isRetrying ? t("sync.retrying") : t("sync.retry")
              }
              accessibilityRole="button"
              accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
              disabled={isRetrying}
              onPress={() => void handleRetry()}
              style={styles.action}
            >
              {isRetrying ? (
                <ActivityIndicator color={primary} size="small" />
              ) : (
                <Text style={[Typography.bodyMedium, { color: primary }]}>
                  {t("sync.retry")}
                </Text>
              )}
            </Pressable>
            {snapshot.canContactSupport && (
              <Pressable
                accessibilityRole="button"
                onPress={handleSupport}
                style={styles.action}
              >
                <Text style={[Typography.bodyMedium, { color: primary }]}>
                  {t("sync.support")}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    left: Spacing.md,
    position: "absolute",
    right: Spacing.md,
    zIndex: 900,
  },
  banner: {
    ...Elevation.md,
    alignItems: "center",
    alignSelf: "center",
    borderRadius: Radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.sm,
    maxWidth: 520,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    width: "100%",
  },
  statusDot: {
    borderRadius: Radii.full,
    height: 8,
    width: 8,
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  actions: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  action: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: Spacing.xs,
  },
});
