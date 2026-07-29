jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: jest.fn(),
}));
jest.mock("@/hooks/use-profile-mutations", () => ({
  useUpsertProfile: jest.fn(() => ({
    mutate: jest.fn((_payload, options) => options?.onSuccess?.()),
  })),
}));
jest.mock("@/lib/track-event", () => ({ trackEvent: jest.fn() }));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useFocusEffect: jest.fn((cb) => cb()),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "expo-router";
import { trackEvent } from "@/lib/track-event";
import { useOnboardingStore } from "@/stores/onboarding-store";
import ReviewScreen from "../review";

const mockComplete = jest.fn();

const fullStore = {
  gender: "male" as const,
  genderSkipped: false,
  goal: "build_strength" as const,
  customGoal: null,
  frequency: 4 as const,
  equipment: "full_gym" as const,
  experience: "intermediate" as const,
  strengthBaselines: [] as Array<{
    exercise_key: string;
    load_kg: number | null;
    reps: number;
  }>,
  complete: mockComplete,
};

beforeEach(() => {
  jest.clearAllMocks();
  (useOnboardingStore as unknown as jest.Mock).mockReturnValue(fullStore);
});

function renderReviewScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ReviewScreen />
    </QueryClientProvider>
  );
}

describe("ReviewScreen", () => {
  it("displays all answered values", () => {
    renderReviewScreen();
    expect(screen.getByText("Male")).toBeTruthy();
    expect(screen.getByText("Build Strength")).toBeTruthy();
    expect(screen.getByText("4 days per week")).toBeTruthy();
  });

  it("does not show gender card when gender is null and not skipped", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      ...fullStore,
      gender: null,
      genderSkipped: false,
    });
    renderReviewScreen();
    expect(screen.queryByText(/gender/i)).toBeNull();
  });

  it("does not show gender card when explicitly skipped", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      ...fullStore,
      gender: null,
      genderSkipped: true,
    });
    renderReviewScreen();
    expect(screen.queryByText(/GENDER/i)).toBeNull();
  });

  it("shows custom goal text when set", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      ...fullStore,
      goal: null,
      customGoal: "do a muscle-up",
    });
    renderReviewScreen();
    expect(screen.getByText("do a muscle-up")).toBeTruthy();
  });

  it("tapping Edit on gender navigates to gender with editMode", () => {
    renderReviewScreen();
    const editBtns = screen.getAllByText("Edit");
    fireEvent.press(editBtns[0]); // first Edit is for gender
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(onboarding)/gender",
      params: { editMode: "1" },
    });
  });

  it("tapping submit calls complete and fires analytics", () => {
    renderReviewScreen();
    fireEvent.press(screen.getByRole("button", { name: /start working out/i }));
    expect(mockComplete).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("onboarding_completed", {
      occurrence_id: expect.stringMatching(/^onboarding_completed:/),
    });
  });

  it("tapping submit navigates to tabs", () => {
    renderReviewScreen();
    fireEvent.press(screen.getByRole("button", { name: /start working out/i }));
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });
});
