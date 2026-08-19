const mockNavigate = jest.fn();
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

jest.mock("@/hooks/use-workout-stats", () => ({
  useWorkoutStats: () => ({
    totalWorkouts: 0,
    isLoading: false,
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
