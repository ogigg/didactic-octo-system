jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockLogWorkoutDeletionError = jest.fn();
const mockLogWorkoutDeletionTrace = jest.fn();

jest.mock("@/lib/workout-deletion-logger", () => ({
  logWorkoutDeletionError: (...args: unknown[]) =>
    mockLogWorkoutDeletionError(...args),
  logWorkoutDeletionTrace: (...args: unknown[]) =>
    mockLogWorkoutDeletionTrace(...args),
}));

import { supabase } from "@/lib/supabase";
import {
  createWorkoutSession,
  deleteSessionExercise,
  deleteWorkoutSession,
  fetchPreviousSetDisplays,
  fetchWorkoutDetail,
  fetchWorkoutSessions,
  updateExerciseDifficultyFeedback,
  updateWorkoutSession,
} from "../workouts";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const validSession = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  user_id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Push Day",
  status: "active",
  generation_source: "llm",
  goal_snapshot: "build_strength",
  custom_goal_snapshot: null,
  started_at: "2026-03-22T10:00:00Z",
  completed_at: null,
  created_at: "2026-03-22T10:00:00Z",
};

const validDetail = {
  id: validSession.id,
  name: "Push Day",
  status: "completed",
  generation_source: "llm",
  goal_snapshot: "build_strength",
  started_at: "2026-03-22T10:00:00Z",
  completed_at: "2026-03-22T11:00:00Z",
  created_at: "2026-03-22T10:00:00Z",
  exercises: [
    {
      id: "550e8400-e29b-41d4-a716-446655440020",
      exercise_id: "550e8400-e29b-41d4-a716-446655440001",
      exercise_name: "Bench Press",
      primary_muscles: ["chest"],
      order_index: 0,
      rest_duration_seconds: 90,
      notes: null,
      difficulty_feedback: null,
      sets: [
        {
          id: "550e8400-e29b-41d4-a716-446655440030",
          set_number: 1,
          set_type: "working",
          target_load_kg: 80,
          target_reps: 8,
          log: {
            id: "550e8400-e29b-41d4-a716-446655440040",
            actual_load_kg: 80,
            actual_reps: 8,
            rpe: 7.5,
            completed: true,
            not_completed_reason: null,
          },
        },
      ],
    },
  ],
};

function mockAuthenticatedUser() {
  (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: "550e8400-e29b-41d4-a716-446655440000" } },
    error: null,
  });
}

function mockUnauthenticated() {
  (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: null },
    error: { message: "Not authenticated" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("fetchWorkoutSessions", () => {
  it("returns validated sessions", async () => {
    mockAuthenticatedUser();
    (mockSupabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [validSession],
          error: null,
        }),
      }),
    });

    const result = await fetchWorkoutSessions();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Push Day");
  });

  it("throws when not authenticated", async () => {
    mockUnauthenticated();

    await expect(fetchWorkoutSessions()).rejects.toThrow("Not authenticated");
  });
});

describe("fetchWorkoutDetail", () => {
  it("returns validated detail from RPC", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: validDetail,
      error: null,
    });

    const result = await fetchWorkoutDetail(validSession.id);

    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].sets[0].log?.rpe).toBe(7.5);
  });

  it("throws when RPC returns error", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: "Not found or not authorized" },
    });

    await expect(fetchWorkoutDetail("bad-id")).rejects.toThrow(
      "Not found or not authorized"
    );
  });

  it("throws when response fails Zod validation", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: { ...validDetail, status: "invalid_status" },
      error: null,
    });

    await expect(fetchWorkoutDetail(validSession.id)).rejects.toThrow();
  });
});

describe("fetchPreviousSetDisplays", () => {
  it("returns previous set displays from progression history", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        {
          exercise_id: "550e8400-e29b-41d4-a716-446655440001",
          exercise_type: "weight",
          session_id: "550e8400-e29b-41d4-a716-446655440010",
          session_completed_at: "2026-03-22T11:00:00Z",
          difficulty_feedback: null,
          working_sets: [
            { load_kg: 80, reps: 8, rpe: 8, completed: true },
            { load_kg: 80, reps: 7, rpe: null, completed: true },
          ],
        },
      ],
      error: null,
    });

    const result = await fetchPreviousSetDisplays(
      ["550e8400-e29b-41d4-a716-446655440001"],
      "kg"
    );

    expect(result["550e8400-e29b-41d4-a716-446655440001"]).toEqual([
      { setNumber: 1, display: "80×8" },
      { setNumber: 2, display: "80×7" },
    ]);
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "get_exercise_progression_history",
      {
        p_user_id: "550e8400-e29b-41d4-a716-446655440000",
        p_exercise_ids: ["550e8400-e29b-41d4-a716-446655440001"],
      }
    );
  });

  it("accepts progression history rows without rpe or session_id", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        {
          exercise_id: "550e8400-e29b-41d4-a716-446655440001",
          exercise_type: "weight",
          working_sets: [{ load_kg: 60, reps: 10, completed: true }],
        },
      ],
      error: null,
    });

    const result = await fetchPreviousSetDisplays(
      ["550e8400-e29b-41d4-a716-446655440001"],
      "kg"
    );

    expect(result["550e8400-e29b-41d4-a716-446655440001"]).toEqual([
      { setNumber: 1, display: "60×10" },
    ]);
  });
});

describe("createWorkoutSession", () => {
  it("inserts and returns validated session", async () => {
    mockAuthenticatedUser();
    const mockInsert = jest.fn();
    const mockSelect = jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: validSession, error: null }),
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert.mockReturnValue({ select: mockSelect }),
    });

    const result = await createWorkoutSession({
      name: "Push Day",
      goal_snapshot: "build_strength",
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("workout_sessions");
    expect(result.name).toBe("Push Day");
  });

  it("throws when not authenticated", async () => {
    mockUnauthenticated();

    await expect(
      createWorkoutSession({ goal_snapshot: "build_strength" })
    ).rejects.toThrow("Not authenticated");
  });
});

describe("updateWorkoutSession", () => {
  it("calls supabase update with provided fields", async () => {
    mockAuthenticatedUser();
    const mockUpdate = jest.fn();
    const mockEq = jest.fn().mockResolvedValue({ error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue({
      update: mockUpdate.mockReturnValue({ eq: mockEq }),
    });

    await updateWorkoutSession(validSession.id, { status: "completed" });

    expect(mockUpdate).toHaveBeenCalledWith({ status: "completed" });
    expect(mockEq).toHaveBeenCalledWith("id", validSession.id);
  });

  it("throws when supabase returns error", async () => {
    mockAuthenticatedUser();
    const mockUpdate = jest.fn();
    const mockEq = jest
      .fn()
      .mockResolvedValue({ error: { message: "RLS violation" } });
    (mockSupabase.from as jest.Mock).mockReturnValue({
      update: mockUpdate.mockReturnValue({ eq: mockEq }),
    });

    await expect(
      updateWorkoutSession(validSession.id, { status: "completed" })
    ).rejects.toThrow("RLS violation");
  });
});

describe("deleteSessionExercise", () => {
  it("deletes the exercise occurrence after authenticating", async () => {
    mockAuthenticatedUser();
    const mockEq = jest.fn().mockResolvedValue({ error: null });
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });
    (mockSupabase.from as jest.Mock).mockReturnValue({
      delete: mockDelete,
    });

    await deleteSessionExercise("550e8400-e29b-41d4-a716-446655440020");

    expect(mockSupabase.from).toHaveBeenCalledWith("session_exercises");
    expect(mockEq).toHaveBeenCalledWith(
      "id",
      "550e8400-e29b-41d4-a716-446655440020"
    );
  });

  it("surfaces database errors", async () => {
    mockAuthenticatedUser();
    const mockEq = jest
      .fn()
      .mockResolvedValue({ error: { message: "RLS violation" } });
    (mockSupabase.from as jest.Mock).mockReturnValue({
      delete: jest.fn().mockReturnValue({ eq: mockEq }),
    });

    await expect(
      deleteSessionExercise("550e8400-e29b-41d4-a716-446655440020")
    ).rejects.toThrow("RLS violation");
  });
});

describe("deleteWorkoutSession", () => {
  it("deletes the owned completed workout through the verified RPC", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: [{ id: validSession.id, health_record_id: "health-record-id" }],
      error: null,
    });

    const result = await deleteWorkoutSession(validSession.id);

    expect(mockSupabase.rpc).toHaveBeenCalledWith("delete_workout_session", {
      p_session_id: validSession.id,
    });
    expect(result).toEqual({
      id: validSession.id,
      health_record_id: "health-record-id",
    });
  });

  it("surfaces database errors", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        details: "Searched for public.delete_workout_session",
        hint: "Apply the latest database migration",
        message: "Completed workout not found",
      },
    });

    await expect(deleteWorkoutSession(validSession.id)).rejects.toThrow(
      "Completed workout not found"
    );
    expect(mockLogWorkoutDeletionError).toHaveBeenCalledWith(
      "rpc:error",
      expect.objectContaining({ code: "PGRST202" }),
      {
        sessionId: validSession.id,
        errorCode: "PGRST202",
        errorDetails: "Searched for public.delete_workout_session",
        errorHint: "Apply the latest database migration",
      }
    );
  });

  it("rejects an invalid deletion acknowledgement", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    });

    await expect(deleteWorkoutSession(validSession.id)).rejects.toThrow();
    expect(mockLogWorkoutDeletionError).toHaveBeenCalledWith(
      "rpc:invalid-response",
      expect.anything(),
      { sessionId: validSession.id }
    );
  });
});

describe("updateExerciseDifficultyFeedback", () => {
  it("updates difficulty_feedback for a saved session exercise", async () => {
    mockAuthenticatedUser();
    const mockEq = jest.fn().mockResolvedValue({ error: null });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    (mockSupabase.from as jest.Mock).mockReturnValue({
      update: mockUpdate,
    });

    await updateExerciseDifficultyFeedback(
      "550e8400-e29b-41d4-a716-446655440020",
      "too_easy"
    );

    expect(mockSupabase.from).toHaveBeenCalledWith("session_exercises");
    expect(mockUpdate).toHaveBeenCalledWith({
      difficulty_feedback: "too_easy",
    });
    expect(mockEq).toHaveBeenCalledWith(
      "id",
      "550e8400-e29b-41d4-a716-446655440020"
    );
  });

  it("surfaces database errors", async () => {
    mockAuthenticatedUser();
    const mockEq = jest
      .fn()
      .mockResolvedValue({ error: { message: "RLS violation" } });
    (mockSupabase.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnValue({ eq: mockEq }),
    });

    await expect(
      updateExerciseDifficultyFeedback(
        "550e8400-e29b-41d4-a716-446655440020",
        "too_hard"
      )
    ).rejects.toThrow("RLS violation");
  });

  it("throws when not authenticated", async () => {
    mockUnauthenticated();

    await expect(
      updateExerciseDifficultyFeedback(
        "550e8400-e29b-41d4-a716-446655440020",
        "ok"
      )
    ).rejects.toThrow("Not authenticated");
  });
});
