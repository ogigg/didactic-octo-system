import { type TextStyle, StyleSheet, Text, View } from "react-native";

import { BackButton } from "@/components/ui/back-button";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

interface ScreenHeaderProps {
  title?: string;
  titleStyle?: TextStyle;
  rightElement?: React.ReactNode;
  numberOfLines?: number;
  onBack?: () => void;
  backAccessibilityLabel?: string;
  backDisabled?: boolean;
}

export function ScreenHeader({
  title,
  titleStyle,
  rightElement,
  numberOfLines,
  onBack,
  backAccessibilityLabel,
  backDisabled = false,
}: ScreenHeaderProps) {
  const textColor = useThemeColor({}, "text");
  const border = useThemeColor({}, "border");

  return (
    <View style={[styles.header, { borderBottomColor: border }]}>
      <BackButton
        onPress={onBack}
        accessibilityLabel={backAccessibilityLabel}
        disabled={backDisabled}
      />
      {title ? (
        <Text
          style={[
            Typography.titleLg,
            styles.headerTitle,
            { color: textColor },
            titleStyle,
          ]}
          numberOfLines={numberOfLines}
        >
          {title}
        </Text>
      ) : (
        <View style={styles.headerTitle} />
      )}
      {rightElement ?? <View style={styles.headerSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  headerTitle: {
    flexGrow: 1,
    textAlign: "center",
    marginHorizontal: Spacing.sm,
  },
  headerSpacer: {
    width: 44,
  },
});
