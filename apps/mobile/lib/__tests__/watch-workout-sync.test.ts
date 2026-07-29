import {
  buildActiveWatchSnapshot,
  makeWatchEnvelope,
  parseWatchAction,
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
});
