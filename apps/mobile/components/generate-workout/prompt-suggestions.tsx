import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

interface PromptSuggestionsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export function PromptSuggestions({
  suggestions,
  onSelect,
}: PromptSuggestionsProps) {
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const textSecondary = useThemeColor({}, "textSecondary");

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion}
          onPress={() => onSelect(suggestion)}
          accessibilityRole="button"
          accessibilityLabel={suggestion}
          style={[styles.pill, { backgroundColor: borderSubtle }]}
        >
          <Text style={[Typography.caption, { color: textSecondary }]}>
            {suggestion}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  pill: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.full,
    justifyContent: "center",
    alignItems: "center",
  },
});
