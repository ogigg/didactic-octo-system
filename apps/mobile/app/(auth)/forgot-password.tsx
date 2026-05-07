import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/supabase";
import {
  type AuthValidationKey,
  type ForgotPasswordFormData,
  forgotPasswordSchema,
} from "@/lib/schemas/auth";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation("auth");
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const inputFill = useThemeColor({}, "inputFill");
  const errorColor = useThemeColor({}, "error");
  const primarySurface = useThemeColor({}, "primarySurface");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordFormData) {
    setAuthError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: "mobile://reset-password",
    });

    if (error) {
      setAuthError(t("errors.generic"));
      return;
    }

    setSuccessEmail(data.email);
  }

  if (successEmail) {
    return (
      <SafeAreaView style={styles.successContainer}>
        <AmbientGlow variant="hero" />
        <Text
          style={[Typography.displayLg, { color: textColor }]}
          accessibilityRole="header"
        >
          {t("forgotPassword.successTitle")}
        </Text>
        <Text
          style={[Typography.body, { color: textSecondary }, styles.subtitle]}
        >
          {t("forgotPassword.successBody", { email: successEmail })}
        </Text>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ pressed }) => [
              styles.backLink,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[Typography.body, { color: primary }]}>
              {t("forgotPassword.backToSignIn")}
            </Text>
          </Pressable>
        </Link>
      </SafeAreaView>
    );
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
            {t("forgotPassword.title")}
          </Text>
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            {t("forgotPassword.subtitle")}
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
              {t("forgotPassword.emailLabel")}
            </Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: inputFill, color: textColor },
                    errors.email && { borderColor: errorColor, borderWidth: 1 },
                  ]}
                  placeholder={t("forgotPassword.emailPlaceholder")}
                  placeholderTextColor={textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="done"
                  accessibilityLabel={t("forgotPassword.emailLabel")}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
              )}
            />
            {errors.email && (
              <Text style={[Typography.caption, { color: errorColor }]}>
                {t(errors.email.message as AuthValidationKey)}
              </Text>
            )}
          </View>

          <Button
            label={t("forgotPassword.submitButton")}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            accessibilityLabel={t("forgotPassword.submitButton")}
          />

          <Link href="/(auth)/sign-in" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.backLink,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[Typography.body, { color: primary }]}>
                {t("forgotPassword.backToSignIn")}
              </Text>
            </Pressable>
          </Link>
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
  successContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["3xl"],
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
  backLink: { alignItems: "center", marginTop: Spacing.sm },
});
