import { render, screen } from "@testing-library/react-native";

import type { PersonalRecord } from "@/lib/api/stats";

import { PRList } from "../pr-list";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number | string>) => {
      const translations: Record<string, string> = {
        "records.heaviest": "Heaviest",
        "records.heaviestReps": `${values?.reps ?? "{{reps}}"} reps`,
        "records.mostReps": "Most Reps",
        "records.mostRepsWeight": `@ ${values?.weight ?? "{{weight}}"}`,
        "records.bestSet": "Best Set",
        "records.est1rm": "Est. 1RM",
        "records.searchPlaceholder": "Search exercises...",
        "records.empty": "Complete workouts to see your records",
      };

      return translations[key] ?? key;
    },
  }),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: () => ({
    format: (kg: number) => `${kg}kg`,
  }),
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useLocalizedExerciseMap: (exerciseIds: string[]) => ({
    exerciseMap: new Map(
      exerciseIds.map((id) => [id, { name: "Bench Press" }])
    ),
  }),
}));

const baseRecord: PersonalRecord = {
  exercise_id: "00000000-0000-0000-0000-000000000001",
  exercise_name: "Bench Press",
  max_weight_kg: 100,
  max_weight_reps: 5,
  max_reps: 12,
  max_reps_weight_kg: 80,
  max_volume_set_kg: 960,
  est_1rm_kg: 116.7,
};

describe("PRList", () => {
  it("renders the load and reps paired with each personal record", () => {
    render(<PRList records={[baseRecord]} />);

    expect(screen.getByText("Heaviest")).toBeTruthy();
    expect(screen.getByText("5 reps")).toBeTruthy();
    expect(screen.getByText("Most Reps")).toBeTruthy();
    expect(screen.getByText("@ 80kg")).toBeTruthy();
  });

  it("omits context when the associated values are null", () => {
    render(
      <PRList
        records={[
          {
            ...baseRecord,
            max_weight_reps: null,
            max_reps_weight_kg: null,
          },
        ]}
      />
    );

    expect(screen.queryByText("5 reps")).toBeNull();
    expect(screen.queryByText("@ 80kg")).toBeNull();
  });

  it("keeps zero loads and zero reps visible in context", () => {
    render(
      <PRList
        records={[
          {
            ...baseRecord,
            max_weight_reps: 0,
            max_reps_weight_kg: 0,
          },
        ]}
      />
    );

    expect(screen.getByText("0 reps")).toBeTruthy();
    expect(screen.getByText("@ 0kg")).toBeTruthy();
  });

  it("uses localized defaults for search and an empty record list", () => {
    render(<PRList records={[]} />);

    expect(
      screen.getByText("Complete workouts to see your records")
    ).toBeTruthy();
    expect(screen.getByPlaceholderText("Search exercises...")).toBeTruthy();
    expect(screen.getByLabelText("Search exercises...")).toBeTruthy();
  });
});
