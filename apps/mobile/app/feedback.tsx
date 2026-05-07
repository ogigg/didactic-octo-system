import { zodResolver } from "@hookform/resolvers/zod";
import Constants from "expo-constants";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OptionChips } from "@/components/generate-workout/option-chips";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { AmbientGlow } from "@/components/ambient-glow";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { sendFeedback } from "@/lib/api/feedback";
import type {
  FeedbackFormData,
  FeedbackValidationKey,
} from "@/lib/schemas/feedback";
import { feedbackSchema } from "@/lib/schemas/feedback";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

export default function FeedbackScreen() {
  const { t } = useTranslation("feedback");
  const router = useRouter();

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const inputFill = useThemeColor({}, "inputFill");
  const errorColor = useThemeColor({}, "error");

  const typeOptions = [
    { value: "bug_report" as const, label: t("type.bug") },
    { value: "feature_request" as const, label: t("type.feature") },
  ];

  const submitMutation = useMutation({
    mutationFn: async (data: FeedbackFormData) => {
      await sendFeedback({
        type: data.type,
        title: data.title,
        description: data.description,
        app_version: Constants.expoConfig?.version,
        os_version: Platform.Version?.toString(),
        platform: Platform.OS,
      });
    },
    onSuccess: () => {
      Alert.alert(t("success.title"), t("success.message"), [
        {
          text: t("success.button"),
          onPress: () => router.back(),
        },
      ]);
    },
    onError: (_error) => {
      Alert.alert(t("error.title"), t("error.message"));
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      type: "bug_report",
      title: "",
      description: "",
    },
  });

  function onSubmit(data: FeedbackFormData) {
    submitMutation.mutate(data);
  }

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        { backgroundColor: useThemeColor({}, "background") },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title={t("header.title")}
          titleStyle={Typography.titleMd}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            {t("header.subtitle")}
          </Text>

          <SectionTitle title={t("type.title")} textColor={textColor} />
          <Controller
            control={control}
            name="type"
            render={({ field: { onChange, value } }) => (
              <OptionChips
                options={typeOptions}
                selected={value}
                onSelect={onChange}
                layout="wrap"
              />
            )}
          />
          {errors.type && (
            <Text
              style={[
                Typography.caption,
                { color: errorColor },
                styles.errorText,
              ]}
            >
              {errors.type.message}
            </Text>
          )}

          <SectionTitle title={t("title.label")} textColor={textColor} />
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: inputFill, color: textColor },
                    errors.title && { borderColor: errorColor, borderWidth: 1 },
                  ]}
                  placeholder={t("title.placeholder")}
                  placeholderTextColor={textMuted}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  maxLength={100}
                  accessibilityLabel={t("title.label")}
                />
                <Text
                  style={[
                    Typography.caption,
                    { color: textMuted },
                    styles.charCount,
                  ]}
                >
                  {value.length}/100
                </Text>
              </View>
            )}
          />
          {errors.title && (
            <Text
              style={[
                Typography.caption,
                { color: errorColor },
                styles.errorText,
              ]}
            >
              {t(errors.title.message as FeedbackValidationKey)}
            </Text>
          )}

          <SectionTitle title={t("description.label")} textColor={textColor} />
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.descriptionContainer}>
                <TextInput
                  style={[
                    styles.descriptionInput,
                    { backgroundColor: inputFill, color: textColor },
                    errors.description && {
                      borderColor: errorColor,
                      borderWidth: 1,
                    },
                  ]}
                  placeholder={t("description.placeholder")}
                  placeholderTextColor={textMuted}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  numberOfLines={5}
                  maxLength={2000}
                  textAlignVertical="top"
                  accessibilityLabel={t("description.label")}
                />
                <Text
                  style={[
                    Typography.caption,
                    { color: textMuted },
                    styles.charCount,
                  ]}
                >
                  {value.length}/2000
                </Text>
              </View>
            )}
          />
          {errors.description && (
            <Text
              style={[
                Typography.caption,
                { color: errorColor },
                styles.errorText,
              ]}
            >
              {t(errors.description.message as FeedbackValidationKey)}
            </Text>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>

        <View
          style={[
            styles.ctaContainer,
            { backgroundColor: useThemeColor({}, "background") },
          ]}
        >
          <Button
            label={isSubmitting ? t("submit.sending") : t("submit.button")}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            accessibilityLabel={t("submit.button")}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({
  title,
  textColor,
}: {
  title: string;
  textColor: string;
}) {
  return (
    <Text
      style={[Typography.titleSm, { color: textColor }, styles.sectionTitle]}
    >
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.lg },
  subtitle: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing.md,
  },
  input: {
    marginHorizontal: Spacing.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    minHeight: 44,
    fontSize: 16,
  },
  descriptionContainer: {
    marginHorizontal: Spacing.xl,
  },
  descriptionInput: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    minHeight: 120,
    fontSize: 16,
  },
  charCount: {
    textAlign: "right",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  errorText: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
  },
  ctaContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  bottomPadding: { height: Spacing.lg },
});
