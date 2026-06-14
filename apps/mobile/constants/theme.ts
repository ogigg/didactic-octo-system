import { Platform } from "react-native";

export const Colors = {
  light: {
    background: "#FFFFFF",
    backgroundSubtle: "#F9F9F8",
    backgroundElevated: "#FFFFFF",
    text: "#1A1A1A",
    textSecondary: "#777777",
    textMuted: "#AAAAAA",
    textDisabled: "#DDDDDD",
    primary: "#3898D8",
    primarySurface: "#E8F2FA",
    primaryContainer: "#F5F9FC",
    border: "#F0EEEB",
    borderSubtle: "#F5F5F4",
    inputFill: "#F0F0EE",
    inputFillFocused: "#EAF3FB",
    success: "#34C759",
    warning: "#FFAC30",
    error: "#FF3B30",
    destructiveSurface: "#FFF0F0",
    // Personal-record gold — used for record set styling & celebrations.
    gold: "#E3A50B",
    goldBright: "#FFC53D",
    goldSurface: "rgba(227,165,11,0.12)",
    goldGlow: "rgba(227,165,11,0.30)",
    glow: "rgba(56,152,216,0.07)",
    // Gradient pairs — top-left → bottom-right. Keep deltas small; gradients
    // are atmospheric, not decorative.
    surfaceGradientStart: "#FBFBFA",
    surfaceGradientEnd: "#F4F2EF",
    heroGradientStart: "#3898D8",
    heroGradientEnd: "#5E6EE0",
    accentGradientStart: "rgba(56,152,216,0.08)",
    accentGradientEnd: "rgba(94,110,224,0.05)",
  },
  dark: {
    background: "#121416",
    backgroundSubtle: "#1A1D20",
    backgroundElevated: "#161819",
    text: "#E8E8E8",
    textSecondary: "#888888",
    textMuted: "#555555",
    textDisabled: "#444444",
    primary: "#5AAEE0",
    primarySurface: "#1A2028",
    primaryContainer: "#1E2530",
    border: "#2A2D30",
    borderSubtle: "#1E2022",
    inputFill: "#232629",
    inputFillFocused: "#1A2028",
    success: "#30D158",
    warning: "#FFD60A",
    error: "#FF453A",
    destructiveSurface: "#2A1215",
    // Personal-record gold — used for record set styling & celebrations.
    gold: "#FFC53D",
    goldBright: "#FFD970",
    goldSurface: "rgba(255,197,61,0.14)",
    goldGlow: "rgba(255,197,61,0.28)",
    glow: "rgba(56,152,216,0.05)",
    surfaceGradientStart: "#1C1F22",
    surfaceGradientEnd: "#141618",
    heroGradientStart: "#3898D8",
    heroGradientEnd: "#5E5BD4",
    accentGradientStart: "rgba(90,174,224,0.10)",
    accentGradientEnd: "rgba(110,91,212,0.04)",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const;

export const Radii = {
  sm: 8,
  md: 10,
  lg: 14,
  full: 9999,
} as const;

export const Typography = {
  displayLg: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
  displaySm: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3 },
  titleLg: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  titleMd: { fontSize: 17, fontWeight: "600" as const, letterSpacing: 0 },
  titleSm: { fontSize: 15, fontWeight: "600" as const, letterSpacing: -0.2 },
  body: { fontSize: 14, fontWeight: "400" as const, letterSpacing: 0 },
  bodyMedium: { fontSize: 14, fontWeight: "500" as const, letterSpacing: 0 },
  caption: { fontSize: 12, fontWeight: "400" as const, letterSpacing: 0 },
  label: {
    fontSize: 11,
    fontWeight: "500" as const,
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
  },
  micro: { fontSize: 10, fontWeight: "500" as const, letterSpacing: 0 },
} as const;

export const Opacity = {
  pressed: 0.95,
  disabled: 0.5,
} as const;

export const Elevation = {
  sm: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    android: {
      elevation: 2,
    },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
