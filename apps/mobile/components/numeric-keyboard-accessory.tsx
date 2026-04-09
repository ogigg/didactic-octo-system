import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

import { Spacing, Typography } from "@/constants/theme";

export const NUMERIC_ACCESSORY_ID = "numeric-keyboard-accessory";

const COLORS = {
  light: {
    primary: "#007AFF",
    border: "#E5E5EA",
    backgroundSubtle: "#F2F2F7",
  },
  dark: {
    primary: "#0A84FF",
    border: "#38383A",
    backgroundSubtle: "#1C1C1E",
  },
};

export function NumericKeyboardAccessory() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? COLORS.dark : COLORS.light;

  if (Platform.OS !== "ios") return null;

  return (
    <InputAccessoryView nativeID={NUMERIC_ACCESSORY_ID}>
      <View
        style={[
          styles.toolbar,
          {
            backgroundColor: colors.backgroundSubtle,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={Keyboard.dismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
        >
          <Text style={[Typography.bodyMedium, { color: colors.primary }]}>
            Done
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
