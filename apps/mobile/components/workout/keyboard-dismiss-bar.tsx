import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

/**
 * One-tap dismiss control shown above the keyboard while editing workout fields.
 * Uses keyboard show/hide listeners so it works for every TextInput on the screen
 * without wiring inputAccessoryViewID (needed for Android + shared iOS path).
 */
export function KeyboardDismissBar() {
  const { t } = useTranslation("workout");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const handleShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
    };
    const handleHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, handleShow);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleDismiss = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  if (keyboardHeight <= 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.anchor,
        { bottom: Platform.OS === "ios" ? keyboardHeight : 0 },
      ]}
    >
      <View
        style={[
          styles.toolbar,
          {
            backgroundColor: backgroundSubtle,
            borderTopColor: border,
          },
        ]}
      >
        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel={t("keyboard.dismiss")}
          hitSlop={8}
          style={styles.button}
        >
          <Text style={[Typography.bodyMedium, { color: primary }]}>
            {t("keyboard.done")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
  },
});
