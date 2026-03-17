import { render } from "@testing-library/react-native";

import { AmbientGlow } from "./ambient-glow";

jest.mock("expo-blur", () => ({
  BlurView: "BlurView",
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useReducedMotion = jest.fn(() => false);
  return Reanimated;
});

jest.mock("@/constants/theme", () => ({
  Colors: {
    light: { primary: "#3898D8" },
    dark: { primary: "#5AAEE0" },
  },
}));

describe("AmbientGlow", () => {
  it("renders without crashing for hero variant", () => {
    const { toJSON } = render(<AmbientGlow variant="hero" />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders without crashing for timer variant", () => {
    const { toJSON } = render(<AmbientGlow variant="timer" />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders without crashing for subtle variant", () => {
    const { toJSON } = render(<AmbientGlow variant="subtle" />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders without crashing with default variant", () => {
    const { toJSON } = render(<AmbientGlow />);
    expect(toJSON()).toBeTruthy();
  });

  it("has pointerEvents none on container", () => {
    const { toJSON } = render(<AmbientGlow variant="hero" />);
    const root = toJSON() as { props: { pointerEvents?: string } };
    expect(root.props.pointerEvents).toBe("none");
  });

  it("hero variant renders 3 blobs plus BlurView (4 children)", () => {
    const { toJSON } = render(<AmbientGlow variant="hero" />);
    const root = toJSON() as { children: unknown[] };
    // 3 blobs + 1 BlurView = 4 children
    expect(root.children).toHaveLength(4);
  });

  it("timer variant renders 2 blobs plus BlurView (3 children)", () => {
    const { toJSON } = render(<AmbientGlow variant="timer" />);
    const root = toJSON() as { children: unknown[] };
    expect(root.children).toHaveLength(3);
  });

  it("subtle variant renders 2 blobs plus BlurView (3 children)", () => {
    const { toJSON } = render(<AmbientGlow variant="subtle" />);
    const root = toJSON() as { children: unknown[] };
    expect(root.children).toHaveLength(3);
  });

  it("respects reduced motion - still renders without animation", () => {
    const { useReducedMotion } = require("react-native-reanimated");
    useReducedMotion.mockReturnValue(true);
    const { toJSON } = render(<AmbientGlow variant="hero" animated />);
    expect(toJSON()).toBeTruthy();
    useReducedMotion.mockReturnValue(false);
  });

  it("animated=false renders without animation", () => {
    const { toJSON } = render(<AmbientGlow variant="hero" animated={false} />);
    expect(toJSON()).toBeTruthy();
  });
});
