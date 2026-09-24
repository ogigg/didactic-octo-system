jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

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

  function showKeyboard() {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    act(() => {
      listeners.get(showEvent)?.();
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
    expect(flattened.position).toBeUndefined();
    expect(flattened.bottom).toBeUndefined();
    expect(flattened.zIndex).toBeUndefined();
    expect(flattened.width).toBeGreaterThanOrEqual(44);
    expect(flattened.height).toBeGreaterThanOrEqual(44);

    const toolbarStyle = StyleSheet.flatten(
      screen.getByTestId("keyboard-dismiss-toolbar").props.style
    );
    expect(toolbarStyle.height).toBeGreaterThanOrEqual(
      flattened.height + button.props.hitSlop * 2
    );
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

    showKeyboard();
    const button = screen.getByRole("button", { name: "keyboard.dismiss" });
    expect(button).toBeTruthy();
    expect(StyleSheet.flatten(button.props.style).position).toBeUndefined();
  });

  it.each(["ios", "android"] as const)(
    "keeps a boundary input tappable beside the in-flow control on %s",
    (platform) => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: platform,
      });
      const handleBoundaryPress = jest.fn();

      render(
        <View style={{ height: 120 }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={platform === "ios" ? "padding" : "height"}
          >
            <ScrollView keyboardShouldPersistTaps="always">
              <TextInput
                accessibilityLabel="Boundary notes"
                onPressIn={handleBoundaryPress}
              />
            </ScrollView>
            <KeyboardDismissButton />
          </KeyboardAvoidingView>
        </View>
      );
      showKeyboard();

      const input = screen.getByLabelText("Boundary notes");
      const button = screen.getByRole("button", { name: "keyboard.dismiss" });
      const toolbar = screen.getByTestId("keyboard-dismiss-toolbar");

      fireEvent(input, "pressIn");

      expect(handleBoundaryPress).toHaveBeenCalledTimes(1);
      expect(Keyboard.dismiss).not.toHaveBeenCalled();

      const buttonStyle = StyleSheet.flatten(button.props.style);
      const toolbarStyle = StyleSheet.flatten(toolbar.props.style);
      expect(buttonStyle.position).toBeUndefined();
      expect(toolbarStyle.height).toBeGreaterThanOrEqual(
        buttonStyle.height + button.props.hitSlop * 2
      );

      fireEvent.press(button);
      expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    }
  );
});
