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

const mockListCommentsForSession = jest.fn();

jest.mock("@/lib/api/workout-session-comments", () => ({
  listCommentsForSession: (...args: unknown[]) =>
    mockListCommentsForSession(...args),
}));

import { supabase } from "@/lib/supabase";
import {
  createWorkoutSession,
  deleteSessionExercise,
  deleteWorkoutSession,
  fetchEditableExerciseHistory,
  fetchCompletedWorkoutDetails,
  fetchPreviousSetDisplays,
  fetchWorkoutDetail,
  fetchWorkoutSessions,
  updateExerciseDifficultyFeedback,
  updateCompletedSessionExerciseSets,
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
  mockListCommentsForSession.mockResolvedValue([]);
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

describe("fetchCompletedWorkoutDetails", () => {
  it("filters completed sessions by range and resolves their full details", async () => {
    mockAuthenticatedUser();
    const response = {
      data: [{ id: validSession.id, completed_at: validDetail.completed_at }],
      error: null,
    };
    const query: Record<string, jest.Mock> = {
      select: jest.fn(),
      eq: jest.fn(),
      not: jest.fn(),
      lte: jest.fn(),
      gte: jest.fn().mockResolvedValue(response),
      order: jest.fn(),
      range: jest.fn(),
    };
    Object.entries(query)
      .filter(([name]) => name !== "gte")
      .forEach(([, method]) => method.mockReturnValue(query));
    (mockSupabase.from as jest.Mock).mockReturnValue(query);
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: validDetail,
      error: null,
    });
    mockListCommentsForSession.mockResolvedValue([
      {
        id: "550e8400-e29b-41d4-a716-446655440050",
        user_id: validSession.user_id,
        workout_session_id: validSession.id,
        comment: "Felt strong",
        created_at: "2026-03-22T11:01:00Z",
      },
    ]);

    const result = await fetchCompletedWorkoutDetails(
      "2026-03-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z"
    );

    expect(query.gte).toHaveBeenCalledWith(
      "completed_at",
      "2026-03-01T00:00:00.000Z"
    );
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "get_workout_session_detail",
      { p_session_id: validSession.id }
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: validSession.id,
        comments: [expect.objectContaining({ comment: "Felt strong" })],
      }),
    ]);
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

    expect(result["550e8400-e29b-41d4-a716-446655440001"]).toEqual({
      warmup: null,
      working: [
        { setNumber: 1, display: "80×8" },
        { setNumber: 2, display: "80×7" },
      ],
    });
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "get_exercise_progression_history",
      {
        p_user_id: "550e8400-e29b-41d4-a716-446655440000",
        p_exercise_ids: ["550e8400-e29b-41d4-a716-446655440001"],
      }
    );
  });

  it("maps warmup and working channels from the same latest completed session", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        {
          exercise_id: "550e8400-e29b-41d4-a716-446655440001",
          exercise_type: "weight",
          session_id: "550e8400-e29b-41d4-a716-446655440010",
          session_completed_at: "2026-03-22T11:00:00Z",
          difficulty_feedback: null,
          warmup_sets: [{ load_kg: 20, reps: 10, completed: true }],
          working_sets: [
            { load_kg: 40, reps: 10, rpe: 8, completed: true },
            { load_kg: 40, reps: 10, rpe: 8, completed: true },
            { load_kg: 40, reps: 10, rpe: 8, completed: true },
          ],
        },
      ],
      error: null,
    });

    const result = await fetchPreviousSetDisplays(
      ["550e8400-e29b-41d4-a716-446655440001"],
      "kg"
    );

    expect(result["550e8400-e29b-41d4-a716-446655440001"]).toEqual({
      warmup: "20×10",
      working: [
        { setNumber: 1, display: "40×10" },
        { setNumber: 2, display: "40×10" },
        { setNumber: 3, display: "40×10" },
      ],
    });
  });

  it("accepts progression history rows without rpe, session_id, or warmup_sets", async () => {
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

    expect(result["550e8400-e29b-41d4-a716-446655440001"]).toEqual({
      warmup: null,
      working: [{ setNumber: 1, display: "60×10" }],
    });
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
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    });

    await deleteSessionExercise("550e8400-e29b-41d4-a716-446655440020");

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "delete_completed_session_exercise",
      {
        p_session_exercise_id: "550e8400-e29b-41d4-a716-446655440020",
      }
    );
  });

  it("surfaces database errors", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: "Completed exercise not found or not authorized" },
    });

    await expect(
      deleteSessionExercise("550e8400-e29b-41d4-a716-446655440020")
    ).rejects.toThrow("Completed exercise not found or not authorized");
  });
});

describe("completed exercise history editing", () => {
  it("fetches editable history with stable database IDs", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        {
          id: "550e8400-e29b-41d4-a716-446655440020",
          session_id: validSession.id,
          date: "2026-03-22T11:00:00Z",
          workout_name: "Push Day",
          sets: [
            {
              id: "550e8400-e29b-41d4-a716-446655440030",
              set_number: 1,
              set_type: "working",
              load_kg: 82.5,
              reps: 8,
              duration_seconds: null,
              rpe: 8,
            },
          ],
        },
      ],
      error: null,
    });

    const result = await fetchEditableExerciseHistory(
      "550e8400-e29b-41d4-a716-446655440001"
    );

    expect(result[0]?.sets[0]?.load_kg).toBe(82.5);
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "get_editable_exercise_history",
      { p_exercise_id: "550e8400-e29b-41d4-a716-446655440001" }
    );
  });

  it("sends the complete edited set list to the transactional RPC", async () => {
    mockAuthenticatedUser();
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    });
    const sets = [
      {
        id: "550e8400-e29b-41d4-a716-446655440030",
        set_type: "working" as const,
        actual_load_kg: 85,
        actual_reps: 6,
        rpe: 9,
      },
    ];

    await updateCompletedSessionExerciseSets(
      "550e8400-e29b-41d4-a716-446655440020",
      sets
    );

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "update_completed_exercise_sets",
      {
        p_session_exercise_id: "550e8400-e29b-41d4-a716-446655440020",
        p_sets: sets,
      }
    );
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
