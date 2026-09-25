jest.mock("@/components/animated-splash", () => {
  const { Text } = jest.requireActual("react-native");

  return {
    AnimatedSplash: () => <Text>animated splash</Text>,
  };
});

import { act, render, screen } from "@testing-library/react-native";

import { useThemePreferenceStore } from "@/stores/theme-preference-store";

import { ThemeReadySplash } from "./theme-ready-splash";

describe("ThemeReadySplash", () => {
  beforeEach(() => {
    useThemePreferenceStore.setState({ hasHydrated: false });
  });

  it("keeps the native splash up until the saved theme has loaded", () => {
    render(<ThemeReadySplash appReady onFinish={jest.fn()} />);

    // The animated splash hides the native one, so it must not mount yet.
    expect(screen.queryByText("animated splash")).toBeNull();

    act(() => useThemePreferenceStore.setState({ hasHydrated: true }));

    expect(screen.getByText("animated splash")).toBeTruthy();
  });
});
