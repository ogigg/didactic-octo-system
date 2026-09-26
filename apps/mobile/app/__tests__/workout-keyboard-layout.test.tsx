jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  })),
}));

jest.mock("expo-keep-awake", () => ({
  useKeepAwake: jest.fn(),
}));

jest.mock("@/hooks/use-watch-bridge", () => ({
  useWatchBridge: jest.fn(),
}));

jest.mock("@/hooks/use-workout-live-activity", () => ({
  useWorkoutLiveActivity: jest.fn(),
}));

let mockExercises: Record<string, unknown>[] = [];
let mockExerciseMap = new Map<string, unknown>();
const mockExerciseCardProps: Record<string, unknown>[] = [];

jest.mock("@/hooks/use-exercises-query", () => ({
  useLocalizedExerciseMap: jest.fn(() => ({ exerciseMap: mockExerciseMap })),
}));

jest.mock("@/stores/workout-store", () => ({
  getExerciseOccurrenceId: (exercise: { id: string; occurrenceId?: string }) =>
    exercise.occurrenceId ?? exercise.id,
  useWorkoutStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      exercises: mockExercises,
      warmup: null,
      workoutName: "Workout",
      generationMeta: null,
      finishWorkout: jest.fn(),
      clearWorkout: jest.fn(),
      reorderExercise: jest.fn(),
      updateWorkoutName: jest.fn(),
    }),
}));

jest.mock("@/components/workout/exercise-card", () => ({
  ExerciseCard: (props: Record<string, unknown>) => {
    mockExerciseCardProps.push(props);
    return null;
  },
}));

jest.mock("@/components/workout/exercise-reorder-sheet", () => ({
  ExerciseReorderSheet: () => null,
}));

jest.mock("@/components/workout/celebration/celebration-provider", () => ({
  CelebrationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock("@/components/workout/reasoning-disclosure", () => ({
  ReasoningDisclosure: () => null,
}));

jest.mock("@/components/workout/rest-timer-bar", () => ({
  RestTimerBar: () => null,
}));

jest.mock("@/components/workout/warmup-card", () => ({
  WarmupCard: () => null,
}));

jest.mock("@/components/workout/workout-timer", () => ({
  WorkoutTimer: () => null,
}));

jest.mock("@/components/workout/workout-top-bar", () => ({
  WorkoutTopBar: () => null,
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaView: ({
      children,
      style,
    }: {
      children: React.ReactNode;
      style?: unknown;
    }) => React.createElement(View, { style }, children),
  };
});

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    GestureHandlerRootView: ({
      children,
      style,
    }: {
      children: React.ReactNode;
      style?: unknown;
    }) => React.createElement(View, { style }, children),
  };
});

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  const transition = {
    damping: jest.fn(),
    stiffness: jest.fn(),
  };
  transition.damping.mockReturnValue(transition);
  transition.stiffness.mockReturnValue(transition);

  return {
    __esModule: true,
    default: { View },
    LinearTransition: {
      springify: jest.fn(() => transition),
    },
  };
});

import { render } from "@testing-library/react-native";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import WorkoutScreen from "../workout";

describe("WorkoutScreen keyboard layout", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalOS,
    });
  });

  it.each([
    ["ios", "padding", "interactive"],
    ["android", undefined, "on-drag"],
  ] as const)(
    "keeps workout inputs reachable on %s",
    (platform, avoidingBehavior, dismissMode) => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: platform,
      });

      const { UNSAFE_getByType } = render(<WorkoutScreen />);

      expect(UNSAFE_getByType(KeyboardAvoidingView)).toHaveProp(
        "behavior",
        avoidingBehavior
      );
      expect(UNSAFE_getByType(ScrollView)).toHaveProp(
        "keyboardShouldPersistTaps",
        "always"
      );
      expect(UNSAFE_getByType(ScrollView)).toHaveProp(
        "keyboardDismissMode",
        dismissMode
      );
    }
  );

  it("constrains the scroll area to the remaining keyboard space", () => {
    const { UNSAFE_getByType } = render(<WorkoutScreen />);

    expect(UNSAFE_getByType(ScrollView)).toHaveProp("style", {
      flex: 1,
    });
  });
});

describe("WorkoutScreen exercise cards", () => {
  afterEach(() => {
    mockExercises = [];
    mockExerciseMap = new Map();
    mockExerciseCardProps.length = 0;
  });

  it("passes each card its localized primary muscle", () => {
    mockExercises = [{ id: "bench-press", name: "Bench Press", sets: [] }];
    mockExerciseMap = new Map([
      [
        "bench-press",
        {
          name: "Wyciskanie na ławce",
          primary_muscles: ["chest"],
          primary_muscle_labels: ["Klatka piersiowa"],
        },
      ],
    ]);

    render(<WorkoutScreen />);

    expect(mockExerciseCardProps.at(-1)).toMatchObject({
      displayName: "Wyciskanie na ławce",
      primaryMuscle: "Klatka piersiowa",
    });
  });
});
