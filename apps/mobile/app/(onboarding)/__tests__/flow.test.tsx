import "@/i18n";
import { render, screen, fireEvent } from "@testing-library/react-native";
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock("@/hooks/use-theme-color", () => ({ useThemeColor: () => "#000" }));
jest.mock("@/hooks/use-profile-mutations", () => ({
  useUpsertProfile: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
  })),
}));
jest.mock("@/lib/track-event", () => ({ trackEvent: jest.fn() }));
import { router, useLocalSearchParams } from "expo-router";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useUpsertProfile } from "@/hooks/use-profile-mutations";
import GoalScreen from "../goal";
import EquipmentScreen from "../equipment";
import ExperienceScreen from "../experience";
import FrequencyScreen from "../frequency";
import ReviewScreen from "../review";
function answerRequired() {
  const store = useOnboardingStore.getState();
  store.setGoal("build_muscle");
  store.setEquipment("dumbbells");
  store.setExperience("advanced");
  store.setFrequency(1);
  store.setSessionDuration(15);
}
beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.getState().reset();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
  (useUpsertProfile as jest.Mock).mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
  });
});
it("starts at goal and offers muscle building without typing", () => {
  expect(useOnboardingStore.getState().getNextUnfinishedStep()).toBe("goal");
  render(<GoalScreen />);
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  fireEvent.press(screen.getByRole("radio", { name: "Build muscle" }));
  fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(useOnboardingStore.getState().goal).toBe("build_muscle");
  expect(router.push).toHaveBeenCalledWith("/(onboarding)/equipment");
});
it("explains invalid custom goals", () => {
  render(<GoalScreen />);
  fireEvent.changeText(
    screen.getByLabelText("Or describe your own goal"),
    "abc"
  );
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
});
it("offers barbell equipment without a full gym and continues to experience", () => {
  render(<EquipmentScreen />);
  fireEvent.press(screen.getByRole("radio", { name: /Barbell. A bar/ }));
  fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(router.push).toHaveBeenCalledWith("/(onboarding)/experience");
  expect(useOnboardingStore.getState().equipment).toBe("barbell");
});
it("goes from experience directly to schedule without a strength test", () => {
  render(<ExperienceScreen />);
  fireEvent.press(
    screen.getByRole("radio", { name: /Comfortable with the basics/ })
  );
  fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(router.push).toHaveBeenCalledWith("/(onboarding)/frequency");
});
it("requires explicit duration and permits once-weekly training", () => {
  render(<FrequencyScreen />);
  fireEvent.press(screen.getByRole("radio", { name: "1 day" }));
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  fireEvent.press(screen.getByRole("radio", { name: "15 min" }));
  fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(router.push).toHaveBeenCalledWith("/(onboarding)/review");
});
it("reviews the actual duration/style and saves optional constraints", () => {
  answerRequired();
  const mutate = jest.fn();
  (useUpsertProfile as jest.Mock).mockReturnValue({ mutate });
  render(<ReviewScreen />);
  expect(screen.getByText("1 day · 15 min per workout")).toBeTruthy();
  expect(screen.getByText("Training approach: Muscle building")).toBeTruthy();
  fireEvent.changeText(
    screen.getByLabelText(
      "Any movements or limitations to consider? (optional)"
    ),
    "Avoid jumping"
  );
  fireEvent.press(screen.getByRole("button", { name: "Create my workouts" }));
  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      goal: "build_muscle",
      sessionDuration: 15,
      frequency: 1,
      constraints: "Avoid jumping",
    })
  );
});
it("lets the user adjust the proposed style without changing their goal", () => {
  answerRequired();
  render(<ReviewScreen />);
  fireEvent.press(screen.getByRole("button", { name: "Adjust approach" }));
  fireEvent.press(screen.getByRole("radio", { name: "Strength" }));
  expect(useOnboardingStore.getState().trainingStyle).toBe("strength");
  expect(useOnboardingStore.getState().goal).toBe("build_muscle");
});
it("returns edited answers to review", () => {
  answerRequired();
  (useLocalSearchParams as jest.Mock).mockReturnValue({ editMode: "1" });
  render(<EquipmentScreen />);
  fireEvent.press(
    screen.getByRole("radio", { name: /Bodyweight. No weights/ })
  );
  fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(router.back).toHaveBeenCalled();
});
it("blocks duplicate submissions and exposes a retryable save error", () => {
  answerRequired();
  const mutate = jest.fn();
  (useUpsertProfile as jest.Mock).mockReturnValue({
    mutate,
    isPending: true,
    isError: true,
  });
  render(<ReviewScreen />);
  expect(
    screen.getByRole("button", { name: "Saving your plan…" })
  ).toBeDisabled();
  expect(screen.getByRole("alert")).toBeTruthy();
});
