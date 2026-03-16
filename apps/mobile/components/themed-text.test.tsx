import { render, screen } from "@testing-library/react-native";
import { ThemedText } from "./themed-text";

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

const textTypes = [
  "body",
  "bodyMedium",
  "displayLg",
  "displaySm",
  "titleLg",
  "titleMd",
  "titleSm",
  "caption",
  "label",
  "micro",
] as const;

describe("ThemedText", () => {
  it("should render correctly with default props", () => {
    render(<ThemedText>Hello World</ThemedText>);
    expect(screen.getByText("Hello World")).toBeTruthy();
  });

  for (const type of textTypes) {
    it(`should render with ${type} type`, () => {
      render(<ThemedText type={type}>{type} text</ThemedText>);
      expect(screen.getByText(`${type} text`)).toBeTruthy();
    });
  }
});
