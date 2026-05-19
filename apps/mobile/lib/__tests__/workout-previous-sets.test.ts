import {
  convertPreviousDisplay,
  formatPreviousDurationSet,
  formatPreviousWeightSet,
  parsePreviousWeightDisplay,
} from "@/lib/workout-previous-sets";

describe("workout previous set helpers", () => {
  it("formats previous weight sets in the selected unit", () => {
    expect(formatPreviousWeightSet(80, 8, "kg")).toBe("80×8");
    expect(formatPreviousWeightSet(100, 5, "lbs")).toBe("220.5×5");
  });

  it("formats previous duration sets", () => {
    expect(formatPreviousDurationSet(45)).toBe("45s");
    expect(formatPreviousDurationSet(120)).toBe("2m");
    expect(formatPreviousDurationSet(135)).toBe("2m 15s");
  });

  it("converts kg previous displays to pounds", () => {
    expect(convertPreviousDisplay("80×8", "lbs")).toBe("176.4×8");
    expect(convertPreviousDisplay("80 kg x 8", "lbs")).toBe("176.4x8");
  });

  it("parses previous weight displays that users can tap to fill", () => {
    expect(parsePreviousWeightDisplay("80×8")).toEqual({
      load: "80",
      reps: "8",
    });
    expect(parsePreviousWeightDisplay("80 kg x 8")).toEqual({
      load: "80",
      reps: "8",
    });
    expect(parsePreviousWeightDisplay("176.4lbs×5")).toEqual({
      load: "176.4",
      reps: "5",
    });
  });
});
