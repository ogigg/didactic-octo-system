jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Keyboard, Platform, StyleSheet } from "react-native";

import { KeyboardDismissButton } from "../keyboard-dismiss-button";
import { useWorkoutStore, type WorkoutExercise } from "@/stores/workout-store";

const exercise: WorkoutExercise = {
  id: "bench-press",
  name: "Bench Press",
  exerciseType: "weight",
  restDurationSeconds: 120,
  notes: "Keep elbows tucked",
  difficultyFeedback: null,
  progressionType: "new_exercise",
  sets: [
    {
      id: "set-1",
      type: "working",
      kg: "80",
      reps: "5",
      durationSeconds: null,
      rpe: null,
      isCompleted: false,
      previousDisplay: null,
    },
  ],
};

type KeyboardHandler = (event?: { endCoordinates: { height: number } }) => void;

describe("KeyboardDismissButton", () => {
  const listeners = new Map<string, KeyboardHandler>();
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    listeners.clear();
    useWorkoutStore.getState().clearWorkout();
    useWorkoutStore.getState().startWorkout("Push day", [exercise], undefined);

    jest.spyOn(Keyboard, "addListener").mockImplementation((event, handler) => {
      listeners.set(event, handler as KeyboardHandler);
      return { remove: jest.fn() } as unknown as ReturnType<
        typeof Keyboard.addListener
      >;
    });
    jest.spyOn(Keyboard, "dismiss").mockImplementation(jest.fn());
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalOS,
    });
    jest.restoreAllMocks();
  });

  function showKeyboard(height = 280) {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    act(() => {
      listeners.get(showEvent)?.({ endCoordinates: { height } });
    });
  }

  function hideKeyboard() {
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    act(() => {
      listeners.get(hideEvent)?.();
    });
  }

  it("is hidden until the keyboard opens", () => {
    render(<KeyboardDismissButton />);

    expect(
      screen.queryByRole("button", { name: "keyboard.dismiss" })
    ).toBeNull();
  });

  it("shows an accessible dismiss control while the keyboard is open", () => {
    render(<KeyboardDismissButton />);

    showKeyboard();

    const button = screen.getByRole("button", { name: "keyboard.dismiss" });
    expect(button).toBeTruthy();
    expect(screen.queryByText("keyboard.done")).toBeNull();

    const flattened = StyleSheet.flatten(button.props.style);
    expect(flattened.left).toBeGreaterThan(0);
    expect(flattened.right).toBeUndefined();
    expect(flattened.width).toBeGreaterThanOrEqual(44);
    expect(flattened.height).toBeGreaterThanOrEqual(44);
    expect(flattened.bottom).toBe(288);
  });

  it("dismisses the keyboard without changing entered set values", () => {
    render(<KeyboardDismissButton />);
    showKeyboard();

    const setBefore = useWorkoutStore.getState().exercises[0]?.sets[0];
    expect(setBefore).toMatchObject({
      id: "set-1",
      kg: "80",
      reps: "5",
      isCompleted: false,
    });

    fireEvent.press(screen.getByRole("button", { name: "keyboard.dismiss" }));

    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);

    const setAfter = useWorkoutStore.getState().exercises[0]?.sets[0];
    expect(setAfter).toEqual(setBefore);
    expect(useWorkoutStore.getState().exercises[0]?.notes).toBe(
      "Keep elbows tucked"
    );
  });

  it("hides again when the keyboard closes", () => {
    render(<KeyboardDismissButton />);
    showKeyboard();
    expect(
      screen.getByRole("button", { name: "keyboard.dismiss" })
    ).toBeTruthy();

    hideKeyboard();

    expect(
      screen.queryByRole("button", { name: "keyboard.dismiss" })
    ).toBeNull();
  });

  it("listens for Android keyboard events", () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });

    render(<KeyboardDismissButton />);

    expect(Keyboard.addListener).toHaveBeenCalledWith(
      "keyboardDidShow",
      expect.any(Function)
    );
    expect(Keyboard.addListener).toHaveBeenCalledWith(
      "keyboardDidHide",
      expect.any(Function)
    );

    showKeyboard(320);
    const button = screen.getByRole("button", { name: "keyboard.dismiss" });
    expect(button).toBeTruthy();
    expect(StyleSheet.flatten(button.props.style).bottom).toBe(8);
  });
});
