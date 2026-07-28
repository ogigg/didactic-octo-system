const mockDeleteWorkoutSession = jest.fn();
const mockCancelWorkoutHealthRetry = jest.fn();
const mockDeleteHealthWorkout = jest.fn();

jest.mock("@/lib/api/workouts", () => ({
  ...jest.requireActual("@/lib/api/workouts"),
  deleteWorkoutSession: (...args: unknown[]) =>
    mockDeleteWorkoutSession(...args),
}));

jest.mock("@/lib/health", () => ({
  cancelWorkoutHealthRetry: (...args: unknown[]) =>
    mockCancelWorkoutHealthRetry(...args),
  deleteWorkout: (...args: unknown[]) => mockDeleteHealthWorkout(...args),
}));

jest.mock("@/lib/health/prompt", () => ({
  promptAndSyncWorkout: jest.fn(),
}));

jest.mock("@/lib/workout-deletion-logger", () => ({
  logWorkoutDeletionError: jest.fn(),
  logWorkoutDeletionTrace: jest.fn(),
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useDeleteWorkoutSession } from "@/hooks/use-workout-mutations";
import {
  calendarKeys,
  exerciseDetailKeys,
  statsKeys,
  streakProtectionKeys,
  workoutKeys,
  workoutSessionCommentKeys,
  workoutStatsKeys,
} from "@/lib/query-keys";

const deletedId = "550e8400-e29b-41d4-a716-446655440010";
const retainedId = "550e8400-e29b-41d4-a716-446655440011";

const deletedWorkout = {
  id: deletedId,
  name: "Push day",
  started_at: "2026-07-28T10:00:00.000Z",
  completed_at: "2026-07-28T11:00:00.000Z",
  created_at: "2026-07-28T10:00:00.000Z",
  exercise_count: 1,
  total_sets: 3,
  total_volume_kg: 1200,
  exercise_ids: [],
  exercise_names: ["Bench Press"],
};

const retainedWorkout = {
  ...deletedWorkout,
  id: retainedId,
  name: "Leg day",
};

const activeQueryClients: QueryClient[] = [];

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  activeQueryClients.push(queryClient);

  queryClient.setQueryData(workoutKeys.list("en"), {
    pages: [[deletedWorkout, retainedWorkout]],
    pageParams: [undefined],
  });
  queryClient.setQueryData(workoutKeys.forDay("2026-07-28"), [
    deletedWorkout,
    retainedWorkout,
  ]);
  queryClient.setQueryData(calendarKeys.entries(), [
    {
      id: deletedId,
      name: "Push day",
      completed_at: "2026-07-28T11:00:00.000Z",
    },
    {
      id: retainedId,
      name: "Leg day",
      completed_at: "2026-07-27T11:00:00.000Z",
    },
  ]);

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { queryClient, Wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCancelWorkoutHealthRetry.mockResolvedValue(undefined);
  mockDeleteHealthWorkout.mockResolvedValue({
    ok: true,
    externalId: "health-record-id",
  });
});

afterEach(() => {
  activeQueryClients.splice(0).forEach((queryClient) => queryClient.clear());
});

describe("useDeleteWorkoutSession", () => {
  it("optimistically removes the workout and cleans up its health records", async () => {
    mockDeleteWorkoutSession.mockResolvedValue({
      id: deletedId,
      health_record_id: "health-record-id",
    });
    const { queryClient, Wrapper } = createHarness();
    const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDeleteWorkoutSession(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(deletedId);
    });

    const history = queryClient.getQueryData<{
      pages: (typeof deletedWorkout)[][];
    }>(workoutKeys.list("en"));
    const day = queryClient.getQueryData<(typeof deletedWorkout)[]>(
      workoutKeys.forDay("2026-07-28")
    );
    const calendar = queryClient.getQueryData<{ id: string }[]>(
      calendarKeys.entries()
    );

    expect(history?.pages[0]).toEqual([retainedWorkout]);
    expect(day).toEqual([retainedWorkout]);
    expect(calendar?.map((entry) => entry.id)).toEqual([retainedId]);
    expect(mockCancelWorkoutHealthRetry).toHaveBeenCalledWith(deletedId);
    expect(mockDeleteHealthWorkout).toHaveBeenCalledWith("health-record-id");
    [
      workoutKeys.all,
      exerciseDetailKeys.all,
      calendarKeys.all,
      workoutStatsKeys.all,
      statsKeys.all,
      streakProtectionKeys.all,
      workoutSessionCommentKeys.all,
    ].forEach((queryKey) => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
    });
  });

  it("rolls optimistic history and calendar changes back on failure", async () => {
    let rejectDeletion: ((error: Error) => void) | undefined;
    mockDeleteWorkoutSession.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectDeletion = reject;
        })
    );
    const { queryClient, Wrapper } = createHarness();
    const { result } = renderHook(() => useDeleteWorkoutSession(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(deletedId);
    });

    await waitFor(() => {
      const history = queryClient.getQueryData<{
        pages: { id: string }[][];
      }>(workoutKeys.list("en"));
      expect(history?.pages[0]?.map((workout) => workout.id)).toEqual([
        retainedId,
      ]);
    });

    act(() => {
      rejectDeletion?.(new Error("Completed workout not found"));
    });

    await waitFor(() => {
      const history = queryClient.getQueryData<{
        pages: { id: string }[][];
      }>(workoutKeys.list("en"));
      const calendar = queryClient.getQueryData<{ id: string }[]>(
        calendarKeys.entries()
      );

      expect(history?.pages[0]?.map((workout) => workout.id)).toEqual([
        deletedId,
        retainedId,
      ]);
      expect(calendar?.map((entry) => entry.id)).toEqual([
        deletedId,
        retainedId,
      ]);
    });

    expect(mockCancelWorkoutHealthRetry).not.toHaveBeenCalled();
  });
});
