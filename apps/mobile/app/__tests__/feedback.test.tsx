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
jest.mock("@/lib/track-event", () => ({ trackEvent: jest.fn() }));

import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sendFeedback } from "@/lib/api/feedback";
import { trackEvent } from "@/lib/track-event";
import { Alert } from "react-native";
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

  it("tracks only metadata after feedback succeeds", async () => {
    (sendFeedback as jest.Mock).mockResolvedValue(undefined);
    renderWithProviders(<FeedbackScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("title.placeholder"),
      "Button is hard to find"
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("description.placeholder"),
      "The primary action is not obvious."
    );
    fireEvent.press(screen.getByRole("button", { name: "submit.button" }));

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith("product_feedback_submitted", {
        feedback_type: "bug_report",
        has_title: true,
        description_length_bucket: "short",
      });
    });

    const [, payload] = (trackEvent as jest.Mock).mock.calls.find(
      ([name]) => name === "product_feedback_submitted"
    );
    expect(payload).not.toHaveProperty("title");
    expect(payload).not.toHaveProperty("description");
  });

  it("tracks a normalized error code when feedback fails", async () => {
    (sendFeedback as jest.Mock).mockRejectedValue(new Error("network timeout"));
    renderWithProviders(<FeedbackScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("title.placeholder"),
      "Button is hard to find"
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("description.placeholder"),
      "The primary action is not obvious."
    );
    fireEvent.press(screen.getByRole("button", { name: "submit.button" }));

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith("product_feedback_failed", {
        feedback_type: "bug_report",
        error_code: "network",
      });
    });
  });
});
