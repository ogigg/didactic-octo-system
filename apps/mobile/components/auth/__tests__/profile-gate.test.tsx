import "@/i18n";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ProfileGate } from "../profile-gate";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useAuthStore } from "@/stores/auth-store";

jest.mock("@/stores/auth-store", () => ({ useAuthStore: jest.fn() }));
jest.mock("@/hooks/use-theme-color", () => ({ useThemeColor: () => "#777" }));
jest.mock("@/components/ambient-glow", () => ({ AmbientGlow: () => null }));

const retryProfile = jest.fn();
const signOut = jest.fn();

function setStatus(profileStatus: string, userId = "user-a") {
  (useAuthStore as unknown as jest.Mock).mockImplementation((select) =>
    select({
      profileStatus,
      retryProfile,
      signOut,
      session: { user: { id: userId } },
    })
  );
}

beforeEach(() => jest.clearAllMocks());

it("shows a decorative skeleton while loading and replaces it with recovery actions on error", () => {
  setStatus("loading");
  const view = render(<ProfileGate />);
  expect(screen.getByText("A moment before you begin")).toBeTruthy();
  expect(
    screen.getByTestId("profile-skeleton", { includeHiddenElements: true })
      .props.importantForAccessibility
  ).toBe("no-hide-descendants");
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

  setStatus("error");
  view.rerender(<ProfileGate />);
  expect(
    screen.queryByTestId("profile-skeleton", { includeHiddenElements: true })
  ).toBeNull();
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(retryProfile).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
  expect(signOut).toHaveBeenCalledTimes(1);
});

it("uses only the current account's completion state for the skeleton", () => {
  setStatus("loading");
  useOnboardingStore.setState({ ownerUserId: "user-b", isCompleted: true });
  render(<ProfileGate />);
  expect(
    screen.getByTestId("onboarding-skeleton", { includeHiddenElements: true })
  ).toBeTruthy();
  act(() =>
    useOnboardingStore.setState({ ownerUserId: "user-a", isCompleted: true })
  );
  expect(
    screen.getByTestId("home-skeleton", { includeHiddenElements: true })
  ).toBeTruthy();
});

it("offers retry after eight seconds and resets the wait message on retry", () => {
  jest.useFakeTimers();
  setStatus("loading");
  const view = render(<ProfileGate />);
  act(() => jest.advanceTimersByTime(7999));
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  act(() => jest.advanceTimersByTime(1));
  fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(retryProfile).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  view.unmount();
  jest.useRealTimers();
});
