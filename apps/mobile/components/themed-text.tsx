import { StyleSheet, Text, type TextProps } from "react-native";

import { Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

type TextType = keyof typeof Typography;

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: TextType;
  color?: keyof typeof import("@/constants/theme").Colors.light &
    keyof typeof import("@/constants/theme").Colors.dark;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "body",
  color = "text",
  ...rest
}: ThemedTextProps) {
  const resolvedColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    color
  );

  return (
    <Text
      style={[
        { color: resolvedColor },
        styles[type],
        tabularTypes.has(type) && tabularNums,
        style,
      ]}
      {...rest}
    />
  );
}

const tabularTypes = new Set<TextType>([
  "displayLg",
  "displaySm",
  "bodyMedium",
]);

const tabularNums = { fontVariant: ["tabular-nums" as const] };

const styles = StyleSheet.create({
  displayLg: {
    fontSize: Typography.displayLg.fontSize,
    fontWeight: Typography.displayLg.fontWeight,
    letterSpacing: Typography.displayLg.letterSpacing,
  },
  displaySm: {
    fontSize: Typography.displaySm.fontSize,
    fontWeight: Typography.displaySm.fontWeight,
    letterSpacing: Typography.displaySm.letterSpacing,
  },
  titleLg: {
    fontSize: Typography.titleLg.fontSize,
    fontWeight: Typography.titleLg.fontWeight,
    letterSpacing: Typography.titleLg.letterSpacing,
  },
  titleMd: {
    fontSize: Typography.titleMd.fontSize,
    fontWeight: Typography.titleMd.fontWeight,
    letterSpacing: Typography.titleMd.letterSpacing,
  },
  titleSm: {
    fontSize: Typography.titleSm.fontSize,
    fontWeight: Typography.titleSm.fontWeight,
    letterSpacing: Typography.titleSm.letterSpacing,
  },
  body: {
    fontSize: Typography.body.fontSize,
    fontWeight: Typography.body.fontWeight,
    letterSpacing: Typography.body.letterSpacing,
  },
  bodyMedium: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: Typography.bodyMedium.fontWeight,
    letterSpacing: Typography.bodyMedium.letterSpacing,
  },
  caption: {
    fontSize: Typography.caption.fontSize,
    fontWeight: Typography.caption.fontWeight,
    letterSpacing: Typography.caption.letterSpacing,
  },
  label: {
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
    letterSpacing: Typography.label.letterSpacing,
    textTransform: "uppercase",
  },
  micro: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    letterSpacing: Typography.micro.letterSpacing,
  },
});
