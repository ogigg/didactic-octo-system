import { render, screen } from "@testing-library/react-native";
import { ThemedText } from "./themed-text";

// Mock the useThemeColor hook
jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

describe("ThemedText", () => {
  it("should render correctly with default props", () => {
    render(<ThemedText>Hello World</ThemedText>);
    expect(screen.getByText("Hello World")).toBeTruthy();
  });

  it("should render with custom text", () => {
    render(<ThemedText>Custom Text</ThemedText>);
    expect(screen.getByText("Custom Text")).toBeTruthy();
  });

  it("should render with title type", () => {
    render(<ThemedText type="title">Title Text</ThemedText>);
    expect(screen.getByText("Title Text")).toBeTruthy();
  });

  it("should render with subtitle type", () => {
    render(<ThemedText type="subtitle">Subtitle Text</ThemedText>);
    expect(screen.getByText("Subtitle Text")).toBeTruthy();
  });

  it("should render with link type", () => {
    render(<ThemedText type="link">Link Text</ThemedText>);
    expect(screen.getByText("Link Text")).toBeTruthy();
  });
});
