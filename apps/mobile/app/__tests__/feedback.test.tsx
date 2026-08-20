jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock("@/lib/api/feedback", () => ({
  sendFeedback: jest.fn(),
}));

import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sendFeedback } from "@/lib/api/feedback";
import { Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import FeedbackScreen from "../feedback";

const mockAlert = jest.spyOn(Alert, "alert").mockImplementation(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false,
    },
  },
});

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
});

describe("FeedbackScreen", () => {
  it("renders without crashing", () => {
    renderWithProviders(<FeedbackScreen />);
  });

  it("renders type selector with bug report pre-selected", () => {
    renderWithProviders(<FeedbackScreen />);
    const bugReportOption = screen.getByRole("radio", { name: "type.bug" });
    expect(bugReportOption).toBeTruthy();
    expect(bugReportOption.props.accessibilityState.checked).toBe(true);
  });

  it("renders feature request option", () => {
    renderWithProviders(<FeedbackScreen />);
    const featureOption = screen.getByRole("radio", { name: "type.feature" });
    expect(featureOption).toBeTruthy();
    expect(featureOption.props.accessibilityState.checked).toBe(false);
  });

  it("allows switching between bug report and feature request", () => {
    renderWithProviders(<FeedbackScreen />);
    const featureOption = screen.getByRole("radio", { name: "type.feature" });
    fireEvent.press(featureOption);
    expect(featureOption.props.accessibilityState.checked).toBe(true);
  });

  it("renders text inputs for title and description", () => {
    renderWithProviders(<FeedbackScreen />);
    const inputs = screen.getAllByRole("text");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("prefills the recovery support reference from the queue", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      recoveryReference: "GEN-ABC12345",
    });

    renderWithProviders(<FeedbackScreen />);

    expect(screen.getByDisplayValue("recovery.title")).toBeTruthy();
    expect(screen.getByDisplayValue("recovery.description")).toBeTruthy();
  });
});
