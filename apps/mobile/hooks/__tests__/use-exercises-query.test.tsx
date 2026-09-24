const mockFetchExerciseFilterOptions = jest.fn();
const mockFetchExercises = jest.fn();

jest.mock("@/lib/api/exercises", () => ({
  fetchCatalogLabels: jest.fn(),
  fetchExercise: jest.fn(),
  fetchExerciseFilterOptions: (...args: unknown[]) =>
    mockFetchExerciseFilterOptions(...args),
  fetchExercises: (...args: unknown[]) => mockFetchExercises(...args),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: "en", language: "en" },
  }),
}));

jest.mock("@/i18n", () => ({
  normalizeLanguage: (language?: string) => language ?? "en",
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useExerciseFilterOptions } from "@/hooks/use-exercises-query";
import type { Exercise } from "@/lib/api/exercises";

const benchPress: Exercise = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Bench Press",
  external_id: "bench-press",
  exercise_type: "weight",
  primary_muscles: ["chest"],
  primary_muscle_labels: ["Chest"],
  secondary_muscles: ["triceps"],
  secondary_muscle_labels: ["Triceps"],
  equipment: ["barbell"],
  equipment_labels: ["Barbell"],
  difficulty_level: "intermediate",
  difficulty_label: "Intermediate",
  instructions: null,
  image: null,
  image_url: null,
  video_url: null,
};

const activeQueryClients: QueryClient[] = [];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
    },
  });
  activeQueryClients.push(queryClient);

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useExerciseFilterOptions", () => {
  afterEach(() => {
    activeQueryClients.splice(0).forEach((client) => client.clear());
    jest.clearAllMocks();
  });

  it("uses localized options from the dedicated RPC", async () => {
    mockFetchExerciseFilterOptions.mockResolvedValue([
      {
        label_type: "muscle",
        label_key: "chest",
        display_name: "Chest",
      },
    ]);

    const { result } = renderHook(() => useExerciseFilterOptions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.filterOptions.muscles).toEqual(["chest"]);
    expect(mockFetchExercises).not.toHaveBeenCalled();
  });

  it.each(["failure", "empty"])(
    "derives selectable options from active exercises after an RPC %s",
    async (scenario) => {
      if (scenario === "failure") {
        mockFetchExerciseFilterOptions.mockRejectedValue(new Error("missing"));
      } else {
        mockFetchExerciseFilterOptions.mockResolvedValue([]);
      }
      mockFetchExercises.mockResolvedValue([benchPress]);

      const { result } = renderHook(() => useExerciseFilterOptions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetchExercises).toHaveBeenCalledWith(undefined, "en");
      expect(result.current.filterOptions).toEqual({
        muscles: ["chest"],
        equipment: ["barbell"],
      });
      expect(result.current.labelMaps.muscle.get("chest")).toBe("Chest");
      expect(result.current.filterOptions.muscles).not.toContain("triceps");
    }
  );

  it("exposes an error when the RPC and fallback both fail", async () => {
    mockFetchExerciseFilterOptions.mockRejectedValue(new Error("missing"));
    mockFetchExercises.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useExerciseFilterOptions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.filterOptions).toEqual({
      muscles: [],
      equipment: [],
    });
  });
});
