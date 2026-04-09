import { ReactNode, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

interface MeasurementGroupProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function MeasurementGroup({
  title,
  count,
  defaultOpen = false,
  children,
}: MeasurementGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");

  return (
    <View style={[styles.container, { borderBottomColor: border }]}>
      <TouchableOpacity
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={`${title} section`}
        style={styles.header}
      >
        <IconSymbol
          name="chevron.right"
          size={14}
          color={textMuted}
          style={open && styles.chevronOpen}
        />
        <Text style={[Typography.titleSm, { color: textColor }]}>{title}</Text>
        <Text style={[Typography.caption, { color: textMuted }]}>{count}</Text>
      </TouchableOpacity>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  chevronOpen: {
    transform: [{ rotate: "90deg" }],
  },
  body: {
    paddingBottom: Spacing.sm,
  },
});
