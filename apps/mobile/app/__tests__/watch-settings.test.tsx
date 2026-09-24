jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn((_props: unknown, name: string) => {
    const colors: Record<string, string> = {
      background: "#ffffff",
      backgroundSubtle: "#f8f8f8",
      backgroundElevated: "#ffffff",
      text: "#111111",
      textSecondary: "#666666",
      textMuted: "#999999",
      border: "#dddddd",
      primary: "#2277aa",
      primaryContainer: "#eaf4fb",
      success: "#20aa55",
    };
    return colors[name] ?? "#000000";
  }),
}));

jest.mock("@/components/ambient-glow", () => ({
  AmbientGlow: () => null,
}));

jest.mock("@/components/ui/screen-header", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    ScreenHeader: ({ title }: { title?: string }) =>
      React.createElement(Text, null, title),
  };
});

jest.mock("@/components/ui/list-row", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return {
    ListGroup: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    ListRow: ({
      label,
      description,
      trailing,
    }: {
      label: string;
      description?: string;
      trailing?: React.ReactNode;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, label),
        description ? React.createElement(Text, null, description) : null,
        trailing
      ),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => React.createElement(View, { style }, children),
  };
});

const mockRefreshWatchStatus = jest.fn();
jest.mock("@/modules/watch-bridge/src", () => ({
  refreshWatchStatus: (...args: unknown[]) => mockRefreshWatchStatus(...args),
  isWatchPaired: jest.fn(() => false),
  isWatchAppInstalled: jest.fn(() => false),
  isWatchReachable: jest.fn(() => false),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
    useRouter: jest.fn(() => ({ back: jest.fn() })),
  };
});

import "@/i18n";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Platform } from "react-native";

import WatchSettingsScreen from "../watch-settings";
import { useWatchSettingsStore } from "@/stores/watch-settings-store";

function renderScreen() {
  return render(<WatchSettingsScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  useWatchSettingsStore.getState().reset();
  mockRefreshWatchStatus.mockResolvedValue({
    paired: true,
    installed: true,
    reachable: true,
  });
});

describe("WatchSettingsScreen", () => {
  it("renders the connected status and all three setting groups", async () => {
    renderScreen();

    await waitFor(() =>
      expect(screen.getByText("Connected and ready.")).toBeTruthy()
    );
    expect(screen.getByText("Rest timer")).toBeTruthy();
    expect(screen.getByText("Workout interaction")).toBeTruthy();
    expect(screen.getByText("Display")).toBeTruthy();
  });

  it.each([
    [
      "not paired",
      { paired: false, installed: false, reachable: false },
      "No Apple Watch paired. Your preferences will be saved for later.",
    ],
    [
      "not installed",
      { paired: true, installed: false, reachable: false },
      "Companion not installed. Install Sweaty from the Watch app on iPhone.",
    ],
    [
      "unreachable",
      { paired: true, installed: true, reachable: false },
      "Installed. Changes will sync when your Watch reconnects.",
    ],
  ])("renders the %s status copy", async (_name, status, copy) => {
    mockRefreshWatchStatus.mockResolvedValue(status);
    renderScreen();
    await waitFor(() => expect(screen.getByText(copy)).toBeTruthy());
  });

  it("explains non-iOS support and disables companion controls", async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    try {
      renderScreen();
      await waitFor(() =>
        expect(
          screen.getByText("Apple Watch is available with the iPhone app.")
        ).toBeTruthy()
      );
      expect(
        screen.getByLabelText("Vibrate when rest ends").props.accessibilityState
          .disabled
      ).toBe(true);
      expect(mockRefreshWatchStatus).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it("exposes default switch state and updates each switch independently", async () => {
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText("Connected and ready.")).toBeTruthy()
    );

    const endHaptics = screen.getByRole("switch", {
      name: "Vibrate when rest ends",
    });
    expect(endHaptics.props.accessibilityState.checked).toBe(true);
    await act(async () => fireEvent(endHaptics, "valueChange", false));
    expect(useWatchSettingsStore.getState().restEndHapticsEnabled).toBe(false);
    expect(
      useWatchSettingsStore.getState().setCompletionHapticsEnabled
    ).toBeDefined();
    expect(
      screen.getByRole("switch", { name: "Show live heart rate" }).props
        .accessibilityState.checked
    ).toBe(true);
  });

  it("exposes one selected option for each choice and accepts only listed values", async () => {
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText("Connected and ready.")).toBeTruthy()
    );

    const warningOptions = screen
      .getAllByRole("radio")
      .filter((option) =>
        String(option.props.accessibilityLabel).startsWith(
          "Rest ending warning"
        )
      );
    expect(warningOptions).toHaveLength(5);
    expect(
      warningOptions.filter(
        (option) => option.props.accessibilityState.checked === true
      )
    ).toHaveLength(1);
    expect(
      warningOptions.find((option) =>
        String(option.props.accessibilityLabel).includes("10 sec")
      )?.props.accessibilityState.checked
    ).toBe(true);

    await act(async () => fireEvent.press(warningOptions[0]));
    expect(useWatchSettingsStore.getState().restWarningSeconds).toBe(0);
    expect(useWatchSettingsStore.getState().restAdjustmentSeconds).toBe(15);
  });
});
