import {
  buildActiveWatchSnapshot,
  buildCancelledWatchSnapshot,
  buildWatchSettingsSnapshot,
  extractWatchCommandID,
  makeWatchEnvelope,
  makeWatchSettingsEnvelope,
  parseWatchSettingsEnvelope,
  parseWatchAction,
  registerWatchCommand,
  shouldApplyWatchAction,
} from "@/lib/watch-workout-sync";
import { WATCH_SYNC_PROTOCOL_VERSION } from "@/modules/watch-bridge/src";
import type { WorkoutExercise } from "@/stores/workout-store";

const exercises: WorkoutExercise[] = [
  {
    id: "exercise-long-lived-id",
    name: "Bench Press",
    exerciseType: "weight",
    restDurationSeconds: 90,
    notes: "",
    difficultyFeedback: null,
    sets: [
      {
        id: "set-stable-id",
        type: "working",
        kg: "42.5",
        reps: "8",
        durationSeconds: null,
        rpe: null,
        isCompleted: true,
        previousDisplay: "40 kg × 8",
      },
      {
        id: "next-set-stable-id",
        type: "working",
        kg: "45",
        reps: "8",
        durationSeconds: null,
        rpe: null,
        isCompleted: false,
        previousDisplay: "42.5 kg × 8",
      },
    ],
  },
];

describe("watch workout synchronization", () => {
  it("preserves revisions above the physical Watch Int32 range", () => {
    const revision = 1_775_000_000_123;
    const snapshot = buildActiveWatchSnapshot({
      workoutName: "Physical Watch",
      startedAtMs: revision,
      exercises,
      restTimer: null,
    });

    expect(makeWatchEnvelope(snapshot, revision).revision).toBe(revision);
    expect(revision).toBeGreaterThan(2_147_483_647);
  });

  it("keeps the legacy workout payload unchanged while adding settings", () => {
    const snapshot = buildActiveWatchSnapshot({
      workoutName: "Compatibility",
      startedAtMs: Date.parse("2026-07-29T10:00:00.000Z"),
      exercises,
      restTimer: null,
    });
    const settings = buildWatchSettingsSnapshot({
      restWarningSeconds: 5,
      showHeartRate: false,
    });
    const envelope = makeWatchEnvelope(snapshot, 10, settings, 22);

    expect(JSON.parse(envelope.payload)).toEqual(snapshot);
    expect(envelope).toMatchObject({
      settingsRevision: 22,
      watchSettingsPayload: JSON.stringify(settings),
    });
    expect(
      parseWatchSettingsEnvelope(makeWatchSettingsEnvelope(settings, 22))
    ).toMatchObject({
      envelope: { kind: "watchSettings", settingsRevision: 22 },
      snapshot: settings,
    });
  });

  it("rejects nonpositive settings revisions instead of creating a reset", () => {
    expect(() =>
      makeWatchSettingsEnvelope(buildWatchSettingsSnapshot({}), 0)
    ).toThrow("watch settings revision must be a positive integer");
  });

  it("builds a full stable-ID snapshot with an anchored rest end date", () => {
    const snapshot = buildActiveWatchSnapshot({
      workoutName: "Push day",
      startedAtMs: Date.parse("2026-07-29T10:00:00.000Z"),
      exercises,
      restTimer: {
        exerciseId: "exercise-long-lived-id",
        startedAtMs: Date.parse("2026-07-29T10:10:00.000Z"),
        durationSeconds: 90,
      },
    });

    expect(snapshot.workoutId).toBe("workout-1785319200000");
    expect(snapshot.selectedExerciseId).toBe("exercise-long-lived-id");
    expect(snapshot.exercises[0].sets[0]).toMatchObject({
      id: "set-stable-id",
      actualLoadKg: 42.5,
      actualReps: 8,
      isCompleted: true,
    });
    expect(snapshot.rest?.endDate).toBe("2026-07-29T10:11:30.000Z");
    expect(makeWatchEnvelope(snapshot, 7)).toMatchObject({
      protocolVersion: WATCH_SYNC_PROTOCOL_VERSION,
      revision: 7,
      kind: "workoutState",
    });
  });

  it("keeps planned values stable and converts display-unit loads on the wire", () => {
    const snapshot = buildActiveWatchSnapshot({
      workoutName: "Imperial push",
      startedAtMs: Date.parse("2026-07-29T10:00:00.000Z"),
      exercises: [
        {
          ...exercises[0]!,
          sets: [
            {
              ...exercises[0]!.sets[0]!,
              kg: "110",
              reps: "6",
              plannedKg: "100",
              plannedReps: "8",
            },
          ],
        },
      ],
      restTimer: null,
      weightUnit: "lbs",
    });

    expect(snapshot.weightUnit).toBe("lbs");
    expect(snapshot.exercises[0]?.sets[0]).toMatchObject({
      targetLoadKg: 100 / 2.20462,
      targetReps: 8,
      actualLoadKg: 110 / 2.20462,
      actualReps: 6,
    });
  });

  it("runtime-validates commands and their JSON payload", () => {
    const valid = parseWatchAction({
      protocolVersion: WATCH_SYNC_PROTOCOL_VERSION,
      commandID: "command-1",
      baseRevision: 4,
      sentAt: "2026-07-29T10:12:00.000Z",
      type: "completeSet",
      payload: JSON.stringify({
        workoutId: "workout-1785319200000",
        exerciseId: "exercise-long-lived-id",
        setId: "next-set-stable-id",
        loadKg: 45,
        reps: 8,
        durationSeconds: 45,
        restId: "rest-1",
        completedAt: "2026-07-29T10:12:01.000Z",
      }),
    });

    expect(valid?.payload.setId).toBe("next-set-stable-id");
    expect(
      parseWatchAction({
        protocolVersion: WATCH_SYNC_PROTOCOL_VERSION,
        commandID: "command-2",
        baseRevision: 4,
        sentAt: "not-a-date",
        type: "completeSet",
        payload: "{}",
      })
    ).toBeNull();
  });

  it("represents a paused timer without a moving end date", () => {
    const snapshot = buildActiveWatchSnapshot({
      workoutName: "Push day",
      startedAtMs: Date.parse("2026-07-29T10:00:00.000Z"),
      exercises,
      restTimer: {
        exerciseId: "exercise-long-lived-id",
        startedAtMs: Date.parse("2026-07-29T10:10:00.000Z"),
        durationSeconds: 90,
        pausedRemainingSeconds: 37,
      },
    });

    expect(snapshot.rest).toMatchObject({
      endDate: null,
      pausedRemainingSeconds: 37,
    });
  });

  it("publishes a cancelled terminal snapshot when a workout is discarded", () => {
    const snapshot = buildCancelledWatchSnapshot({
      workoutName: "Push day",
      startedAtMs: Date.parse("2026-07-29T10:00:00.000Z"),
      cancelledAtMs: Date.parse("2026-07-29T10:30:00.000Z"),
      exercises,
    });

    expect(snapshot).toMatchObject({
      workoutId: "workout-1785319200000",
      status: "cancelled",
      finishedAt: "2026-07-29T10:30:00.000Z",
      rest: null,
    });
    expect(makeWatchEnvelope(snapshot, 8).kind).toBe("workoutEnded");
  });

  it("uses unique occurrence IDs when a catalog exercise appears twice", () => {
    const duplicateExercises: WorkoutExercise[] = [
      { ...exercises[0], occurrenceId: "bench-first" },
      {
        ...exercises[0],
        occurrenceId: "bench-second",
        sets: [{ ...exercises[0].sets[0], id: "second-bench-set" }],
      },
    ];
    const snapshot = buildActiveWatchSnapshot({
      workoutName: "Duplicate bench",
      startedAtMs: Date.parse("2026-07-29T10:00:00.000Z"),
      exercises: duplicateExercises,
      restTimer: null,
    });

    expect(snapshot.exercises.map((exercise) => exercise.id)).toEqual([
      "bench-first",
      "bench-second",
    ]);
    expect(
      snapshot.exercises.map((exercise) => exercise.catalogExerciseId)
    ).toEqual(["exercise-long-lived-id", "exercise-long-lived-id"]);
  });

  it("accepts stale commands for an incomplete set on the same workout", () => {
    const parsed = parseWatchAction({
      protocolVersion: WATCH_SYNC_PROTOCOL_VERSION,
      commandID: "stale-command",
      baseRevision: 4,
      sentAt: "2026-07-29T10:12:00.000Z",
      type: "completeSet",
      payload: JSON.stringify({
        workoutId: "workout-1785319200000",
        exerciseId: "bench-first",
        setId: "set-stable-id",
      }),
    });
    expect(parsed).not.toBeNull();

    const context = {
      currentRevision: 5,
      workoutId: "workout-1785319200000",
      isActive: true,
      exerciseExists: true,
      setState: "incomplete" as const,
      restId: null,
    };
    expect(shouldApplyWatchAction(parsed!, context)).toBe(true);
    expect(
      shouldApplyWatchAction(
        { ...parsed!, envelope: { ...parsed!.envelope, baseRevision: 6 } },
        context
      )
    ).toBe(true);
    expect(
      shouldApplyWatchAction(
        {
          ...parsed!,
          envelope: {
            ...parsed!.envelope,
            type: "updateSet",
          },
        },
        context
      )
    ).toBe(true);
    expect(
      shouldApplyWatchAction(
        {
          ...parsed!,
          envelope: {
            ...parsed!.envelope,
            type: "updateSet",
          },
        },
        context
      )
    ).toBe(true);
    expect(
      shouldApplyWatchAction(
        {
          ...parsed!,
          envelope: { ...parsed!.envelope, type: "reopenSet" },
        },
        { ...context, setState: "completed" }
      )
    ).toBe(true);
  });

  it("deduplicates repeated command delivery before mutation", () => {
    const processed = new Set<string>();
    expect(registerWatchCommand("command-1", processed)).toBe(true);
    expect(registerWatchCommand("command-1", processed)).toBe(false);
  });

  it("applies queued rest commands only to the rest cycle they target", () => {
    const parsed = parseWatchAction({
      protocolVersion: WATCH_SYNC_PROTOCOL_VERSION,
      commandID: "pause-rest",
      baseRevision: 4,
      sentAt: "2026-07-29T10:12:00.000Z",
      type: "pauseRest",
      payload: JSON.stringify({
        workoutId: "workout-1785319200000",
        restId: "rest-cycle-1",
      }),
    });
    expect(parsed).not.toBeNull();

    const context = {
      currentRevision: 7,
      workoutId: "workout-1785319200000",
      isActive: true,
      exerciseExists: false,
      setState: "missing" as const,
      restId: "rest-cycle-1",
    };
    expect(shouldApplyWatchAction(parsed!, context)).toBe(true);
    expect(
      shouldApplyWatchAction(parsed!, {
        ...context,
        restId: "rest-cycle-2",
      })
    ).toBe(false);
  });

  it("accepts a state refresh request without a workout ID", () => {
    const parsed = parseWatchAction({
      protocolVersion: WATCH_SYNC_PROTOCOL_VERSION,
      commandID: "request-state",
      baseRevision: 0,
      sentAt: "2026-07-29T10:12:00.000Z",
      type: "requestState",
      payload: "{}",
    });

    expect(parsed?.payload.workoutId).toBeUndefined();
    expect(
      shouldApplyWatchAction(parsed!, {
        currentRevision: 0,
        workoutId: null,
        isActive: false,
        exerciseExists: false,
        setState: "missing",
        restId: null,
      })
    ).toBe(true);
  });

  it("accepts a late Health receipt even when its revision is newer", () => {
    const parsed = parseWatchAction({
      protocolVersion: WATCH_SYNC_PROTOCOL_VERSION,
      commandID: "health-saved-future-revision",
      baseRevision: 99,
      sentAt: "2026-07-29T10:12:00.000Z",
      type: "healthWorkoutSaved",
      payload: JSON.stringify({
        workoutId: "workout-1785319200000",
        healthWorkoutUUID: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(
      shouldApplyWatchAction(parsed!, {
        currentRevision: 7,
        workoutId: null,
        isActive: false,
        exerciseExists: false,
        setState: "missing",
        restId: null,
        canApplyHealthCommand: true,
      })
    ).toBe(true);
  });

  it("accepts explicit warmup state commands", () => {
    const parsed = parseWatchAction({
      protocolVersion: WATCH_SYNC_PROTOCOL_VERSION,
      commandID: "warmup-state",
      baseRevision: 3,
      sentAt: "2026-07-29T10:12:00.000Z",
      type: "setWarmupComplete",
      payload: JSON.stringify({
        workoutId: "workout-1785319200000",
        isCompleted: true,
      }),
    });

    expect(parsed?.payload.isCompleted).toBe(true);
  });

  it("extracts command IDs so malformed commands can still be acknowledged", () => {
    expect(extractWatchCommandID({ commandID: "bad-payload" })).toBe(
      "bad-payload"
    );
    expect(extractWatchCommandID({ commandID: 42 })).toBeNull();
  });
});
