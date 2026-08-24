import {
  AppBottomSheet,
  type AppBottomSheetHandle,
} from "@/components/ui/app-bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  closeAccessibilityLabel: string;
  loadingLabel: string;
  isLoading?: boolean;
  options: readonly string[];
  selected: string[];
  displayLabels?: ReadonlyMap<string, string>;
  onToggle: (value: string) => void;
}

export function FilterSheet({
  visible,
  onClose,
  title,
  closeAccessibilityLabel,
  loadingLabel,
  isLoading = false,
  options,
  selected,
  displayLabels,
  onToggle,
}: FilterSheetProps) {
  const sheetRef = useRef<AppBottomSheetHandle>(null);
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      const isSelected = selected.includes(item);
      const label = displayLabels?.get(item) ?? item;
      return (
        <Pressable
          onPress={() => onToggle(item)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          accessibilityLabel={label}
          style={[styles.option, { borderBottomColor: border }]}
        >
          <Text
            style={[
              Typography.body,
              { color: isSelected ? primary : textColor },
            ]}
          >
            {label}
          </Text>
          {isSelected && (
            <IconSymbol name="checkmark" size={18} color={primary} />
          )}
        </Pressable>
      );
    },
    [selected, displayLabels, onToggle, border, textColor, primary]
  );

  const keyExtractor = useCallback((item: string) => item, []);

  return (
    <AppBottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={onClose}
      closeAccessibilityLabel={closeAccessibilityLabel}
      testID="filter-sheet"
    >
      <View style={styles.container}>
        <Text style={[Typography.titleMd, { color: textColor }, styles.title]}>
          {title}
        </Text>
        {isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={primary} />
            <Text
              style={[Typography.body, styles.stateText, { color: textMuted }]}
            >
              {loadingLabel}
            </Text>
          </View>
        ) : (
          <FlatList
            data={options as unknown as string[]}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            bounces={false}
          />
        )}
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingVertical: Spacing["3xl"],
  },
  stateText: {
    textAlign: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
});
