import {
  Colors,
  Spacing,
  Radii,
  Typography,
  Opacity,
  Elevation,
} from "../theme";

describe("Design Tokens", () => {
  const requiredColorTokens = [
    "background",
    "backgroundSubtle",
    "backgroundElevated",
    "text",
    "textSecondary",
    "textMuted",
    "textDisabled",
    "primary",
    "primarySurface",
    "primaryContainer",
    "border",
    "borderSubtle",
    "inputFill",
    "inputFillFocused",
    "success",
    "warning",
    "error",
    "destructiveSurface",
    "glow",
  ];

  it("light mode has all required color tokens", () => {
    for (const token of requiredColorTokens) {
      expect(Colors.light).toHaveProperty(token);
    }
  });

  it("dark mode has all required color tokens", () => {
    for (const token of requiredColorTokens) {
      expect(Colors.dark).toHaveProperty(token);
    }
  });

  it("light and dark have the same keys", () => {
    expect(Object.keys(Colors.light).sort()).toEqual(
      Object.keys(Colors.dark).sort()
    );
  });

  it("spacing scale uses 4px base", () => {
    expect(Spacing.xs).toBe(4);
    expect(Spacing.sm).toBe(8);
    expect(Spacing.lg).toBe(16);
  });

  it("radii follow mixed hierarchy", () => {
    expect(Radii.sm).toBeLessThan(Radii.md);
    expect(Radii.md).toBeLessThan(Radii.lg);
    expect(Radii.full).toBe(9999);
  });

  it("typography tokens have required fields", () => {
    for (const [, value] of Object.entries(Typography)) {
      expect(value).toHaveProperty("fontSize");
      expect(value).toHaveProperty("fontWeight");
    }
  });

  it("opacity tokens are between 0 and 1", () => {
    expect(Opacity.pressed).toBeGreaterThan(0);
    expect(Opacity.pressed).toBeLessThanOrEqual(1);
    expect(Opacity.disabled).toBeGreaterThan(0);
    expect(Opacity.disabled).toBeLessThanOrEqual(1);
  });
});
