jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

import { render, screen } from "@testing-library/react-native";

import { ExerciseImage } from "../exercise-image";

describe("ExerciseImage", () => {
  it("renders an image when media is available", () => {
    render(
      <ExerciseImage
        exerciseName="Bench Press"
        size="thumbnail"
        image={{
          url: "https://example.com/bench.png",
          thumbnail_url: "https://example.com/bench-thumb.png",
          width: 1254,
          height: 1254,
          thumbnail_width: 192,
          thumbnail_height: 192,
          alt_text: "Bench press illustration",
          blurhash: null,
          source: "curated",
        }}
      />
    );

    expect(screen.getByLabelText("Bench press illustration")).toBeTruthy();
  });

  it("renders a stable placeholder without media", () => {
    const { toJSON } = render(
      <ExerciseImage exerciseName="Bench Press" size="thumbnail" image={null} />
    );

    expect(toJSON()).toBeTruthy();
  });
});
