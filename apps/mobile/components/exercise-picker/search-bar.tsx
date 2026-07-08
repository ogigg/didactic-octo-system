import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  placeholder: string;
  clearAccessibilityLabel: string;
}

export function SearchBar({
  value,
  onChangeText,
  onClear,
  placeholder,
  clearAccessibilityLabel,
}: SearchBarProps) {
  const inputFill = useThemeColor({}, "inputFill");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const showClearButton = value.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: inputFill }]}>
      <IconSymbol name="magnifyingglass" size={18} color={textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={textMuted}
        style={[Typography.body, styles.input, { color: textColor }]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {showClearButton ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel}
          hitSlop={8}
          style={styles.clearButton}
        >
          <IconSymbol name="xmark" size={16} color={textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.xs,
  },
  clearButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    minWidth: 28,
  },
});
