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

import { Button } from "@/components/ui/button";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/supabase";
import { type SignInFormData, signInSchema } from "@/lib/schemas/auth";
import { AppleSignInButton } from "@/components/auth/apple-sign-in-button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default function SignInScreen() {
  const { t } = useTranslation("auth");
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const inputFill = useThemeColor({}, "inputFill");
  const errorColor = useThemeColor({}, "error");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const primarySurface = useThemeColor({}, "primarySurface");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  async function onSubmit(data: SignInFormData) {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setAuthError(
        error.message.toLowerCase().includes("invalid")
          ? t("errors.invalidCredentials")
          : t("errors.generic")
      );
    }
    // Success handled by onAuthStateChange → auth store → index.tsx routing
  }

  return (
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
          {t("signIn.title")}
        </Text>
        <Text
          style={[Typography.body, { color: textSecondary }, styles.subtitle]}
        >
          {t("signIn.subtitle")}
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
            {t("signIn.emailLabel")}
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
                placeholder={t("signIn.emailPlaceholder")}
                placeholderTextColor={textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                accessibilityLabel={t("signIn.emailLabel")}
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
          <View style={styles.passwordRow}>
            <Text style={[Typography.label, { color: textSecondary }]}>
              {t("signIn.passwordLabel")}
            </Text>
            <Link href="/(auth)/forgot-password" asChild>
              <Pressable accessibilityRole="link">
                <Text style={[Typography.caption, { color: primary }]}>
                  {t("signIn.forgotPassword")}
                </Text>
              </Pressable>
            </Link>
          </View>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: inputFill, color: textColor },
                    errors.password && {
                      borderColor: errorColor,
                      borderWidth: 1,
                    },
                  ]}
                  placeholder={t("signIn.passwordPlaceholder")}
                  placeholderTextColor={textMuted}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  accessibilityLabel={t("signIn.passwordLabel")}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
                <Pressable
                  style={styles.eyeToggle}
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Text style={[Typography.caption, { color: textMuted }]}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>
            )}
          />
          {errors.password && (
            <Text style={[Typography.caption, { color: errorColor }]}>
              {t(errors.password.message as string)}
            </Text>
          )}
        </View>

        <Button
          label={t("signIn.submitButton")}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          accessibilityLabel={t("signIn.submitButton")}
        />

        {/* Social divider */}
        <View style={styles.divider}>
          <View
            style={[styles.dividerLine, { backgroundColor: borderSubtle }]}
          />
          <Text style={[Typography.caption, { color: textMuted }]}>
            {t("signIn.divider")}
          </Text>
          <View
            style={[styles.dividerLine, { backgroundColor: borderSubtle }]}
          />
        </View>

        <AppleSignInButton />
        <GoogleSignInButton />

        {/* Sign-up link */}
        <View style={styles.footer}>
          <Text style={[Typography.body, { color: textSecondary }]}>
            {t("signIn.noAccount")}
          </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable accessibilityRole="link">
              <Text style={[Typography.body, { color: primary }]}>
                {" "}
                {t("signIn.signUpLink")}
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  passwordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyeToggle: {
    position: "absolute",
    right: Spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginVertical: Spacing.xs,
  },
  dividerLine: { flex: 1, height: 1 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
});
