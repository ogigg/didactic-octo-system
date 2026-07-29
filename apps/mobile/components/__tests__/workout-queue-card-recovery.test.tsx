jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("@/hooks/use-exercises-query", () => ({
  useLocalizedExerciseMap: jest.fn(() => ({
    exerciseMap: new Map(),
  })),
}));

import { render, screen } from "@testing-library/react-native";

import { WorkoutQueueCard } from "@/components/workout-queue-card";
import type { PendingWorkout } from "@/lib/api/pending-workouts";
import { getPendingWorkoutRecoveryAction } from "@/lib/pending-workout-recovery";

const CORRUPT_READY_WORKOUT: PendingWorkout = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "22222222-2222-2222-2222-222222222222",
  queue_position: 1,
  status: "ready",
  workout_data: null,
  workout_data_corrupt: true,
  generation_source: "llm",
  focus_area: "full_body",
  generated_at: null,
  last_regenerated_at: null,
  regeneration_count: 0,
  regeneration_feedback: [],
  user_edits: { exercises: [{ stale: true }] },
  generation_version: 2,
  created_at: "2026-07-29T10:00:00.000Z",
  updated_at: "2026-07-29T10:00:00.000Z",
};

describe("WorkoutQueueCard activation recovery", () => {
  it("renders a recovery action instead of a healthy ready card for corrupt data", () => {
    const recoveryAction = getPendingWorkoutRecoveryAction(
      CORRUPT_READY_WORKOUT,
      0
    );

    render(
      <WorkoutQueueCard
        workout={CORRUPT_READY_WORKOUT}
        isNextUp={false}
        recoveryAction={recoveryAction}
        onRetry={jest.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "queueCard.tryAgain" })
    ).toBeTruthy();
    expect(screen.queryByText("queueCard.startWorkout")).toBeNull();
  });
});
