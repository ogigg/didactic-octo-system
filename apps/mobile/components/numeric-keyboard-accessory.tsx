import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

export const NUMERIC_ACCESSORY_ID = "numeric-keyboard-accessory";

export function NumericKeyboardAccessory() {
  if (Platform.OS !== "ios") return null;

  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");

  return (
    <InputAccessoryView nativeID={NUMERIC_ACCESSORY_ID}>
      <View
        style={[
          styles.toolbar,
          { backgroundColor: backgroundSubtle, borderTopColor: border },
        ]}
      >
        <Pressable
          onPress={Keyboard.dismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
        >
          <Text style={[Typography.bodyMedium, { color: primary }]}>Done</Text>
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
