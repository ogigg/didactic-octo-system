import * as Linking from "expo-linking";
import { AppleSignInButton } from "@/components/auth/apple-sign-in-button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
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
import { normalizeAuthError, trackEvent } from "@/lib/track-event";
import { supabase } from "@/lib/supabase";
import {
  type AuthValidationKey,
  type SignUpFormData,
  signUpSchema,
} from "@/lib/schemas/auth";

export default function SignUpScreen() {
  const { t } = useTranslation("auth");
  const [authError, setAuthError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function resend() {
    if (!successEmail || resending || cooldown > 0) return;
    setResending(true);
    setAuthError(null);
    setResent(false);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: successEmail,
        options: {
          emailRedirectTo: Linking.createURL("", { scheme: "sweaty" }),
        },
      });
      if (error) throw error;
      setResent(true);
      setCooldown(60);
    } catch {
      setAuthError(t("errors.generic"));
    } finally {
      setResending(false);
    }
  }

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
    trackEvent("signup_started", { auth_method: "email" });
    try {
      const { error, data: authData } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: Linking.createURL("", { scheme: "sweaty" }),
        },
      });

      if (error) {
        trackEvent("signup_failed", {
          auth_method: "email",
          error_code: normalizeAuthError(error),
          failure_stage: "password",
        });
        setAuthError(
          error.message.toLowerCase().includes("already")
            ? t("errors.emailAlreadyInUse")
            : t("errors.generic")
        );
        return;
      }

      // If email confirmation is required, identities will be empty or session null
      trackEvent("user_signed_up", {
        auth_method: "email",
        is_email_confirmation_required: !authData.session,
      });
      if (!authData.session) {
        setSuccessEmail(data.email);
        setCooldown(60);
      }
    } catch {
      setAuthError(t("errors.networkError"));
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
        {authError && (
          <Text accessibilityRole="alert" style={{ color: errorColor }}>
            {authError}
          </Text>
        )}
        {resent && (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: textSecondary }}
          >
            {t("signUp.resent")}
          </Text>
        )}
        <Button
          label={
            cooldown > 0
              ? t("signUp.resendCountdown", { seconds: cooldown })
              : t("signUp.resend")
          }
          onPress={resend}
          loading={resending}
          disabled={cooldown > 0}
        />
        <Button
          variant="secondary"
          label={t("signUp.changeEmail")}
          disabled={resending}
          onPress={() => {
            setSuccessEmail(null);
            setAuthError(null);
            setResent(false);
          }}
        />
        <Button
          variant="ghost"
          label={t("signUp.signInLink")}
          onPress={() => router.replace("/(auth)/sign-in")}
        />
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
                  textContentType="emailAddress"
                  autoComplete="email"
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
                {t(errors.email.message as AuthValidationKey)}
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
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  returnKeyType="done"
                  accessibilityLabel={t("signUp.passwordLabel")}
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

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPassword(!showPassword)}
            style={styles.reveal}
          >
            <Text style={[Typography.body, { color: primary }]}>
              {t(showPassword ? "signUp.hidePassword" : "signUp.showPassword")}
            </Text>
          </Pressable>

          <Button
            label={t("signUp.submitButton")}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            loading={isSubmitting}
            accessibilityLabel={t("signUp.submitButton")}
          />

          <Text style={[Typography.caption, { color: textSecondary }]}>
            {t("signIn.divider")}
          </Text>
          <AppleSignInButton />
          <GoogleSignInButton />
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
  reveal: { minHeight: 44, justifyContent: "center" },
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
