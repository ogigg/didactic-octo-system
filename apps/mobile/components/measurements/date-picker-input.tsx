import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

export function formatDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface DatePickerInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function DatePickerInput({
  value,
  onChange,
  label,
}: DatePickerInputProps) {
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const inputFill = useThemeColor({}, "inputFill");
  const border = useThemeColor({}, "border");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const chevronRotation = useSharedValue(0);

  useEffect(() => {
    chevronRotation.value = withTiming(showDatePicker ? 180 : 0, {
      duration: 200,
    });
  }, [showDatePicker]);

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[Typography.label, { color: textMuted }]}>{label}</Text>
      )}
      <Pressable
        onPress={() => setShowDatePicker(!showDatePicker)}
        style={[
          styles.input,
          {
            backgroundColor: inputFill,
            borderColor: border,
          },
        ]}
      >
        <Text style={[Typography.body, { color: textColor }]}>{value}</Text>
        <Animated.View style={chevronAnimatedStyle}>
          <IconSymbol name="chevron.down" size={16} color={textMuted} />
        </Animated.View>
      </Pressable>
      {showDatePicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_event, selectedDate) => {
            setShowDatePicker(Platform.OS === "ios");
            if (selectedDate) {
              onChange(formatDateString(selectedDate));
            }
          }}
          style={styles.picker}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radii.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
  picker: {
    alignSelf: "center",
    marginTop: Spacing.md,
  },
});
