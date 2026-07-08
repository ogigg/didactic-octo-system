import "@/i18n";

import { render, screen } from "@testing-library/react-native";

import { WorkoutShareStory } from "@/components/workout/workout-share-story";

describe("WorkoutShareStory", () => {
  it("renders key workout metrics and exercise highlights", () => {
    render(
      <WorkoutShareStory
        workoutName="Push day"
        dateLabel="Jul 7, 2026"
        durationLabel="54m"
        volumeLabel="4.2t"
        setsLabel="12/15"
        completionLabel="80%"
        streakLabel="3"
        highlights={[
          {
            id: "bench",
            name: "Bench Press",
            completedSets: 3,
            totalSets: 4,
            metric: "80kg x 8",
          },
        ]}
      />
    );

    expect(screen.getByTestId("workout-share-story")).toBeTruthy();
    expect(screen.getByText("Push day")).toBeTruthy();
    expect(screen.getByText("4.2t")).toBeTruthy();
    expect(screen.getByText("12/15")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
    expect(screen.getByText("Bench Press")).toBeTruthy();
    expect(screen.getByText("Best: 80kg x 8")).toBeTruthy();
  });

  it("renders the empty highlight fallback", () => {
    render(
      <WorkoutShareStory
        workoutName="Mobility"
        dateLabel="Jul 7, 2026"
        durationLabel="20m"
        volumeLabel="Bodyweight"
        setsLabel="0/0"
        completionLabel="0%"
        streakLabel={null}
        highlights={[]}
      />
    );

    expect(
      screen.getByText("Logged and saved to your training history.")
    ).toBeTruthy();
  });
});
