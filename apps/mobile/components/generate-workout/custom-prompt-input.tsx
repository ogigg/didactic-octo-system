import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

const MAX_LENGTH = 200;

interface CustomPromptInputProps {
  value: string;
  onChangeText: (text: string) => void;
  titleLabel: string;
  subtitleLabel: string;
  placeholder: string;
  charCountTemplate: string;
}

export function CustomPromptInput({
  value,
  onChangeText,
  titleLabel,
  subtitleLabel,
  placeholder,
  charCountTemplate,
}: CustomPromptInputProps) {
  const [focused, setFocused] = useState(false);

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const inputFillFocused = useThemeColor({}, "inputFillFocused");
  const primary = useThemeColor({}, "primary");

  const charCountLabel = charCountTemplate
    .replace("{{count}}", String(value.length))
    .replace("{{max}}", String(MAX_LENGTH));

  return (
    <View style={styles.container}>
      <Text style={[Typography.titleSm, { color: textColor }, styles.title]}>
        {titleLabel}
      </Text>
      <Text
        style={[Typography.caption, { color: textSecondary }, styles.subtitle]}
      >
        {subtitleLabel}
      </Text>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: focused ? inputFillFocused : backgroundSubtle,
            borderColor: focused ? primary : "transparent",
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={textMuted}
          multiline
          numberOfLines={3}
          maxLength={MAX_LENGTH}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[Typography.body, { color: textColor }, styles.input]}
          accessibilityLabel="Custom goal description"
          returnKeyType="done"
          blurOnSubmit
        />
      </View>
      <Text style={[Typography.micro, { color: textMuted }, styles.charCount]}>
        {charCountLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.md,
  },
  inputContainer: {
    borderRadius: Radii.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  input: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  charCount: {
    marginTop: Spacing.xs,
    textAlign: "right",
  },
});
