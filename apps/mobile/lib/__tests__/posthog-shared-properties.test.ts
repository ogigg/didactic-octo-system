jest.mock("posthog-react-native", () => jest.fn());

let mockNativeBuildVersion: string | null = null;
jest.mock("expo-application", () => ({
  __esModule: true,
  get nativeBuildVersion() {
    return mockNativeBuildVersion;
  },
}));

import Constants from "expo-constants";

import { getSharedAnalyticsProperties } from "../posthog";

describe("getSharedAnalyticsProperties", () => {
  beforeEach(() => {
    // app.json's placeholder, which the release lanes never change.
    Object.assign(Constants, {
      expoConfig: { version: "1.2.0", ios: { buildNumber: "1" } },
    });
  });

  it("reports the build number stamped into the native bundle", () => {
    mockNativeBuildVersion = "42";

    expect(getSharedAnalyticsProperties()).toMatchObject({
      app_version: "1.2.0",
      build_number: "42",
    });
  });

  it("reports unknown when the native build number is unavailable", () => {
    mockNativeBuildVersion = null;

    expect(getSharedAnalyticsProperties().build_number).toBe("unknown");
  });
});
