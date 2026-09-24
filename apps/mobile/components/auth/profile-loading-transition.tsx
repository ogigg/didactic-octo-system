import { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useAuthStore } from "@/stores/auth-store";
import { ProfileGate } from "./profile-gate";

/** Lives above the router so the loading screen can fade over its destination. */
export function ProfileLoadingTransition() {
  const status = useAuthStore((s) => s.profileStatus);
  const userId = useAuthStore((s) => s.session?.user.id);
  const recovery = useAuthStore((s) => s.isPasswordRecovery);
  const previous = useRef(status);
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    const finished = previous.current !== "ready" && status === "ready";
    previous.current = status;
    if (!finished || !userId || recovery || reducedMotion) {
      setVisible(false);
      return;
    }
    setVisible(true);
    opacity.value = 1;
    opacity.value = withTiming(0, { duration: 220 });
    const timer = setTimeout(() => setVisible(false), 220);
    return () => {
      clearTimeout(timer);
      cancelAnimation(opacity);
    };
  }, [status, userId, recovery, reducedMotion, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!visible) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, fade]}
    >
      <ProfileGate />
    </Animated.View>
  );
}
