import { Alert, Platform } from "react-native";
import { getFixedT } from "i18next";

import {
  getCurrentHealthPermissionStatus,
  isHealthSyncAvailable,
  requestHealthPermissions,
  setCachedPermissionStatus,
  syncWorkoutToHealth,
} from "./index";
import type { HealthWorkoutPayload } from "./types";

/**
 * Ensure the user has been asked about Health sync (first time only) and,
 * if permission is granted, mirror the session to the platform Health store.
 *
 * Safe to call unconditionally from the save-success callback — this
 * function short-circuits if the platform is unavailable or the user has
 * already opted out.
 */
export async function promptAndSyncWorkout(
  sessionId: string,
  payload: HealthWorkoutPayload
): Promise<void> {
  if (!isHealthSyncAvailable()) return;

  let status = await getCurrentHealthPermissionStatus();

  if (status === "unavailable" || status === "restricted") return;

  if (status === "unknown" || status === "not-requested") {
    const allowed = await askUser();
    if (allowed) {
      status = await requestHealthPermissions();
    } else {
      await setCachedPermissionStatus("skipped");
      return;
    }
  }

  if (status !== "granted") return;

  await syncWorkoutToHealth(sessionId, payload);
}

function askUser(): Promise<boolean> {
  const t = getFixedT(null, "healthSync");
  const isAndroid = Platform.OS === "android";
  return new Promise((resolve) => {
    Alert.alert(
      isAndroid ? t("prompt.titleAndroid") : t("prompt.title"),
      isAndroid ? t("prompt.messageAndroid") : t("prompt.message"),
      [
        {
          text: t("prompt.notNow"),
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: t("prompt.allow"),
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false, onDismiss: () => resolve(false) }
    );
  });
}
