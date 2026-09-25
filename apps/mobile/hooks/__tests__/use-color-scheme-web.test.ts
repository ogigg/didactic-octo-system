import { act, renderHook } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { useThemePreferenceStore } from "@/stores/theme-preference-store";

import { useColorScheme } from "../use-color-scheme.web";

describe("useColorScheme (web)", () => {
  beforeEach(() => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    useThemePreferenceStore.setState({ preference: "system" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("follows the browser scheme on Auto", () => {
    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("dark");
  });

  it("applies the saved preference, which react-native-web can't override", () => {
    const { result } = renderHook(() => useColorScheme());

    act(() => useThemePreferenceStore.setState({ preference: "light" }));

    expect(result.current).toBe("light");
  });
});
