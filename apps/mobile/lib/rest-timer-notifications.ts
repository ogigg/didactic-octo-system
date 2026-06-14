import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";

const REST_TIMER_NOTIFICATION_CHANNEL_ID = "rest-timer-alerts";
const REST_TIMER_NOTIFICATION_KIND = "rest-timer-complete";

let scheduledRestTimerNotificationId: string | null = null;
let channelPromise: Promise<void> | null = null;
let isNotificationHandlerConfigured = false;

export type RestTimerNotificationScheduleStatus =
  | "scheduled"
  | "permission-denied"
  | "unavailable";

export interface RestTimerNotificationContent {
  channelName: string;
  title: string;
  body: string;
  endsAtMs: number;
}

function isRestTimerNotification(notification: Notifications.Notification) {
  return notification.request.content.data?.kind === REST_TIMER_NOTIFICATION_KIND;
}

export function configureRestTimerNotificationHandler() {
  if (isNotificationHandlerConfigured) return;
  isNotificationHandlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const shouldPresent =
        isRestTimerNotification(notification) && AppState.currentState !== "active";

      return {
        shouldShowBanner: shouldPresent,
        shouldShowList: shouldPresent,
        shouldPlaySound: shouldPresent,
        shouldSetBadge: false,
      };
    },
  });
}

function hasAudiblePermission(
  permissions: Notifications.NotificationPermissionsStatus
) {
  return permissions.status === "granted" && permissions.ios?.allowsSound !== false;
}

async function ensureAndroidChannel(channelName: string) {
  if (Platform.OS !== "android") return;

  channelPromise ??= Notifications.setNotificationChannelAsync(
    REST_TIMER_NOTIFICATION_CHANNEL_ID,
    {
      name: channelName,
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    }
  ).then(() => undefined);

  await channelPromise;
}

export async function ensureRestTimerNotificationPermission() {
  const existingPermissions = await Notifications.getPermissionsAsync();
  if (hasAudiblePermission(existingPermissions)) return true;
  if (existingPermissions.status === "denied") return false;

  const requestedPermissions = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
    android: {},
  });

  return hasAudiblePermission(requestedPermissions);
}

export async function cancelScheduledRestTimerNotification() {
  if (!scheduledRestTimerNotificationId) return;

  const notificationId = scheduledRestTimerNotificationId;
  scheduledRestTimerNotificationId = null;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn("[rest-timer] failed to cancel completion notification:", error);
  }
}

export async function scheduleRestTimerCompletionNotification({
  channelName,
  title,
  body,
  endsAtMs,
}: RestTimerNotificationContent): Promise<RestTimerNotificationScheduleStatus> {
  try {
    await cancelScheduledRestTimerNotification();
    await ensureAndroidChannel(channelName);

    const hasPermission = await ensureRestTimerNotificationPermission();
    if (!hasPermission) return "permission-denied";

    const secondsUntilCompletion = Math.max(
      1,
      Math.ceil((endsAtMs - Date.now()) / 1000)
    );

    scheduledRestTimerNotificationId =
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: {
            kind: REST_TIMER_NOTIFICATION_KIND,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntilCompletion,
          channelId: REST_TIMER_NOTIFICATION_CHANNEL_ID,
        },
      });

    return "scheduled";
  } catch (error) {
    console.warn("[rest-timer] failed to schedule completion notification:", error);
    return "unavailable";
  }
}
