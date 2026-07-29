const mockRouterPush = jest.fn();
const mockStartWorkout = jest.fn();
const mockMutation = jest.fn();

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn((callback: () => void) => callback()),
  useRouter: jest.fn(() => ({
    push: mockRouterPush,
  })),
}));

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string, options?: { name?: string }) =>
      key === "myWorkouts.reviewTemplate" ? `Review ${options?.name}` : key,
  })),
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => ({ data: [] })),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-profile-query", () => ({
  useProfile: jest.fn(() => ({
    data: { weekly_frequency: 3 },
  })),
}));

jest.mock("@/hooks/use-workout-queue", () => ({
  useWorkoutQueue: jest.fn(() => ({
    queue: [],
    refetch: jest.fn(() => Promise.resolve()),
  })),
  useStartPendingWorkout: jest.fn(() => ({
    isPending: false,
    mutate: mockMutation,
  })),
}));

jest.mock("@/hooks/use-streak-protection", () => ({
  useApplyStreakProtection: jest.fn(() => ({
    isPending: false,
    mutate: mockMutation,
  })),
  useDismissStreakPrompt: jest.fn(() => ({
    isPending: false,
    mutate: mockMutation,
  })),
  useRecordComebackEvent: jest.fn(() => ({
    isPending: false,
    mutate: mockMutation,
  })),
  useRestartStreak: jest.fn(() => ({
    isPending: false,
    mutate: mockMutation,
  })),
  useStreakStatus: jest.fn(() => ({ data: undefined })),
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useLocalizedExerciseMap: jest.fn(() => ({
    exerciseMap: new Map(),
  })),
}));

jest.mock("@/stores/workout-store", () => ({
  useWorkoutStore: jest.fn(
    (
      selector: (state: {
        isActive: boolean;
        workoutName: string;
        exercises: never[];
        startedAtMs: null;
        startWorkout: typeof mockStartWorkout;
      }) => unknown
    ) =>
      selector({
        isActive: false,
        workoutName: "",
        exercises: [],
        startedAtMs: null,
        startWorkout: mockStartWorkout,
      })
  ),
}));

jest.mock("@/stores/workout-templates-store", () => ({
  useWorkoutTemplatesStore: jest.fn(
    (
      selector: (state: {
        templates: {
          id: string;
          name: string;
          createdAt: number;
          exercises: { id: string; name: string }[];
        }[];
      }) => unknown
    ) =>
      selector({
        templates: [
          {
            id: "template-1",
            name: "Push day",
            createdAt: 1,
            exercises: [{ id: "bench-press", name: "Bench Press" }],
          },
        ],
      })
  ),
}));

jest.mock("@/components/ambient-glow", () => ({
  AmbientGlow: () => null,
}));

jest.mock("@/components/workout-queue", () => ({
  WorkoutQueue: () => null,
}));

jest.mock("@/components/subscription/usage-indicator", () => ({
  UsageIndicator: () => null,
}));

jest.mock("@/components/subscription/paywall", () => ({
  Paywall: () => null,
}));

jest.mock("@/components/streak/streak-protection-sheet", () => ({
  StreakProtectionSheet: () => null,
}));

jest.mock("@/components/workout-plan-card", () => ({
  WorkoutPlanCard: () => null,
}));

jest.mock("@/components/ui/gradient-surface", () => {
  const { View } = jest.requireActual("react-native");
  return {
    GradientSurface: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock("@/components/ui/section-header", () => ({
  SectionHeader: () => null,
}));

jest.mock("@/components/ui/tab-screen", () => {
  const { View } = jest.requireActual("react-native");
  return {
    TabScreen: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock("@/lib/track-event", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("@/lib/comeback-workout", () => ({
  markComebackWorkoutStarted: jest.fn(() => Promise.resolve()),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";

import HomeScreen from "../index";

describe("HomeScreen saved template navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens the template review without starting a workout", () => {
    render(<HomeScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Review Push day" }));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: "/workout-template",
      params: { id: "template-1" },
    });
    expect(mockStartWorkout).not.toHaveBeenCalled();
  });
});
