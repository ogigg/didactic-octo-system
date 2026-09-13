const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: mockPush }),
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-workout-queries", () => ({
  useWorkoutHistory: () => ({
    data: { pages: [] },
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  }),
  useWorkoutHistoryForDay: () => ({
    data: [],
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  }),
}));

jest.mock("@/components/ambient-glow", () => ({ AmbientGlow: () => null }));
jest.mock("@/components/history/workout-history-card", () => ({
  WorkoutHistoryCard: () => null,
}));

import { fireEvent, render, screen } from "@testing-library/react-native";

import HistoryScreen from "../history";

describe("History export action", () => {
  it("opens the workout history export screen", () => {
    render(<HistoryScreen />);

    fireEvent.press(screen.getByRole("button", { name: "header.export" }));

    expect(mockPush).toHaveBeenCalledWith("/export-history");
  });
});
