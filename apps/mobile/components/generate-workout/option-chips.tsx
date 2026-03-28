import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface ChipOption<T extends string | number> {
  value: T;
  label: string;
}

interface OptionChipsProps<T extends string | number> {
  options: ChipOption<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  layout?: "wrap" | "scroll";
}

export function OptionChips<T extends string | number>({
  options,
  selected,
  onSelect,
  layout = "wrap",
}: OptionChipsProps<T>) {
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const textSecondary = useThemeColor({}, "textSecondary");

  const chips = options.map((option) => {
    const isSelected = selected === option.value;
    return (
      <Pressable
        key={option.value}
        onPress={() => onSelect(option.value)}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={option.label}
        style={[
          styles.chip,
          isSelected
            ? {
                backgroundColor: primarySurface,
                borderColor: primary,
                borderWidth: 1.5,
              }
            : { backgroundColor: borderSubtle, borderColor: "transparent", borderWidth: 1.5 },
        ]}
      >
        <Text
          style={[
            Typography.bodyMedium,
            { color: isSelected ? primary : textSecondary },
          ]}
        >
          {option.label}
        </Text>
      </Pressable>
    );
  });

  if (layout === "scroll") {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {chips}
      </ScrollView>
    );
  }

  return <View style={styles.wrapContainer}>{chips}</View>;
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.full,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  wrapContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  scrollContainer: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
});
