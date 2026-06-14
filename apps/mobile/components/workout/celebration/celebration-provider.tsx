import { ConfettiOverlay } from "@/components/workout/celebration/confetti-overlay";
import * as Haptics from "expo-haptics";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Platform, StyleSheet, View } from "react-native";

export interface CelebrationPayload {
  /** Primary line, e.g. "New Weight PR". */
  label: string;
  /** Optional secondary line, e.g. "100 kg". */
  detail?: string;
}

interface CelebrationContextValue {
  celebrate: (payload: CelebrationPayload) => void;
}

const CelebrationContext = createContext<CelebrationContextValue>({
  celebrate: () => {},
});

/**
 * Access the screen-level celebration trigger. Safe to call without a provider
 * (no-op) so components stay testable in isolation.
 */
export function useCelebration(): CelebrationContextValue {
  return useContext(CelebrationContext);
}

interface ActiveCelebration extends CelebrationPayload {
  /** Remount key so each burst restarts its animations from scratch. */
  key: number;
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveCelebration | null>(null);
  const keyRef = useRef(0);

  const celebrate = useCallback((payload: CelebrationPayload) => {
    keyRef.current += 1;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    }
    setActive({ ...payload, key: keyRef.current });
  }, []);

  const handleComplete = useCallback((completedKey: number) => {
    setActive((current) =>
      current && current.key === completedKey ? null : current
    );
  }, []);

  const value = useMemo(() => ({ celebrate }), [celebrate]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {active ? (
        <View
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <ConfettiOverlay
            key={active.key}
            label={active.label}
            detail={active.detail}
            onComplete={() => handleComplete(active.key)}
          />
        </View>
      ) : null}
    </CelebrationContext.Provider>
  );
}
