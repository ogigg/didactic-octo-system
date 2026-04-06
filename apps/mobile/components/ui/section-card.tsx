import { Elevation, Spacing } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

export default function SectionCard({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const glow = useThemeColor({}, "glow");
  const border = useThemeColor({}, "border");

  return (
    <View
      style={[
        styles.cardShell,
        {
          backgroundColor: backgroundElevated,
          borderColor: accent ? glow : border,
        },
        Elevation.md,
      ]}
    >
      {accent ? (
        <LinearGradient
          colors={["rgba(56,152,216,0.16)", "rgba(56,152,216,0.03)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        />
      ) : null}
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContent: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
});
