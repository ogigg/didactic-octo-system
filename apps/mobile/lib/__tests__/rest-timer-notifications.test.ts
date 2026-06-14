const startedAtMs = new Date("2026-06-03T10:00:00.000Z").getTime();

interface NotificationsMock {
  AndroidImportance: { HIGH: number };
  SchedulableTriggerInputTypes: { TIME_INTERVAL: string };
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  scheduleNotificationAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
  setNotificationHandler: jest.Mock;
}

function makeNotificationsMock(): NotificationsMock {
  return {
    AndroidImportance: { HIGH: 6 },
    SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
    scheduleNotificationAsync: jest.fn(() =>
      Promise.resolve("rest-notification-1")
    ),
    cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
    setNotificationHandler: jest.fn(),
  };
}

async function loadSubject(notificationsMock: NotificationsMock) {
  jest.resetModules();
  jest.doMock("expo-notifications", () => notificationsMock);
  return require("../rest-timer-notifications") as typeof import("../rest-timer-notifications");
}

describe("rest timer notifications", () => {
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(startedAtMs);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    jest.dontMock("expo-notifications");
  });

  it("schedules an audible notification for the rest timer completion", async () => {
    const notificationsMock = makeNotificationsMock();
    notificationsMock.getPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    const { scheduleRestTimerCompletionNotification } =
      await loadSubject(notificationsMock);

    await expect(
      scheduleRestTimerCompletionNotification({
        channelName: "Rest timer",
        title: "Rest complete",
        body: "Time for your next set.",
        endsAtMs: startedAtMs + 90_000,
      })
    ).resolves.toBe("scheduled");

    expect(notificationsMock.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: "rest-timer-complete",
      content: {
        title: "Rest complete",
        body: "Time for your next set.",
        sound: true,
        data: {
          kind: "rest-timer-complete",
        },
      },
      trigger: {
        type: "timeInterval",
        seconds: 90,
        channelId: "rest-timer-alerts",
      },
    });
  });

  it("requests permission and reports a clear denied state without scheduling", async () => {
    const notificationsMock = makeNotificationsMock();
    notificationsMock.getPermissionsAsync.mockResolvedValue({
      status: "undetermined",
    });
    notificationsMock.requestPermissionsAsync.mockResolvedValue({
      status: "denied",
    });
    const { scheduleRestTimerCompletionNotification } =
      await loadSubject(notificationsMock);

    await expect(
      scheduleRestTimerCompletionNotification({
        channelName: "Rest timer",
        title: "Rest complete",
        body: "Time for your next set.",
        endsAtMs: startedAtMs + 90_000,
      })
    ).resolves.toBe("permission-denied");

    expect(notificationsMock.requestPermissionsAsync).toHaveBeenCalledWith({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
      android: {},
    });
    expect(notificationsMock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("cancels the previously scheduled rest timer notification", async () => {
    const notificationsMock = makeNotificationsMock();
    notificationsMock.getPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    const {
      cancelScheduledRestTimerNotification,
      scheduleRestTimerCompletionNotification,
    } = await loadSubject(notificationsMock);

    await scheduleRestTimerCompletionNotification({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "Time for your next set.",
      endsAtMs: startedAtMs + 90_000,
    });
    await cancelScheduledRestTimerNotification();

    expect(
      notificationsMock.cancelScheduledNotificationAsync
    ).toHaveBeenCalledWith("rest-timer-complete");
  });

  it("cancels the stable notification ID before scheduling after a restart", async () => {
    const notificationsMock = makeNotificationsMock();
    notificationsMock.getPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    const { scheduleRestTimerCompletionNotification } =
      await loadSubject(notificationsMock);

    await scheduleRestTimerCompletionNotification({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "Time for your next set.",
      endsAtMs: startedAtMs + 90_000,
    });

    expect(
      notificationsMock.cancelScheduledNotificationAsync
    ).toHaveBeenCalledWith("rest-timer-complete");
  });

  it("does not schedule a stale notification after cleanup wins the race", async () => {
    const notificationsMock = makeNotificationsMock();
    let resolvePermission:
      | ((permissions: { status: string }) => void)
      | undefined;
    notificationsMock.getPermissionsAsync.mockReturnValue(
      new Promise((resolve) => {
        resolvePermission = resolve;
      })
    );
    const {
      cancelScheduledRestTimerNotification,
      scheduleRestTimerCompletionNotification,
    } = await loadSubject(notificationsMock);

    const schedulePromise = scheduleRestTimerCompletionNotification({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "Time for your next set.",
      endsAtMs: startedAtMs + 90_000,
    });

    await cancelScheduledRestTimerNotification();
    resolvePermission?.({ status: "granted" });

    await expect(schedulePromise).resolves.toBe("canceled");
    expect(notificationsMock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
