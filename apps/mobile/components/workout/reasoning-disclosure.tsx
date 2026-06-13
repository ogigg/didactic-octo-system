import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Opacity, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

export interface ReasoningEntry {
  label: string;
  text?: string | null;
}

interface ReasoningDisclosureProps {
  title: string;
  showLabel: string;
  hideLabel: string;
  accessibilityLabel: string;
  entries: ReasoningEntry[];
  style?: StyleProp<ViewStyle>;
}

export function hasReasoningEntries(entries: ReasoningEntry[]): boolean {
  return entries.some((entry) => entry.text?.trim());
}

export function ReasoningDisclosure({
  title,
  showLabel,
  hideLabel,
  accessibilityLabel,
  entries,
  style,
}: ReasoningDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleEntries = useMemo(
    () => entries.filter((entry) => entry.text?.trim()),
    [entries]
  );

  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");

  if (visibleEntries.length === 0) return null;

  return (
    <View style={[styles.container, { borderTopColor: border }, style]}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.trigger,
          { opacity: pressed ? Opacity.pressed : 1 },
        ]}
      >
        <View style={[styles.iconBubble, { backgroundColor: primarySurface }]}>
          <IconSymbol
            name="questionmark.circle.fill"
            size={16}
            color={primary}
          />
        </View>
        <Text style={[Typography.bodyMedium, styles.title, { color: primary }]}>
          {title}
        </Text>
        <Text style={[Typography.caption, { color: textMuted }]}>
          {expanded ? hideLabel : showLabel}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.content}>
          {visibleEntries.map((entry) => (
            <View key={entry.label} style={styles.entry}>
              <Text style={[Typography.label, { color: textMuted }]}>
                {entry.label}
              </Text>
              <Text
                style={[
                  Typography.caption,
                  styles.body,
                  { color: textSecondary },
                ]}
              >
                {entry.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  trigger: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
  },
  content: {
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    paddingLeft: 36,
  },
  entry: {
    gap: 2,
  },
  body: {
    lineHeight: 17,
  },
});
