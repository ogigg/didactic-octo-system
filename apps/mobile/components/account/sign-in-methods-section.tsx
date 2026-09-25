import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import type { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getListRowPosition,
  ListGroup,
  ListRow,
} from "@/components/ui/list-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Spacing } from "@/constants/theme";
import type { AccountSignIn, SignInProvider } from "@/lib/account-sign-in";

type IconName = Parameters<typeof IconSymbol>[0]["name"];

const PROVIDER_ICONS: Record<SignInProvider, IconName> = {
  apple: "apple.logo",
  google: "g.circle.fill",
  email: "lock.fill",
};

interface SignInMethodsSectionProps {
  /** Null while the account loads or when it failed to load. */
  account: AccountSignIn | null;
  onPasswordPress: () => void;
}

/**
 * Lists the linked sign-in methods and the account email. Until the account
 * loads (or when it fails to), only a neutral password row is shown, so the
 * screen never claims a method the account doesn't have. The password row is
 * always first, so provider rows arriving after load never move it.
 */
export function SignInMethodsSection({
  account,
  onPasswordPress,
}: SignInMethodsSectionProps) {
  const { t } = useTranslation("accountSettings");

  const oauthProviders =
    account?.providers.filter((provider) => provider !== "email") ?? [];
  const rowCount = oauthProviders.length + 1;
  const hasPassword = account?.providers.includes("email") ?? false;

  const statusLabel = (provider: SignInProvider) =>
    account?.lastUsedProvider === provider
      ? t("signIn.status.lastUsed")
      : t("signIn.status.linked");
  const statusTone = (provider: SignInProvider) =>
    account?.lastUsedProvider === provider ? "accent" : "neutral";

  const subtitle = account?.email
    ? account.isApplePrivateRelay
      ? t("signIn.signedInAsHiddenApple", { email: account.email })
      : t("signIn.signedInAs", { email: account.email })
    : undefined;

  const passwordAction = hasPassword
    ? t("password.changeLabel")
    : t("password.setLabel");
  const passwordStatus = hasPassword
    ? statusLabel("email")
    : t("signIn.status.notSetUp");
  const passwordMethod = t("signIn.providers.email");

  return (
    <View style={styles.section}>
      <SectionHeader title={t("sections.signIn")} subtitle={subtitle} />
      <ListGroup>
        {account ? (
          <ListRow
            icon={PROVIDER_ICONS.email}
            label={passwordMethod}
            description={passwordAction}
            onPress={onPasswordPress}
            accessibilityLabel={`${passwordAction}, ${passwordMethod}, ${passwordStatus}`}
            trailing={
              <Badge label={passwordStatus} tone={statusTone("email")} />
            }
            position={getListRowPosition(0, rowCount)}
          />
        ) : (
          <ListRow
            icon={PROVIDER_ICONS.email}
            label={t("password.label")}
            onPress={onPasswordPress}
            position="only"
          />
        )}
        {oauthProviders.map((provider, index) => (
          <ListRow
            key={provider}
            icon={PROVIDER_ICONS[provider]}
            label={t(`signIn.providers.${provider}`)}
            trailing={
              <Badge
                label={statusLabel(provider)}
                tone={statusTone(provider)}
              />
            }
            position={getListRowPosition(index + 1, rowCount)}
          />
        ))}
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.md,
  },
});
