jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

const mockBack = jest.fn();
const mockSetOptions = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: mockBack },
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: mockBack,
  })),
  useNavigation: jest.fn(() => ({
    setOptions: mockSetOptions,
    addListener: mockAddListener,
  })),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Warning: "warning", Error: "error" },
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => children,
}));

const mockScheduleAccountDeletion = jest.fn();
jest.mock("@/lib/api/delete-account", () => ({
  scheduleAccountDeletion: (...args: unknown[]) =>
    mockScheduleAccountDeletion(...args),
}));

const mockSignOut = jest.fn();
jest.mock("@/stores/auth-store", () => ({
  useAuthStore: (
    selector: (state: { signOut: () => Promise<void> }) => unknown
  ) => selector({ signOut: mockSignOut }),
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";

import DeleteAccountScreen from "../delete-account";

const alertSpy = jest.spyOn(Alert, "alert");

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DeleteAccountScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockScheduleAccountDeletion.mockResolvedValue({
    scheduled_at: "2026-05-05T00:00:00.000Z",
    grace_days: 14,
    apple_revoked: null,
  });
});

describe("DeleteAccountScreen", () => {
  it("renders without crashing", () => {
    renderScreen();
    expect(screen.getByText("cta.delete")).toBeTruthy();
  });

  it("keeps the destructive CTA disabled until the user types DELETE", () => {
    renderScreen();
    const cta = screen.getByRole("button", {
      name: "cta.accessibilityLabel",
    });
    expect(cta.props.accessibilityState?.disabled).toBe(true);

    const input = screen.getByLabelText("confirm.ariaLabel");
    fireEvent.changeText(input, "delet");
    expect(cta.props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(input, "delete"); // case-insensitive match
    expect(cta.props.accessibilityState?.disabled).toBe(false);
  });

  it("fires the warning haptic on press and asks for final confirmation", () => {
    renderScreen();
    const input = screen.getByLabelText("confirm.ariaLabel");
    fireEvent.changeText(input, "DELETE");

    fireEvent.press(
      screen.getByRole("button", { name: "cta.accessibilityLabel" })
    );

    expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning");
    expect(alertSpy).toHaveBeenCalledWith(
      "finalConfirm.title",
      "finalConfirm.message",
      expect.any(Array)
    );
  });

  it("does not call the API unless the final confirmation is accepted", () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText("confirm.ariaLabel"), "DELETE");
    fireEvent.press(
      screen.getByRole("button", { name: "cta.accessibilityLabel" })
    );

    expect(mockScheduleAccountDeletion).not.toHaveBeenCalled();
  });

  it("calls scheduleAccountDeletion when the final confirmation is accepted", async () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText("confirm.ariaLabel"), "DELETE");
    fireEvent.press(
      screen.getByRole("button", { name: "cta.accessibilityLabel" })
    );

    // The final-confirm Alert.alert call receives an array of buttons; grab the
    // destructive one and invoke its onPress as if the user tapped it.
    const lastCall = alertSpy.mock.calls.at(-1);
    const buttons = lastCall?.[2] as { style?: string; onPress?: () => void }[];
    const confirmButton = buttons?.find((b) => b.style === "destructive");
    await act(async () => {
      confirmButton?.onPress?.();
    });

    await waitFor(() =>
      expect(mockScheduleAccountDeletion).toHaveBeenCalledTimes(1)
    );
  });

  it("locks navigation (gestureEnabled=false) while the mutation is in flight", async () => {
    let resolveSchedule: ((v: unknown) => void) | null = null;
    mockScheduleAccountDeletion.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSchedule = resolve;
        })
    );

    renderScreen();
    fireEvent.changeText(screen.getByLabelText("confirm.ariaLabel"), "DELETE");
    fireEvent.press(
      screen.getByRole("button", { name: "cta.accessibilityLabel" })
    );

    const lastCall = alertSpy.mock.calls.at(-1);
    const buttons = lastCall?.[2] as { style?: string; onPress?: () => void }[];
    const confirmButton = buttons?.find((b) => b.style === "destructive");
    await act(async () => {
      confirmButton?.onPress?.();
    });

    await waitFor(() => {
      expect(mockSetOptions).toHaveBeenCalledWith({ gestureEnabled: false });
    });

    // Resolve the mutation so React Query can settle before the test exits.
    await act(async () => {
      resolveSchedule?.({
        scheduled_at: "2026-05-05T00:00:00.000Z",
        grace_days: 14,
        apple_revoked: null,
      });
    });
  });
});
