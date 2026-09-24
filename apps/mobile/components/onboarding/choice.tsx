import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
interface ChoiceProps {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}
export function OnboardingChoice({
  label,
  hint,
  selected,
  onPress,
}: ChoiceProps) {
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");
  const fill = useThemeColor({}, "primarySurface");
  const border = useThemeColor({}, "border");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={[
        styles.row,
        {
          borderColor: selected ? primary : border,
          backgroundColor: selected ? fill : "transparent",
        },
      ]}
    >
      <View style={styles.copy}>
        <Text style={[Typography.titleSm, { color: text }]}>{label}</Text>
        {hint && (
          <Text style={[Typography.body, { color: secondary }]}>{hint}</Text>
        )}
      </View>
      <View
        style={[styles.radio, { borderColor: selected ? primary : secondary }]}
      >
        {selected && (
          <View style={[styles.dot, { backgroundColor: primary }]} />
        )}
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radii.md,
    marginBottom: Spacing.md,
  },
  copy: { flex: 1, gap: Spacing.xs },
  radio: {
    height: 20,
    width: 20,
    borderWidth: 2,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
