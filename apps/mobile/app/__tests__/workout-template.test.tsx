const mockRouterReplace = jest.fn();
const mockStartWorkout = jest.fn();

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

jest.mock("@/stores/workout-templates-store", () => ({
  useWorkoutTemplatesStore: jest.fn(
    (
      selector: (state: {
        templates: {
          id: string;
          name: string;
          createdAt: number;
          exercises: { id: string; name: string }[];
        }[];
      }) => unknown
    ) =>
      selector({
        templates: [
          {
            id: "template-1",
            name: "Push day",
            createdAt: 1,
            exercises: [{ id: "bench-press", name: "Bench Press" }],
          },
        ],
      })
  ),
}));

jest.mock("@/stores/workout-store", () => ({
  useWorkoutStore: jest.fn(
    (
      selector: (state: {
        isActive: boolean;
        startWorkout: typeof mockStartWorkout;
      }) => unknown
    ) =>
      selector({
        isActive: false,
        startWorkout: mockStartWorkout,
      })
  ),
}));

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

import { fireEvent, render, screen } from "@testing-library/react-native";

import WorkoutTemplateScreen from "../workout-template";

describe("WorkoutTemplateScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reviews a saved template without starting it automatically", () => {
    render(<WorkoutTemplateScreen />);

    expect(screen.getByText("templateDetail.modeLabel")).toBeTruthy();
    expect(screen.getByText("Push day")).toBeTruthy();
    expect(screen.getByText("Localized Bench Press")).toBeTruthy();
    expect(mockStartWorkout).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("starts the template only after the explicit start action", () => {
    render(<WorkoutTemplateScreen />);

    fireEvent.press(
      screen.getByRole("button", {
        name: "templateDetail.startWorkout",
      })
    );

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
    expect(mockRouterReplace).toHaveBeenCalledWith("/workout");
  });
});
