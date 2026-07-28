import { IconSymbol } from "@/components/ui/icon-symbol";
import { Radii, Spacing } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  StyleSheet,
} from "react-native";

/**
 * Compact dismiss control aligned to the left edge above the keyboard.
 * Native Next/Done actions remain on the right.
 */
export function KeyboardDismissButton() {
  const { t } = useTranslation("workout");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const border = useThemeColor({}, "border");
  const textSecondary = useThemeColor({}, "textSecondary");

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
    <Pressable
      onPress={handleDismiss}
      accessibilityRole="button"
      accessibilityLabel={t("keyboard.dismiss")}
      hitSlop={8}
      style={[
        styles.button,
        {
          bottom:
            Platform.OS === "ios" ? keyboardHeight + Spacing.sm : Spacing.sm,
          backgroundColor: backgroundElevated,
          borderColor: border,
        },
      ]}
    >
      <IconSymbol name="chevron.down" size={24} color={textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 20,
    width: 48,
    height: 44,
    borderRadius: Radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
