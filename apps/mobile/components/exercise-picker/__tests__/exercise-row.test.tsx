jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/components/exercise/exercise-image", () => ({
  ExerciseImage: () => null,
}));

jest.mock("@/components/ui/icon-symbol", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    IconSymbol: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";

import type { Exercise } from "@/lib/api/exercises";
import { ExerciseRow } from "../exercise-row";

const benchPress: Exercise = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Bench Press",
  external_id: "ext-1",
  exercise_type: "weight",
  primary_muscles: ["chest"],
  primary_muscle_labels: ["Chest"],
  secondary_muscles: ["triceps"],
  secondary_muscle_labels: ["Triceps"],
  equipment: ["barbell"],
  equipment_labels: ["Barbell"],
  difficulty_level: "intermediate",
  difficulty_label: "Intermediate",
  instructions: "Press the bar up",
  image: null,
  image_url: null,
  video_url: null,
};

describe("ExerciseRow", () => {
  it("makes favorite state visible and available to assistive tech", () => {
    render(
      <ExerciseRow exercise={benchPress} onSelect={jest.fn()} isFavorite />
    );

    expect(
      screen.getByRole("button", { name: "Bench Press, Chest, row.favorite" })
    ).toBeTruthy();
    expect(screen.getByText("heart.fill")).toBeTruthy();
  });

  it("does not present a favorite state for other exercises", () => {
    render(<ExerciseRow exercise={benchPress} onSelect={jest.fn()} />);

    expect(
      screen.getByRole("button", { name: "Bench Press, Chest" })
    ).toBeTruthy();
    expect(screen.queryByText("heart.fill")).toBeNull();
  });

  it("selects the exercise when pressed", () => {
    const onSelect = jest.fn();
    render(<ExerciseRow exercise={benchPress} onSelect={onSelect} />);

    fireEvent.press(screen.getByRole("button", { name: "Bench Press, Chest" }));

    expect(onSelect).toHaveBeenCalledWith(benchPress);
  });
});
