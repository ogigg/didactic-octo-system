import type { WorkoutExercise } from "@/stores/workout-store";
import { getWorkoutShareHighlights } from "@/lib/workout-share-utils";

function makeExercise(overrides: Partial<WorkoutExercise>): WorkoutExercise {
  return {
    id: "exercise",
    name: "Exercise",
    exerciseType: "weight",
    restDurationSeconds: 90,
    notes: "",
    difficultyFeedback: null,
    sets: [],
    ...overrides,
  };
}

describe("getWorkoutShareHighlights", () => {
  const formatWeight = (kg: number) => `${kg}kg`;

  it("returns only exercises with completed sets", () => {
    const highlights = getWorkoutShareHighlights(
      [
        makeExercise({
          id: "bench",
          name: "Bench Press",
          sets: [
            {
              id: "set-1",
              type: "working",
              kg: "80",
              reps: "5",
              durationSeconds: null,
              rpe: null,
              isCompleted: true,
              previousDisplay: null,
            },
          ],
        }),
        makeExercise({
          id: "row",
          name: "Row",
          sets: [
            {
              id: "set-2",
              type: "working",
              kg: "70",
              reps: "8",
              durationSeconds: null,
              rpe: null,
              isCompleted: false,
              previousDisplay: null,
            },
          ],
        }),
      ],
      { formatWeight }
    );

    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({
      id: "bench",
      name: "Bench Press",
      completedSets: 1,
      metric: "80kg x 5",
    });
  });

  it("limits highlights to three exercises", () => {
    const exercises = Array.from({ length: 5 }, (_, index) =>
      makeExercise({
        id: `exercise-${index}`,
        name: `Exercise ${index}`,
        sets: [
          {
            id: `set-${index}`,
            type: "working",
            kg: "20",
            reps: "10",
            durationSeconds: null,
            rpe: null,
            isCompleted: true,
            previousDisplay: null,
          },
        ],
      })
    );

    const highlights = getWorkoutShareHighlights(exercises, { formatWeight });

    expect(highlights.map((highlight) => highlight.id)).toEqual([
      "exercise-0",
      "exercise-1",
      "exercise-2",
    ]);
  });

  it("uses top set metrics for weight exercises", () => {
    const highlights = getWorkoutShareHighlights(
      [
        makeExercise({
          id: "squat",
          name: "Squat",
          sets: [
            {
              id: "set-1",
              type: "working",
              kg: "100",
              reps: "3",
              durationSeconds: null,
              rpe: null,
              isCompleted: true,
              previousDisplay: null,
            },
            {
              id: "set-2",
              type: "working",
              kg: "80",
              reps: "8",
              durationSeconds: null,
              rpe: null,
              isCompleted: true,
              previousDisplay: null,
            },
          ],
        }),
      ],
      { formatWeight }
    );

    expect(highlights[0]?.metric).toBe("80kg x 8");
  });

  it("uses best duration metrics for time-based exercises", () => {
    const highlights = getWorkoutShareHighlights(
      [
        makeExercise({
          id: "plank",
          name: "Plank",
          exerciseType: "time",
          sets: [
            {
              id: "set-1",
              type: "working",
              kg: "",
              reps: "",
              durationSeconds: 45,
              rpe: null,
              isCompleted: true,
              previousDisplay: null,
            },
            {
              id: "set-2",
              type: "working",
              kg: "",
              reps: "",
              durationSeconds: 75,
              rpe: null,
              isCompleted: true,
              previousDisplay: null,
            },
          ],
        }),
      ],
      { formatWeight }
    );

    expect(highlights[0]?.metric).toBe("1:15");
  });

  it("returns an empty list when no completed exercise exists", () => {
    const highlights = getWorkoutShareHighlights(
      [
        makeExercise({
          id: "curl",
          name: "Curl",
          sets: [
            {
              id: "set-1",
              type: "working",
              kg: "12",
              reps: "10",
              durationSeconds: null,
              rpe: null,
              isCompleted: false,
              previousDisplay: null,
            },
          ],
        }),
      ],
      { formatWeight }
    );

    expect(highlights).toEqual([]);
  });
});
