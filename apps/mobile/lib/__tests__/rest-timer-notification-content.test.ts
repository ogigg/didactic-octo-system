import i18n from "@/i18n";
import type { WorkoutExercise, WorkoutSet } from "@/stores/workout-store";
import { getNextUp } from "../rest-timer";
import {
  buildRestTimerNotificationContent,
  restTimerNotificationNextUpSchema,
  toRestTimerNotificationNextUp,
} from "../rest-timer-notification-content";

const t = i18n.getFixedT("en", "workout");

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: `set-${Math.random().toString(36).slice(2)}`,
    type: "working",
    kg: "80",
    reps: "5",
    durationSeconds: null,
    rpe: null,
    isCompleted: false,
    previousDisplay: null,
    ...overrides,
  };
}

function makeExercise(
  id: string,
  sets: WorkoutSet[],
  overrides: Partial<WorkoutExercise> = {}
): WorkoutExercise {
  return {
    id,
    name: id,
    exerciseType: "weight",
    restDurationSeconds: 120,
    notes: "",
    difficultyFeedback: null,
    sets,
    ...overrides,
  };
}

describe("restTimerNotificationNextUpSchema", () => {
  it("accepts privacy-safe next-up snapshots and drops blank names", () => {
    expect(
      restTimerNotificationNextUpSchema.parse({
        kind: "set",
        exerciseName: "  Bench Press  ",
        workingSetNumber: 2,
      })
    ).toEqual({
      kind: "set",
      exerciseName: "Bench Press",
      workingSetNumber: 2,
    });

    expect(
      restTimerNotificationNextUpSchema.parse({
        kind: "exercise",
        exerciseName: "   ",
      })
    ).toEqual({
      kind: "exercise",
      exerciseName: undefined,
    });
  });

  it("rejects invalid set numbers", () => {
    expect(
      restTimerNotificationNextUpSchema.safeParse({
        kind: "set",
        exerciseName: "Squat",
        workingSetNumber: 0,
      }).success
    ).toBe(false);
  });
});

describe("toRestTimerNotificationNextUp", () => {
  it("projects NextUp without exposing set prescription details", () => {
    const exercise = makeExercise(
      "bench",
      [
        makeSet({ isCompleted: true }),
        makeSet({ kg: "100", reps: "3", rpe: 9 }),
      ],
      { name: "Bench Press" }
    );

    const nextUp = getNextUp([exercise], "bench");
    expect(toRestTimerNotificationNextUp(nextUp)).toEqual({
      kind: "set",
      exerciseName: "Bench Press",
      workingSetNumber: 2,
    });
  });
});

describe("buildRestTimerNotificationContent", () => {
  it("prefers the next exercise name and working-set number", () => {
    const exercise = makeExercise(
      "bench",
      [makeSet({ isCompleted: true }), makeSet()],
      { name: "Bench Press" }
    );

    expect(
      buildRestTimerNotificationContent(t, getNextUp([exercise], "bench"))
    ).toEqual({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "Up next: Bench Press, set 2",
    });
  });

  it("describes a warmup set without inventing a working-set number", () => {
    const exercise = makeExercise("bench", [makeSet({ type: "warmup" })], {
      name: "Bench Press",
    });

    expect(
      buildRestTimerNotificationContent(t, getNextUp([exercise], "bench"))
    ).toEqual({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "Up next: Bench Press, warmup set",
    });
  });

  it("names the next exercise when the current one is finished", () => {
    const bench = makeExercise("bench", [makeSet({ isCompleted: true })], {
      name: "Bench Press",
    });
    const squat = makeExercise("squat", [makeSet()], { name: "Back Squat" });

    expect(
      buildRestTimerNotificationContent(t, getNextUp([bench, squat], "bench"))
    ).toEqual({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "Up next: Back Squat",
    });
  });

  it("uses a final-set body that does not invent a next exercise", () => {
    const bench = makeExercise("bench", [makeSet({ isCompleted: true })], {
      name: "Bench Press",
    });

    expect(
      buildRestTimerNotificationContent(t, getNextUp([bench], "bench"))
    ).toEqual({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "All sets done — finish strong!",
    });
  });

  it("falls back safely when the exercise name is missing", () => {
    expect(
      buildRestTimerNotificationContent(t, {
        kind: "set",
        exerciseName: "   ",
        workingSetNumber: 3,
      })
    ).toEqual({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "Up next: set 3",
    });

    expect(
      buildRestTimerNotificationContent(t, {
        kind: "exercise",
        exerciseName: "",
      })
    ).toEqual({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "Time for your next set.",
    });

    expect(
      buildRestTimerNotificationContent(t, {
        kind: "set",
        exerciseName: undefined,
        workingSetNumber: null,
      })
    ).toEqual({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "Up next: warmup set",
    });
  });

  it("falls back to the generic body for invalid payloads", () => {
    expect(buildRestTimerNotificationContent(t, null)).toEqual({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "Time for your next set.",
    });

    expect(
      buildRestTimerNotificationContent(t, {
        kind: "set",
        exerciseName: "Bench",
        workingSetNumber: -1,
      })
    ).toEqual({
      channelName: "Rest timer",
      title: "Rest complete",
      body: "Time for your next set.",
    });
  });
});
