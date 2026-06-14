import { Radii, Spacing, Typography } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

/** Vibrant gold-forward palette — independent of theme for maximum pop. */
const CONFETTI_COLORS = [
  "#FFD700",
  "#FFC53D",
  "#E3A50B",
  "#FFE08A",
  "#FFB300",
  "#FFF3C4",
  "#FFFFFF",
];

const PARTICLE_COUNT = 70;
const BADGE_HOLD_MS = 900;

interface Particle {
  id: number;
  startX: number;
  drift: number;
  size: number;
  longSide: number;
  color: string;
  delay: number;
  duration: number;
  rotations: number;
  isCircle: boolean;
  swayPhase: number;
}

function buildParticles(width: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, id) => {
    const size = 6 + Math.random() * 7;
    return {
      id,
      startX: Math.random() * width,
      drift: (Math.random() - 0.5) * 140,
      size,
      longSide: size + Math.random() * 8,
      color:
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 350,
      duration: 1700 + Math.random() * 1100,
      rotations: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 3),
      isCircle: Math.random() > 0.6,
      swayPhase: Math.random() * Math.PI * 2,
    };
  });
}

interface ConfettiPieceProps {
  particle: Particle;
  height: number;
}

function ConfettiPiece({ particle, height }: ConfettiPieceProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: particle.duration,
      delay: particle.delay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [particle.duration, particle.delay, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, height + 60],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, particle.drift * 0.6, particle.drift],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${particle.rotations * 360}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: particle.startX,
          width: particle.isCircle ? particle.size : particle.size,
          height: particle.isCircle ? particle.size : particle.longSide,
          borderRadius: particle.isCircle ? particle.size / 2 : 2,
          backgroundColor: particle.color,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}
    />
  );
}

interface PrBadgeProps {
  label: string;
  detail?: string;
}

function PrBadge({ label, detail }: PrBadgeProps) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const enter = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 160,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 150,
        friction: 10,
        useNativeDriver: true,
      }),
    ]);

    const ring = Animated.parallel([
      Animated.timing(ringScale, {
        toValue: 2.2,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(ringOpacity, {
          toValue: 0.45,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 780,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);

    const exit = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.85,
        duration: 320,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -16,
        duration: 320,
        useNativeDriver: true,
      }),
    ]);

    const sequence = Animated.sequence([
      Animated.parallel([enter, ring]),
      Animated.delay(BADGE_HOLD_MS),
      exit,
    ]);
    sequence.start();
    return () => sequence.stop();
  }, [opacity, ringOpacity, ringScale, scale, translateY]);

  return (
    <View pointerEvents="none" style={styles.badgeWrapper}>
      <Animated.View
        style={[
          styles.badgeRing,
          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
        ]}
      />
      <Animated.View
        style={{ opacity, transform: [{ scale }, { translateY }] }}
      >
        <LinearGradient
          colors={["#FFE9A8", "#FFC53D", "#E3A50B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.badge}
        >
          <IconSymbol name="trophy.fill" size={22} color="#5A3E00" />
          <View style={styles.badgeTextWrap}>
            <Text style={styles.badgeLabel}>{label}</Text>
            {detail ? <Text style={styles.badgeDetail}>{detail}</Text> : null}
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

export interface ConfettiOverlayProps {
  label: string;
  detail?: string;
  onComplete: () => void;
}

/**
 * Full-screen, non-interactive celebration burst: a shower of gold confetti
 * plus a springy trophy badge. Designed to mount fresh per celebration (via a
 * remount `key`) so every animation restarts cleanly, then self-dismisses.
 */
export function ConfettiOverlay({
  label,
  detail,
  onComplete,
}: ConfettiOverlayProps) {
  const { width, height } = useMemo(() => Dimensions.get("window"), []);
  const particles = useMemo(() => buildParticles(width), [width]);

  useEffect(() => {
    const longest = particles.reduce(
      (max, p) => Math.max(max, p.delay + p.duration),
      0
    );
    const timer = setTimeout(onComplete, Math.max(longest, 2200) + 100);
    return () => clearTimeout(timer);
  }, [particles, onComplete]);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {particles.map((particle) => (
        <ConfettiPiece key={particle.id} particle={particle} height={height} />
      ))}
      <PrBadge label={label} detail={detail} />
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: "absolute",
    top: 0,
  },
  badgeWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: Radii.full,
    borderWidth: 3,
    borderColor: "#FFD700",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radii.full,
    shadowColor: "#E3A50B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  badgeTextWrap: {
    alignItems: "flex-start",
  },
  badgeLabel: {
    ...Typography.titleSm,
    color: "#4A3200",
    fontWeight: "800",
  },
  badgeDetail: {
    ...Typography.micro,
    color: "#6B4A00",
    fontWeight: "700",
  },
});
