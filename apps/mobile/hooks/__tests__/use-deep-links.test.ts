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

jest.mock("@/stores/auth-store", () => ({
  useAuthStore: { setState: jest.fn() },
}));
import { renderHook, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth-store";
import { useDeepLinks } from "../use-deep-links";

describe("email confirmation links", () => {
  const replace = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    (supabase.auth.setSession as jest.Mock).mockResolvedValue({ error: null });
  });
  it.each([
    ["signup", "/"],
    ["recovery", "/reset-password"],
  ])("restores a %s session", async (type, route) => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(
      `sweaty://#type=${type}&access_token=test-access&refresh_token=test-refresh`
    );
    renderHook(() => useDeepLinks());
    await waitFor(() => expect(replace).toHaveBeenCalledWith(route));
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: "test-access",
      refresh_token: "test-refresh",
    });
    if (type === "recovery")
      expect(useAuthStore.setState).toHaveBeenCalledWith({
        isPasswordRecovery: true,
      });
  });
  it("shows an actionable error for expired links", async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(
      "sweaty://#error=access_denied&error_code=otp_expired"
    );
    renderHook(() => useDeepLinks());
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/auth-link-error")
    );
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });
});
