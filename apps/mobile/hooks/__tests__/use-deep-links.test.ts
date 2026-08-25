jest.mock("expo-linking", () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { auth: { setSession: jest.fn() } },
}));

import { applyMarkSetDone } from "../use-deep-links";
import { useWorkoutStore } from "@/stores/workout-store";

describe("Live Activity set deep links", () => {
  beforeEach(() => {
    useWorkoutStore.getState().clearWorkout();
  });

  it("resolves a repeated exercise by occurrence ID", () => {
    const makeSet = (id: string) => ({
      id,
      type: "working" as const,
      kg: "80",
      reps: "8",
      durationSeconds: null,
      rpe: null,
      isCompleted: false,
      previousDisplay: null,
    });
    const exercise = {
      id: "bench-press",
      name: "Bench Press",
      exerciseType: "weight" as const,
      restDurationSeconds: 90,
      notes: "",
      difficultyFeedback: null,
      sets: [makeSet("first-set")],
    };

    useWorkoutStore.getState().startWorkout("Push day", [
      { ...exercise, occurrenceId: "bench-first" },
      {
        ...exercise,
        occurrenceId: "bench-second",
        sets: [makeSet("second-set")],
      },
    ]);

    applyMarkSetDone("bench-second", "second-set");

    const [first, second] = useWorkoutStore.getState().exercises;
    expect(first?.sets[0]?.isCompleted).toBe(false);
    expect(second?.sets[0]?.isCompleted).toBe(true);
  });
});
