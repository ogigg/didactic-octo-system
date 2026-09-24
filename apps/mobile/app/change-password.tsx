import { zodResolver } from "@hookform/resolvers/zod";
import * as AppleAuthentication from "expo-apple-authentication";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, type Control, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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
import { GradientSurface } from "@/components/ui/gradient-surface";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  type AuthValidationKey,
  type ResetPasswordFormData,
  resetPasswordSchema,
} from "@/lib/schemas/auth";
import { supabase } from "@/lib/supabase";
import { useToastStore } from "@/stores/toast-store";

interface AccountInfo {
  email: string;
  hasApple: boolean;
  hasPassword: boolean;
  userId: string;
}

interface PasswordFieldProps {
  control: Control<ResetPasswordFormData>;
  errorColor: string;
  errorMessage?: string;
  inputFill: string;
  labelColor: string;
  label: string;
  name: "password" | "confirmPassword";
  onSubmit?: () => void;
  placeholder: string;
  textColor: string;
  textMuted: string;
}

function PasswordField({
  control,
  errorColor,
  errorMessage,
  inputFill,
  labelColor,
  label,
  name,
  onSubmit,
  placeholder,
  textColor,
  textMuted,
}: PasswordFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[Typography.label, { color: labelColor }]}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onBlur, onChange, value } }) => (
          <TextInput
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            placeholder={placeholder}
            placeholderTextColor={textMuted}
            secureTextEntry
            returnKeyType={onSubmit ? "done" : "next"}
            accessibilityLabel={label}
            style={[
              styles.input,
              { backgroundColor: inputFill, color: textColor },
              errorMessage ? { borderColor: errorColor, borderWidth: 1 } : null,
            ]}
          />
        )}
      />
      {errorMessage ? (
        <Text style={[Typography.caption, { color: errorColor }]}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

function authErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

export default function ChangePasswordScreen() {
  const { t } = useTranslation("accountSettings");
  const { t: tAuth } = useTranslation("auth");
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuth();
  const showSuccess = useToastStore((state) => state.showSuccess);

  const background = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const inputFill = useThemeColor({}, "inputFill");
  const errorColor = useThemeColor({}, "error");
  const primarySurface = useThemeColor({}, "primarySurface");

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [reauthMethod, setReauthMethod] = useState<"apple" | "code" | null>(
    null
  );
  const [nonce, setNonce] = useState("");

  const {
    control,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;
    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;

        const email = data.user?.email;
        if (error || !data.user || !email) {
          setAccountError(t("password.errors.load"));
          return;
        }

        const providers = data.user.identities?.map(({ provider }) => provider);
        setAccount({
          email,
          hasApple: providers?.includes("apple") ?? false,
          hasPassword: providers?.includes("email") ?? false,
          userId: data.user.id,
        });
      })
      .catch(() => {
        if (active) setAccountError(t("password.errors.load"));
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, t]);

  async function sendReauthenticationCode() {
    setAccountError(null);
    const { error } = await supabase.auth.reauthenticate().catch(() => ({
      error: new Error(),
    }));
    if (error) {
      setAccountError(t("password.errors.reauth"));
      return;
    }

    setReauthMethod("code");
  }

  async function updatePassword(password: string) {
    if (!account) return;

    setAccountError(null);
    const { data, error } = await supabase.auth
      .updateUser({
        password,
        ...(reauthMethod === "code" && nonce.trim()
          ? { nonce: nonce.trim() }
          : {}),
      })
      .catch(() => ({ data: { user: null }, error: new Error() }));

    if (error) {
      const code = authErrorCode(error);
      if (code === "weak_password") {
        setAccountError(t("password.errors.weak"));
      } else if (code === "same_password") {
        setAccountError(t("password.errors.same"));
      } else if (code === "reauthentication_needed") {
        if (account.hasApple && Platform.OS === "ios") {
          setReauthMethod("apple");
        } else {
          await sendReauthenticationCode();
        }
      } else if (
        code === "reauthentication_not_valid" ||
        code === "reauth_nonce_missing" ||
        code === "otp_expired"
      ) {
        setAccountError(t("password.errors.code"));
      } else if (
        code === "session_not_found" ||
        code === "refresh_token_not_found" ||
        error.name === "AuthSessionMissingError"
      ) {
        setAccountError(t("password.errors.session"));
      } else {
        setAccountError(t("password.errors.generic"));
      }
      return;
    }

    if (data.user?.id !== account.userId) {
      setAccountError(t("password.errors.generic"));
      return;
    }

    showSuccess(
      t(account.hasPassword ? "password.successChanged" : "password.successSet")
    );
    router.replace("/account-settings");
  }

  async function reauthenticateWithApple() {
    if (!account) return;

    setAccountError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) {
        setAccountError(t("password.errors.reauth"));
        return;
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) {
        setAccountError(t("password.errors.reauth"));
        return;
      }
      if (data.user?.id !== account.userId) {
        setAccountError(t("password.errors.accountMismatch"));
        return;
      }

      setReauthMethod(null);
      await updatePassword(getValues("password"));
    } catch {
      setAccountError(t("password.errors.reauth"));
    }
  }

  if (!isInitialized) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/sign-in" />;

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title={t("password.header")}
          titleStyle={Typography.titleMd}
          backAccessibilityLabel={t("accessibility.back")}
        />

        {!account && !accountError ? (
          <View style={styles.loading}>
            <ActivityIndicator
              accessibilityLabel={t("password.loading")}
              color={textMuted}
            />
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.safe}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {account ? (
                <>
                  <View style={styles.intro}>
                    <Text style={[Typography.titleLg, { color: textColor }]}>
                      {t(
                        account.hasPassword
                          ? "password.changeTitle"
                          : "password.setTitle"
                      )}
                    </Text>
                    <Text style={[Typography.body, { color: textSecondary }]}>
                      {t(
                        account.hasPassword
                          ? "password.changeBody"
                          : "password.setBody"
                      )}
                    </Text>
                  </View>

                  <GradientSurface
                    variant="surface"
                    bordered
                    style={styles.emailCard}
                  >
                    <Text style={[Typography.label, { color: textSecondary }]}>
                      {t("password.emailLabel")}
                    </Text>
                    <Text
                      selectable
                      style={[Typography.bodyMedium, { color: textColor }]}
                    >
                      {account.email}
                    </Text>
                    {account.hasApple ? (
                      <Text
                        style={[Typography.caption, { color: textSecondary }]}
                      >
                        {t("password.appleNote")}
                      </Text>
                    ) : null}
                  </GradientSurface>

                  {accountError ? (
                    <View
                      accessibilityRole="alert"
                      style={[
                        styles.errorBanner,
                        { backgroundColor: primarySurface },
                      ]}
                    >
                      <Text style={[Typography.body, { color: errorColor }]}>
                        {accountError}
                      </Text>
                    </View>
                  ) : null}

                  {reauthMethod === "apple" ? (
                    <GradientSurface
                      variant="surface"
                      bordered
                      style={styles.reauthCard}
                    >
                      <Text style={[Typography.body, { color: textSecondary }]}>
                        {t("password.reauthApple")}
                      </Text>
                      <Button
                        label={t("password.reauthAppleButton")}
                        onPress={() => void reauthenticateWithApple()}
                        variant="secondary"
                      />
                    </GradientSurface>
                  ) : null}

                  {reauthMethod === "code" ? (
                    <GradientSurface
                      variant="surface"
                      bordered
                      style={styles.reauthCard}
                    >
                      <Text style={[Typography.body, { color: textSecondary }]}>
                        {t("password.reauthCode")}
                      </Text>
                      <Text
                        style={[Typography.label, { color: textSecondary }]}
                      >
                        {t("password.reauthCodeLabel")}
                      </Text>
                      <TextInput
                        value={nonce}
                        onChangeText={setNonce}
                        placeholder={t("password.reauthCodePlaceholder")}
                        placeholderTextColor={textMuted}
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        autoComplete="one-time-code"
                        accessibilityLabel={t("password.reauthCodeLabel")}
                        style={[
                          styles.input,
                          { backgroundColor: inputFill, color: textColor },
                        ]}
                      />
                      <Button
                        label={t("password.requestNewCode")}
                        onPress={() => void sendReauthenticationCode()}
                        variant="ghost"
                      />
                    </GradientSurface>
                  ) : null}

                  <PasswordField
                    control={control}
                    errorColor={errorColor}
                    errorMessage={
                      errors.password?.message
                        ? tAuth(errors.password.message as AuthValidationKey)
                        : undefined
                    }
                    inputFill={inputFill}
                    labelColor={textSecondary}
                    label={t("password.newPasswordLabel")}
                    name="password"
                    placeholder={t("password.placeholder")}
                    textColor={textColor}
                    textMuted={textMuted}
                  />
                  <PasswordField
                    control={control}
                    errorColor={errorColor}
                    errorMessage={
                      errors.confirmPassword?.message
                        ? tAuth(
                            errors.confirmPassword.message as AuthValidationKey
                          )
                        : undefined
                    }
                    inputFill={inputFill}
                    labelColor={textSecondary}
                    label={t("password.confirmPasswordLabel")}
                    name="confirmPassword"
                    onSubmit={handleSubmit(({ password }) =>
                      updatePassword(password)
                    )}
                    placeholder={t("password.placeholder")}
                    textColor={textColor}
                    textMuted={textMuted}
                  />

                  <Button
                    label={t(
                      account.hasPassword
                        ? "password.changeButton"
                        : "password.setButton"
                    )}
                    onPress={handleSubmit(({ password }) =>
                      updatePassword(password)
                    )}
                    disabled={
                      reauthMethod === "apple" ||
                      (reauthMethod === "code" && !nonce.trim())
                    }
                    loading={isSubmitting}
                  />
                </>
              ) : (
                <View
                  accessibilityRole="alert"
                  style={[
                    styles.errorBanner,
                    { backgroundColor: primarySurface },
                  ]}
                >
                  <Text style={[Typography.body, { color: errorColor }]}>
                    {accountError}
                  </Text>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing["3xl"],
    gap: Spacing.lg,
  },
  intro: { gap: Spacing.sm },
  emailCard: { padding: Spacing.lg, gap: Spacing.xs },
  errorBanner: { borderRadius: Radii.md, padding: Spacing.lg },
  reauthCard: { padding: Spacing.lg, gap: Spacing.md },
  field: { gap: Spacing.xs },
  input: {
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
});
