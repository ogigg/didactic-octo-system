import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/supabase";
import { type SignUpFormData, signUpSchema } from "@/lib/schemas/auth";

export default function SignUpScreen() {
  const { t } = useTranslation("auth");
  const [authError, setAuthError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

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
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  async function onSubmit(data: SignUpFormData) {
    setAuthError(null);
    const { error, data: authData } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setAuthError(
        error.message.toLowerCase().includes("already")
          ? t("errors.emailAlreadyInUse")
          : t("errors.generic")
      );
      return;
    }

    // If email confirmation is required, identities will be empty or session null
    if (!authData.session) {
      setSuccessEmail(data.email);
    }
    // Otherwise onAuthStateChange fires and index.tsx handles routing
  }

  if (successEmail) {
    return (
      <SafeAreaView style={styles.successContainer}>
        <AmbientGlow variant="hero" />
        <Text
          style={[Typography.displayLg, { color: textColor }]}
          accessibilityRole="header"
        >
          {t("signUp.checkEmail")}
        </Text>
        <Text
          style={[Typography.body, { color: textSecondary }, styles.subtitle]}
        >
          {t("signUp.checkEmailBody", { email: successEmail })}
        </Text>
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
            {t("signUp.title")}
          </Text>
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            {t("signUp.subtitle")}
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

          {/* Email */}
          <View style={styles.field}>
            <Text style={[Typography.label, { color: textSecondary }]}>
              {t("signUp.emailLabel")}
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
                  placeholder={t("signUp.emailPlaceholder")}
                  placeholderTextColor={textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  accessibilityLabel={t("signUp.emailLabel")}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                />
              )}
            />
            {errors.email && (
              <Text style={[Typography.caption, { color: errorColor }]}>
                {t(errors.email.message as string)}
              </Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={[Typography.label, { color: textSecondary }]}>
              {t("signUp.passwordLabel")}
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
                  placeholder={t("signUp.passwordPlaceholder")}
                  placeholderTextColor={textMuted}
                  secureTextEntry
                  returnKeyType="next"
                  accessibilityLabel={t("signUp.passwordLabel")}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                />
              )}
            />
            {errors.password && (
              <Text style={[Typography.caption, { color: errorColor }]}>
                {t(errors.password.message as string)}
              </Text>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.field}>
            <Text style={[Typography.label, { color: textSecondary }]}>
              {t("signUp.confirmPasswordLabel")}
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
                  placeholder={t("signUp.confirmPasswordPlaceholder")}
                  placeholderTextColor={textMuted}
                  secureTextEntry
                  returnKeyType="done"
                  accessibilityLabel={t("signUp.confirmPasswordLabel")}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
              )}
            />
            {errors.confirmPassword && (
              <Text style={[Typography.caption, { color: errorColor }]}>
                {t(errors.confirmPassword.message as string)}
              </Text>
            )}
          </View>

          <Button
            label={t("signUp.submitButton")}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            accessibilityLabel={t("signUp.submitButton")}
          />

          <View style={styles.footer}>
            <Text style={[Typography.body, { color: textSecondary }]}>
              {t("signUp.hasAccount")}
            </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Pressable
                accessibilityRole="link"
                style={({ pressed }) => pressed && { opacity: 0.7 }}
              >
                <Text style={[Typography.body, { color: primary }]}>
                  {" "}
                  {t("signUp.signInLink")}
                </Text>
              </Pressable>
            </Link>
          </View>
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
});
