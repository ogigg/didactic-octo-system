const mockRouterReplace = jest.fn();
const mockStartWorkout = jest.fn();

interface MockTemplateState {
  templates: {
    id: string;
    name: string;
    createdAt: number;
    exercises: { id: string; name: string }[];
  }[];
}

interface MockWorkoutState {
  isActive: boolean;
  startWorkout: typeof mockStartWorkout;
}

const savedTemplate = {
  id: "template-1",
  name: "Push day",
  createdAt: 1,
  exercises: [{ id: "bench-press", name: "Bench Press" }],
};

let mockTemplateState: MockTemplateState = { templates: [savedTemplate] };
let mockWorkoutState: MockWorkoutState = {
  isActive: false,
  startWorkout: mockStartWorkout,
};
let mockTemplatesHydrated = true;
let mockWorkoutHydrated = true;
const mockTemplateHydrateListeners = new Set<() => void>();
const mockTemplateFinishListeners = new Set<() => void>();
const mockWorkoutHydrateListeners = new Set<() => void>();
const mockWorkoutFinishListeners = new Set<() => void>();

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({ id: "template-1" })),
  useRouter: jest.fn(() => ({
    replace: mockRouterReplace,
  })),
}));

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string) => key,
  })),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useLocalizedExerciseMap: jest.fn(() => ({
    exerciseMap: new Map([["bench-press", { name: "Localized Bench Press" }]]),
  })),
}));

jest.mock("@/stores/workout-templates-store", () => {
  const useWorkoutTemplatesStore = Object.assign(
    jest.fn((selector: (state: MockTemplateState) => unknown) =>
      selector(mockTemplateState)
    ),
    {
      persist: {
        hasHydrated: () => mockTemplatesHydrated,
        onHydrate: (callback: () => void) => {
          mockTemplateHydrateListeners.add(callback);
          return () => mockTemplateHydrateListeners.delete(callback);
        },
        onFinishHydration: (callback: () => void) => {
          mockTemplateFinishListeners.add(callback);
          return () => mockTemplateFinishListeners.delete(callback);
        },
      },
    }
  );

  return { useWorkoutTemplatesStore };
});

jest.mock("@/stores/workout-store", () => {
  const useWorkoutStore = Object.assign(
    jest.fn((selector: (state: MockWorkoutState) => unknown) =>
      selector(mockWorkoutState)
    ),
    {
      getState: () => mockWorkoutState,
      persist: {
        hasHydrated: () => mockWorkoutHydrated,
        onHydrate: (callback: () => void) => {
          mockWorkoutHydrateListeners.add(callback);
          return () => mockWorkoutHydrateListeners.delete(callback);
        },
        onFinishHydration: (callback: () => void) => {
          mockWorkoutFinishListeners.add(callback);
          return () => mockWorkoutFinishListeners.delete(callback);
        },
      },
    }
  );

  return { useWorkoutStore };
});

jest.mock("@/components/ambient-glow", () => ({
  AmbientGlow: () => null,
}));

jest.mock("@/components/ui/back-button", () => ({
  BackButton: () => null,
}));

jest.mock("@/components/ui/gradient-surface", () => {
  const { View } = jest.requireActual("react-native");
  return {
    GradientSurface: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";

import WorkoutTemplateScreen from "../workout-template";

describe("WorkoutTemplateScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTemplateState = { templates: [savedTemplate] };
    mockWorkoutState = {
      isActive: false,
      startWorkout: mockStartWorkout,
    };
    mockTemplatesHydrated = true;
    mockWorkoutHydrated = true;
    mockTemplateHydrateListeners.clear();
    mockTemplateFinishListeners.clear();
    mockWorkoutHydrateListeners.clear();
    mockWorkoutFinishListeners.clear();
  });

  it("reviews a saved template without starting it automatically", () => {
    render(<WorkoutTemplateScreen />);

    expect(screen.getByText("templateDetail.modeLabel")).toBeTruthy();
    expect(screen.getByText("Push day")).toBeTruthy();
    expect(screen.getByText("Localized Bench Press")).toBeTruthy();
    expect(mockStartWorkout).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("waits for both stores to hydrate and preserves an active session", () => {
    mockTemplateState = { templates: [] };
    mockWorkoutState = {
      isActive: false,
      startWorkout: mockStartWorkout,
    };
    mockTemplatesHydrated = false;
    mockWorkoutHydrated = false;

    render(<WorkoutTemplateScreen />);

    expect(screen.getByLabelText("templateDetail.loading")).toBeOnTheScreen();
    expect(screen.queryByText("templateDetail.notFoundTitle")).toBeNull();

    act(() => {
      mockTemplateState = { templates: [savedTemplate] };
      mockTemplatesHydrated = true;
      mockTemplateFinishListeners.forEach((listener) => listener());
    });

    expect(screen.getByLabelText("templateDetail.loading")).toBeOnTheScreen();
    expect(screen.queryByText("templateDetail.notFoundTitle")).toBeNull();

    act(() => {
      mockWorkoutState = {
        isActive: true,
        startWorkout: mockStartWorkout,
      };
      mockWorkoutHydrated = true;
      mockWorkoutFinishListeners.forEach((listener) => listener());
    });

    expect(screen.getByText("Push day")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "templateDetail.startWorkout" })
    ).toBeDisabled();

    fireEvent.press(
      screen.getByRole("button", { name: "templateDetail.startWorkout" })
    );

    expect(mockStartWorkout).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("starts the template only once after the explicit start action", () => {
    render(<WorkoutTemplateScreen />);

    const startButton = screen.getByRole("button", {
      name: "templateDetail.startWorkout",
    });
    fireEvent.press(startButton);
    fireEvent.press(startButton);

    expect(mockStartWorkout).toHaveBeenCalledTimes(1);
    expect(mockStartWorkout).toHaveBeenCalledWith(
      "Push day",
      expect.arrayContaining([
        expect.objectContaining({
          id: "bench-press",
          name: "Localized Bench Press",
          sets: expect.arrayContaining([
            expect.objectContaining({
              isCompleted: false,
              type: "working",
            }),
          ]),
        }),
      ])
    );
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith("/workout");
  });
});
