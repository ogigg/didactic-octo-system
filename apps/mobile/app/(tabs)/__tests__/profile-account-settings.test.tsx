const mockNavigate = jest.fn();
const mockWorkoutStats: {
  totalWorkouts: number | null;
  isTotalLoading: boolean;
  isStreakLoading: boolean;
} = {
  totalWorkouts: 0,
  isTotalLoading: false,
  isStreakLoading: false,
};
const mockI18n = {
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: mockI18n,
  }),
}));

jest.mock("@/i18n", () => ({
  changeAppLanguage: jest.fn(() => Promise.resolve()),
  getCurrentLanguage: jest.fn(() => "en"),
  languageLabels: { en: "English", pl: "Polski" },
  supportedLanguages: ["en", "pl"],
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-tab-bar-clearance", () => ({
  useTabBarClearance: () => 104,
}));

jest.mock("@/hooks/use-workout-stats", () => ({
  useWorkoutStats: () => ({
    ...mockWorkoutStats,
    refetch: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock("@/hooks/use-weekly-durations", () => ({
  useWeeklyDurations: () => ({
    weeklyDurations: Array.from({ length: 12 }, (_, index) => ({
      week: `W${index + 1}`,
      minutes: 0,
    })),
    isLoading: false,
    refetch: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock("@/stores/auth-store", () => ({
  useAuthStore: (
    selector: (state: { signOut: () => Promise<void> }) => unknown
  ) => selector({ signOut: jest.fn(() => Promise.resolve()) }),
}));

jest.mock("@/components/ambient-glow", () => ({
  AmbientGlow: () => null,
}));

jest.mock("@/components/ui/gradient-surface", () => {
  const { View } = jest.requireActual("react-native");

  return {
    GradientSurface: ({ children }: { children?: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";

import { changeAppLanguage } from "@/i18n";
import { useThemePreferenceStore } from "@/stores/theme-preference-store";

import ProfileScreen from "../profile";

describe("Profile account management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("removes direct deletion and routes through Account & Data", () => {
    render(<ProfileScreen />);

    expect(
      screen.queryByRole("button", { name: "nav.deleteAccount" })
    ).toBeNull();
    expect(screen.getByRole("button", { name: "logout.button" })).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "nav.accountData" }));

    expect(mockNavigate).toHaveBeenCalledWith("/account-settings");
    expect(mockNavigate).not.toHaveBeenCalledWith("/delete-account");
  });
});

describe("Profile workout count", () => {
  beforeEach(() => {
    mockWorkoutStats.totalWorkouts = 0;
    mockWorkoutStats.isTotalLoading = false;
    mockWorkoutStats.isStreakLoading = false;
  });

  it("shows a placeholder while the count is loading", () => {
    mockWorkoutStats.totalWorkouts = null;
    mockWorkoutStats.isTotalLoading = true;

    render(<ProfileScreen />);

    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText("stats.loadFailed")).toBeNull();
  });

  it("shows the loaded count while the streak is still loading", () => {
    mockWorkoutStats.totalWorkouts = 7;
    mockWorkoutStats.isStreakLoading = true;

    render(<ProfileScreen />);

    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("shows zero only when the loaded count is zero", () => {
    render(<ProfileScreen />);

    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.queryByText("stats.loadFailed")).toBeNull();
  });

  it("shows an error instead of zero when the count failed to load", () => {
    mockWorkoutStats.totalWorkouts = null;

    render(<ProfileScreen />);

    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByText("stats.loadFailed")).toBeTruthy();
  });
});

describe("Profile appearance preference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useThemePreferenceStore.setState({ preference: "system" });
  });

  it("starts on Auto and switches the app to the chosen scheme", () => {
    render(<ProfileScreen />);

    const auto = screen.getByRole("button", {
      name: "theme.accessibility.system",
    });
    expect(auto.props.accessibilityState).toMatchObject({ selected: true });

    fireEvent.press(
      screen.getByRole("button", { name: "theme.accessibility.dark" })
    );

    expect(useThemePreferenceStore.getState().preference).toBe("dark");
    expect(
      screen.getByRole("button", { name: "theme.accessibility.dark" }).props
        .accessibilityState
    ).toMatchObject({ selected: true });
    expect(
      screen.getByRole("button", { name: "theme.accessibility.system" }).props
        .accessibilityState
    ).toMatchObject({ selected: false });
  });

  it("keeps the language toggle working alongside it", () => {
    render(<ProfileScreen />);

    // The mocked `t` returns the key, so both language options share a label.
    fireEvent.press(
      screen.getAllByRole("button", { name: "language.accessibility" })[1]
    );

    expect(changeAppLanguage).toHaveBeenCalledWith("pl");
    expect(useThemePreferenceStore.getState().preference).toBe("system");
  });
});
