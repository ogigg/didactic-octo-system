import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback } from "react";

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}

export function FilterSheet({
  visible,
  onClose,
  title,
  options,
  selected,
  onToggle,
}: FilterSheetProps) {
  const background = useThemeColor({}, "backgroundElevated");
  const textColor = useThemeColor({}, "text");
  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");
  const textMuted = useThemeColor({}, "textMuted");

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      const isSelected = selected.includes(item);
      return (
        <Pressable
          onPress={() => onToggle(item)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          accessibilityLabel={item}
          style={[styles.option, { borderBottomColor: border }]}
        >
          <Text
            style={[
              Typography.titleSm,
              { color: isSelected ? primary : textColor },
            ]}
          >
            {item}
          </Text>
          {isSelected && (
            <IconSymbol name="checkmark" size={18} color={primary} />
          )}
        </Pressable>
      );
    },
    [selected, onToggle, border, textColor, primary]
  );

  const keyExtractor = useCallback((item: string) => item, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: background }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.handle, { backgroundColor: textMuted }]} />
          <Text
            style={[Typography.titleMd, { color: textColor }, styles.title]}
          >
            {title}
          </Text>
          <FlatList
            data={options as unknown as string[]}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={styles.list}
            bounces={false}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["4xl"],
    paddingTop: Spacing.md,
    maxHeight: "70%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radii.full,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  list: {
    flexGrow: 0,
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
