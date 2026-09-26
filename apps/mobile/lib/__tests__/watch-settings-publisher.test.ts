const mockSendWatchSettings = jest.fn(
  (_envelope: unknown): Promise<void> => Promise.resolve()
);

jest.mock("@/modules/watch-bridge/src", () => ({
  isWatchPaired: () => true,
  sendWatchSettings: (envelope: unknown) => mockSendWatchSettings(envelope),
}));

import {
  publishWatchSettings,
  queueWatchSettingsPublication,
} from "@/lib/watch-settings-publisher";
import { useWatchSettingsStore } from "@/stores/watch-settings-store";

describe("watch settings publishing", () => {
  beforeEach(() => {
    mockSendWatchSettings.mockClear();
    useWatchSettingsStore.getState().reset();
  });

  it("sends a settings-only durable envelope", async () => {
    await expect(
      publishWatchSettings({
        restWarningSeconds: 5,
        showHeartRate: false,
      })
    ).resolves.toBe(true);

    expect(mockSendWatchSettings).toHaveBeenCalledTimes(1);
    const envelope = mockSendWatchSettings.mock.calls[0]?.[0] as {
      kind: string;
      settingsRevision: number;
      payload: string;
      [key: string]: unknown;
    };
    expect(envelope.kind).toBe("watchSettings");
    expect(envelope.settingsRevision).toBeGreaterThan(0);
    expect(envelope).not.toHaveProperty("workout");
    expect(JSON.parse(envelope.payload)).toMatchObject({
      restWarningSeconds: 5,
      showHeartRate: false,
    });
  });

  it("coalesces synchronous changes into one latest settings message", async () => {
    const first = queueWatchSettingsPublication({ restWarningSeconds: 5 });
    const second = queueWatchSettingsPublication({ showHeartRate: false });
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);

    expect(mockSendWatchSettings).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(
        (mockSendWatchSettings.mock.calls[0]?.[0] as { payload: string })
          .payload
      )
    ).toMatchObject({
      restWarningSeconds: 5,
      showHeartRate: false,
    });
  });

  it("merges partial calls with the current store instead of resetting siblings", async () => {
    useWatchSettingsStore.getState().setRestEndHapticsEnabled(false);

    await expect(publishWatchSettings({ showHeartRate: false })).resolves.toBe(
      true
    );

    expect(
      JSON.parse(
        (
          mockSendWatchSettings.mock.calls[0]?.[0] as {
            payload: string;
          }
        ).payload
      )
    ).toMatchObject({
      restEndHapticsEnabled: false,
      showHeartRate: false,
    });
  });
});
