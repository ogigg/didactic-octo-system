jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/components/workout-queue-card", () => ({
  WorkoutQueueCard: () => null,
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-profile-query", () => ({
  useProfile: () => ({ data: undefined }),
}));

jest.mock("@/hooks/use-workout-queue", () => ({
  useRebuildQueue: () => ({ isPending: false, mutate: jest.fn() }),
  useRegenerateWorkout: () => ({ mutate: jest.fn() }),
  useStartPendingWorkout: () => ({ mutate: jest.fn() }),
}));

jest.mock("@/stores/workout-store", () => ({
  useWorkoutStore: (selector: (state: object) => unknown) =>
    selector({ isActive: false, startedAtMs: null }),
}));

import { render, screen } from "@testing-library/react-native";
import { WorkoutQueue } from "./workout-queue";

describe("WorkoutQueue", () => {
  it("shows a busy loading indicator while the queue is loading", () => {
    render(<WorkoutQueue queue={[]} isLoading />);

    const indicator = screen.getByRole("progressbar", {
      name: "workoutQueue.loading",
    });

    expect(indicator.props.accessibilityState).toEqual({ busy: true });
    expect(screen.getByText("workoutQueue.title")).toBeTruthy();
    expect(screen.getByText("workoutQueue.loading")).toBeTruthy();
    expect(screen.queryByText("workoutQueue.empty")).toBeNull();
  });
});
