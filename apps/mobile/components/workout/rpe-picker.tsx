import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface RpePickerProps {
  visible: boolean;
  currentValue: number | null;
  onSelect: (value: number) => void;
  onClose: () => void;
}

export function RpePicker({
  visible,
  currentValue,
  onSelect,
  onClose,
}: RpePickerProps) {
  const { t } = useTranslation("workout");
  const background = useThemeColor({}, "backgroundElevated");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const borderSubtle = useThemeColor({}, "borderSubtle");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.container, { backgroundColor: background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[Typography.titleSm, { color: textColor }]}>
            {t("rpe.title")}
          </Text>
          <View style={styles.grid}>
            {RPE_VALUES.map((val) => {
              const isSelected = val === currentValue;
              return (
                <Pressable
                  key={val}
                  onPress={() => {
                    onSelect(val);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`RPE ${val}`}
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected
                        ? primarySurface
                        : borderSubtle,
                      borderColor: isSelected ? primary : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      Typography.bodyMedium,
                      {
                        color: isSelected ? primary : textSecondary,
                      },
                    ]}
                  >
                    {val}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    marginHorizontal: Spacing["3xl"],
    gap: Spacing.lg,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  chip: {
    width: 48,
    height: 48,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
