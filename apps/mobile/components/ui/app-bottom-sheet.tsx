import { Elevation, Radii, Spacing } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import type { PropsWithChildren } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 850;
const OPEN_SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

interface AppBottomSheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  closeAccessibilityLabel: string;
  testID?: string;
}

export interface AppBottomSheetHandle {
  dismiss: (afterClose?: () => void) => void;
}

export const AppBottomSheet = forwardRef<
  AppBottomSheetHandle,
  AppBottomSheetProps
>(function AppBottomSheet(
  {
    visible,
    onClose,
    closeAccessibilityLabel,
    testID,
    children,
  }: AppBottomSheetProps,
  ref
) {
  const { height: screenHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const background = useThemeColor({}, "backgroundElevated");
  const handleColor = useThemeColor({}, "textDisabled");
  const translateY = useSharedValue(screenHeight);
  const backdropOpacity = useSharedValue(0);
  const closingRef = useRef(false);
  const afterCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!visible) {
      closingRef.current = false;
      afterCloseRef.current = null;
      translateY.value = screenHeight;
      backdropOpacity.value = 0;
      return;
    }

    translateY.value = reducedMotion ? 0 : screenHeight;
    backdropOpacity.value = withTiming(1, {
      duration: reducedMotion ? 0 : 220,
    });
    translateY.value = reducedMotion ? 0 : withSpring(0, OPEN_SPRING);
  }, [backdropOpacity, reducedMotion, screenHeight, translateY, visible]);

  const finishClose = useCallback(() => {
    closingRef.current = false;
    const afterClose = afterCloseRef.current;
    afterCloseRef.current = null;
    onClose();
    afterClose?.();
  }, [onClose]);

  const requestClose = useCallback(
    (afterClose?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      afterCloseRef.current = afterClose ?? null;

      backdropOpacity.value = withTiming(0, {
        duration: reducedMotion ? 0 : 180,
      });
      if (reducedMotion) {
        finishClose();
        return;
      }

      translateY.value = withTiming(
        screenHeight,
        { duration: 240, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finishClose)();
        }
      );
    },
    [backdropOpacity, finishClose, reducedMotion, screenHeight, translateY]
  );

  const handleBackdropPress = useCallback(() => {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }

    requestClose();
  }, [requestClose]);

  useImperativeHandle(
    ref,
    () => ({
      dismiss: requestClose,
    }),
    [requestClose]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onChange((event) => {
          translateY.value =
            event.translationY > 0
              ? event.translationY
              : event.translationY / 8;
        })
        .onEnd((event) => {
          if (
            event.translationY > DISMISS_DISTANCE ||
            event.velocityY > DISMISS_VELOCITY
          ) {
            runOnJS(requestClose)();
          } else {
            translateY.value = withSpring(0, OPEN_SPRING);
          }
        }),
    [requestClose, translateY]
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={() => requestClose()}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <GestureHandlerRootView style={styles.flex}>
          <Animated.View
            pointerEvents="none"
            style={[styles.backdrop, backdropStyle]}
          />
          <View style={styles.container}>
            <Pressable
              style={styles.flex}
              onPress={handleBackdropPress}
              accessibilityRole="button"
              accessibilityLabel={closeAccessibilityLabel}
            />
            <Animated.View
              testID={testID}
              accessibilityViewIsModal
              onAccessibilityEscape={() => requestClose()}
              style={[
                styles.sheet,
                { backgroundColor: background },
                Elevation.md,
                sheetStyle,
              ]}
            >
              <SafeAreaView edges={["bottom"]}>
                <GestureDetector gesture={panGesture}>
                  <Animated.View style={styles.handleArea}>
                    <View
                      style={[styles.handle, { backgroundColor: handleColor }]}
                    />
                  </Animated.View>
                </GestureDetector>
                {children}
              </SafeAreaView>
            </Animated.View>
          </View>
        </GestureHandlerRootView>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    overflow: "hidden",
  },
  handleArea: {
    height: Spacing["2xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radii.full,
  },
});
