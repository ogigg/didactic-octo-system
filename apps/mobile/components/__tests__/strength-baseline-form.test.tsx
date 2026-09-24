import "@/i18n";
import { render, screen, fireEvent } from "@testing-library/react-native";
jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: () => ({
    unit: "lbs",
    label: "lbs",
    convert: (kg: number) => kg / 0.45359237,
    toKg: (lb: number) => lb * 0.45359237,
  }),
}));
jest.mock("@/hooks/use-theme-color", () => ({ useThemeColor: () => "#000" }));
import { StrengthBaselineForm } from "../strength-baseline-form";
import { strengthBaselinesSchema } from "@/lib/schemas/strength-baseline";
it("stores pounds as kilograms and keeps fractional input", () => {
  const change = jest.fn();
  render(
    <StrengthBaselineForm
      equipment="dumbbells"
      experience="beginner"
      baselines={[]}
      onChange={change}
    />
  );
  fireEvent.changeText(
    screen.getByLabelText("Dumbbell bench press weight in lbs"),
    "22.5"
  );
  fireEvent.changeText(
    screen.getByLabelText("Dumbbell bench press repetitions"),
    "8"
  );
  expect(change).toHaveBeenLastCalledWith([
    { exercise_key: "db_bench", load_kg: 22.5 * 0.45359237, reps: 8 },
  ]);
  expect(screen.getByDisplayValue("22.5")).toBeTruthy();
});
it("accepts zero bodyweight reps and marks a missing weighted pair invalid", () => {
  const change = jest.fn();
  const validity = jest.fn();
  render(
    <StrengthBaselineForm
      equipment="dumbbells"
      experience="beginner"
      baselines={[]}
      onChange={change}
      onValidityChange={validity}
    />
  );
  fireEvent.changeText(screen.getByLabelText("Push-ups repetitions"), "0");
  expect(change).toHaveBeenLastCalledWith([
    { exercise_key: "pushups", load_kg: null, reps: 0 },
  ]);
  fireEvent.changeText(
    screen.getByLabelText("Dumbbell bench press weight in lbs"),
    "20"
  );
  expect(validity).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole("alert")).toBeTruthy();
});
it("rejects partial, duplicate and fractional-rep data at the API boundary", () => {
  expect(
    strengthBaselinesSchema.safeParse([
      { exercise_key: "db_row", load_kg: 10, reps: 0 },
    ]).success
  ).toBe(false);
  expect(
    strengthBaselinesSchema.safeParse([
      { exercise_key: "pushups", load_kg: null, reps: 1.5 },
    ]).success
  ).toBe(false);
  expect(
    strengthBaselinesSchema.safeParse([
      { exercise_key: "pushups", load_kg: null, reps: 0 },
    ]).success
  ).toBe(true);
});
