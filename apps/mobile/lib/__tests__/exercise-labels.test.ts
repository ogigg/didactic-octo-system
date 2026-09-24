import { getPrimaryMuscleLabel } from "../exercise-labels";

describe("getPrimaryMuscleLabel", () => {
  it("prefers the localized label over the raw muscle key", () => {
    expect(
      getPrimaryMuscleLabel({
        primary_muscles: ["Pectoralis major"],
        primary_muscle_labels: ["Klatka piersiowa"],
      })
    ).toBe("Klatka piersiowa");
  });

  it("falls back to the raw key when the label is missing or blank", () => {
    expect(
      getPrimaryMuscleLabel({
        primary_muscles: ["Pectoralis major"],
        primary_muscle_labels: [],
      })
    ).toBe("Pectoralis major");
    expect(
      getPrimaryMuscleLabel({
        primary_muscles: ["Pectoralis major"],
        primary_muscle_labels: [""],
      })
    ).toBe("Pectoralis major");
  });

  it("returns null without any muscle", () => {
    expect(
      getPrimaryMuscleLabel({ primary_muscles: [], primary_muscle_labels: [] })
    ).toBeNull();
    expect(getPrimaryMuscleLabel(undefined)).toBeNull();
  });
});
