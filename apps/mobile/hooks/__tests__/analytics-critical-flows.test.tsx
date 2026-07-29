const mockGenerateWorkout = jest.fn();
const mockUpdateTrainingPreferences = jest.fn();
const mockFetchPreviousSetDisplays = jest.fn();
const mockDeletePendingWorkout = jest.fn();
const mockStartWorkout = jest.fn();
const mockTrackEvent = jest.fn();
const mockPush = jest.fn();
const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    push: mockPush,
  }),
}));

jest.mock("@/lib/analytics-occurrence", () => ({
  createAnalyticsOccurrenceId: () => "workout_generated:generation-action-1",
}));

jest.mock("@/lib/track-event", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("@/lib/api/generate-workout", () => ({
  generateWorkout: (...args: unknown[]) => mockGenerateWorkout(...args),
}));

jest.mock("@/lib/api/profiles", () => ({
  updateTrainingPreferences: (...args: unknown[]) =>
    mockUpdateTrainingPreferences(...args),
}));

jest.mock("@/lib/api/workouts", () => ({
  fetchPreviousSetDisplays: (...args: unknown[]) =>
    mockFetchPreviousSetDisplays(...args),
}));

jest.mock("@/lib/api/pending-workouts", () => ({
  deletePendingWorkout: (...args: unknown[]) =>
    mockDeletePendingWorkout(...args),
}));

jest.mock("@/hooks/use-profile-query", () => ({
  useProfile: () => ({ data: { weight_unit: "kg" } }),
}));

jest.mock("@/stores/workout-store", () => ({
  useWorkoutStore: (
    selector: (state: { startWorkout: typeof mockStartWorkout }) => unknown
  ) => selector({ startWorkout: mockStartWorkout }),
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useGenerateWorkout } from "@/hooks/use-generate-workout";
import { useStartPendingWorkout } from "@/hooks/use-workout-queue";
import type { GenerateWorkoutResponse } from "@/lib/api/generate-workout";
import type { PendingWorkout } from "@/lib/api/pending-workouts";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: 0, retry: false },
      queries: { retry: false },
    },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { queryClient, Wrapper };
}

const generatedWorkout: GenerateWorkoutResponse = {
  custom_goal_snapshot: null,
  exercises: [
    {
      exercise_id: "bench",
      exercise_name: "Bench Press",
      exercise_type: "weight",
      notes: null,
      previous_display: null,
      reasoning: null,
      rest_duration_seconds: 90,
      sets: [{ set_type: "working", target_load_kg: 50, target_reps: 8 }],
    },
  ],
  generation_source: "llm",
  goal_snapshot: "build_strength",
  reasoning: null,
  warmup: null,
  workout_name: "Push",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateTrainingPreferences.mockResolvedValue(undefined);
  mockGenerateWorkout.mockResolvedValue(generatedWorkout);
  mockFetchPreviousSetDisplays.mockResolvedValue({});
  mockDeletePendingWorkout.mockResolvedValue(undefined);
});

it("tracks workout generation only after generation succeeds", async () => {
  const { queryClient, Wrapper } = createWrapper();
  const { result, unmount } = renderHook(() => useGenerateWorkout(), {
    wrapper: Wrapper,
  });

  await act(async () => {
    await result.current.mutateAsync({
      preferences: {
        difficulty_level: "beginner",
        equipment_level: "dumbbells",
        session_duration_minutes: 30,
        training_custom_prompt: null,
        training_split: "full_body",
        training_style: "strength",
        weight_unit: "kg",
      },
      request: {
        difficulty: "beginner",
        duration_minutes: 30,
        equipment: "dumbbells",
        training_split: "full_body",
        training_style: "strength",
      },
    });
  });

  expect(mockTrackEvent).toHaveBeenCalledWith(
    "workout_generated",
    expect.objectContaining({
      occurrence_id: "workout_generated:generation-action-1",
    })
  );
  expect(mockStartWorkout).toHaveBeenCalled();
  unmount();
  queryClient.clear();
});

it("tracks a pending workout start after the persisted workout is consumed", async () => {
  const { queryClient, Wrapper } = createWrapper();
  const { result, unmount } = renderHook(() => useStartPendingWorkout(), {
    wrapper: Wrapper,
  });
  const pendingWorkout: PendingWorkout = {
    created_at: "2026-07-29T10:00:00.000Z",
    focus_area: "upper",
    generated_at: "2026-07-29T10:01:00.000Z",
    generation_source: "llm",
    id: "550e8400-e29b-41d4-a716-446655440099",
    last_regenerated_at: null,
    queue_position: 0,
    regeneration_count: 0,
    regeneration_feedback: [],
    status: "ready",
    updated_at: "2026-07-29T10:01:00.000Z",
    user_edits: null,
    user_id: "550e8400-e29b-41d4-a716-446655440001",
    workout_data: generatedWorkout,
  };

  await act(async () => {
    await result.current.mutateAsync({ pendingWorkout });
  });

  expect(mockDeletePendingWorkout).toHaveBeenCalledWith(pendingWorkout.id);
  expect(mockTrackEvent).toHaveBeenCalledWith(
    "pending_workout_started",
    expect.objectContaining({
      occurrence_id: pendingWorkout.id,
    })
  );
  expect(mockNavigate).toHaveBeenCalledWith("/workout");
  unmount();
  queryClient.clear();
});
