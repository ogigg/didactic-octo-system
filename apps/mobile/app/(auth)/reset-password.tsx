import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/supabase";
import {
  type AuthValidationKey,
  type ResetPasswordFormData,
  resetPasswordSchema,
} from "@/lib/schemas/auth";
import { useOnboardingStore } from "@/stores/onboarding-store";

export default function ResetPasswordScreen() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { isCompleted } = useOnboardingStore();
  const [authError, setAuthError] = useState<string | null>(null);

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const inputFill = useThemeColor({}, "inputFill");
  const errorColor = useThemeColor({}, "error");
  const primarySurface = useThemeColor({}, "primarySurface");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  async function onSubmit(data: ResetPasswordFormData) {
    setAuthError(null);
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error) {
      setAuthError(t("errors.generic"));
      return;
    }

    // Navigate based on onboarding state
    if (isAuthenticated && isCompleted) {
      router.replace("/(tabs)");
    } else {
      router.replace("/");
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <AmbientGlow variant="hero" />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={[Typography.displayLg, { color: textColor }]}
            accessibilityRole="header"
          >
            {t("resetPassword.title")}
          </Text>
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            {t("resetPassword.subtitle")}
          </Text>

          {authError && (
            <View
              style={[styles.errorBanner, { backgroundColor: primarySurface }]}
              accessibilityRole="alert"
            >
              <Text style={[Typography.body, { color: errorColor }]}>
                {authError}
              </Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={[Typography.label, { color: textSecondary }]}>
              {t("resetPassword.passwordLabel")}
            </Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: inputFill, color: textColor },
                    errors.password && {
                      borderColor: errorColor,
                      borderWidth: 1,
                    },
                  ]}
                  placeholder={t("resetPassword.passwordPlaceholder")}
                  placeholderTextColor={textMuted}
                  secureTextEntry
                  returnKeyType="next"
                  accessibilityLabel={t("resetPassword.passwordLabel")}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                />
              )}
            />
            {errors.password && (
              <Text style={[Typography.caption, { color: errorColor }]}>
                {t(errors.password.message as AuthValidationKey)}
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[Typography.label, { color: textSecondary }]}>
              {t("resetPassword.confirmPasswordLabel")}
            </Text>
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: inputFill, color: textColor },
                    errors.confirmPassword && {
                      borderColor: errorColor,
                      borderWidth: 1,
                    },
                  ]}
                  placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                  placeholderTextColor={textMuted}
                  secureTextEntry
                  returnKeyType="done"
                  accessibilityLabel={t("resetPassword.confirmPasswordLabel")}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
              )}
            />
            {errors.confirmPassword && (
              <Text style={[Typography.caption, { color: errorColor }]}>
                {t(errors.confirmPassword.message as AuthValidationKey)}
              </Text>
            )}
          </View>

          <Button
            label={t("resetPassword.submitButton")}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            accessibilityLabel={t("resetPassword.submitButton")}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["3xl"],
    paddingBottom: Spacing["3xl"],
    gap: Spacing.lg,
  },
  subtitle: { marginTop: Spacing.xs },
  errorBanner: {
    borderRadius: Radii.md,
    padding: Spacing.lg,
  },
  field: { gap: Spacing.xs },
  input: {
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
});
