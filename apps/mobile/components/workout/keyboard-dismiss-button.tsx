import { IconSymbol } from "@/components/ui/icon-symbol";
import { Radii, Spacing } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";

/**
 * In-flow dismiss control aligned to the left edge above the keyboard.
 * Its layout row contains the full touch target, so workout inputs cannot sit
 * underneath it while native Next/Done actions remain available on the right.
 */
export function KeyboardDismissButton() {
  const { t } = useTranslation("workout");
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const border = useThemeColor({}, "border");
  const textSecondary = useThemeColor({}, "textSecondary");

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const handleShow = () => {
      setKeyboardVisible(true);
    };
    const handleHide = () => {
      setKeyboardVisible(false);
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

  if (!keyboardVisible) {
    return null;
  }

  return (
    <View testID="keyboard-dismiss-toolbar" style={styles.toolbar}>
      <Pressable
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel={t("keyboard.dismiss")}
        hitSlop={8}
        style={[
          styles.button,
          {
            backgroundColor: backgroundElevated,
            borderColor: border,
          },
        ]}
      >
        <IconSymbol name="chevron.down" size={24} color={textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    height: 60,
    paddingHorizontal: Spacing.lg,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  button: {
    width: 48,
    height: 44,
    borderRadius: Radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
