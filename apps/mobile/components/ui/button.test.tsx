jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { Button } from "./button";

describe("Button", () => {
  it("renders the label", () => {
    render(<Button label="Continue" onPress={() => {}} />);
    expect(screen.getByText("Continue")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<Button label="Continue" onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const onPress = jest.fn();
    render(<Button label="Continue" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("is marked as disabled in accessibility state when disabled", () => {
    render(<Button label="Continue" onPress={() => {}} disabled />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("uses a custom accessibilityLabel when provided", () => {
    render(
      <Button
        label="Continue"
        onPress={() => {}}
        accessibilityLabel="Continue to goal selection"
      />
    );
    expect(
      screen.getByRole("button", { name: "Continue to goal selection" })
    ).toBeTruthy();
  });

  it("renders ghost variant without throwing", () => {
    render(
      <Button label="Skip this step" onPress={() => {}} variant="ghost" />
    );
    expect(screen.getByText("Skip this step")).toBeTruthy();
  });

  it("renders secondary variant without throwing", () => {
    render(<Button label="Cancel" onPress={() => {}} variant="secondary" />);
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("renders destructive variant without throwing", () => {
    render(<Button label="Delete" onPress={() => {}} variant="destructive" />);
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("marks a loading action as busy and prevents duplicate presses", () => {
    const onPress = jest.fn();
    render(<Button label="Deleting" onPress={onPress} loading />);

    const button = screen.getByRole("button", { name: "Deleting" });
    expect(button.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });

    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
