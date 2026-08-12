import { resources } from "../resources";

describe("Account deletion copy", () => {
  it("explains deleted data, retention, reversibility, and store billing in English", () => {
    const { deleteAccount, accountSettings } = resources.en;

    expect(deleteAccount.warning.body).toContain("14 days");
    expect(deleteAccount.warning.body).toContain("sign back in");
    expect(deleteAccount.consequences.items.account).toContain("account");
    expect(deleteAccount.consequences.items.history).toContain(
      "workout history"
    );
    expect(deleteAccount.retention.body).toContain("user-owned app data");
    expect(deleteAccount.retention.body).not.toContain("legal");
    expect(deleteAccount.retention.body).toContain("Apple or Google");
    expect(deleteAccount.subscription.body).toContain("does not cancel");
    expect(deleteAccount.finalConfirm.message).toContain("14 days");
    expect(deleteAccount.finalConfirm.message).toContain("Store billing");
    expect(accountSettings.difference.body).toContain("Signing out");
    expect(accountSettings.difference.body).toContain(
      "Cancelling a subscription"
    );
    expect(accountSettings.difference.body).toContain(
      "does not cancel subscriptions"
    );
  });

  it("identifies deletion controls as destructive in English and Polish", () => {
    expect(resources.en.accountSettings.deletion.accessibilityLabel).toContain(
      "destructive"
    );
    expect(resources.en.deleteAccount.cta.accessibilityLabel).toContain(
      "destructive"
    );
    expect(resources.en.deleteAccount.confirm.ariaLabel).toContain(
      "destructive"
    );
    expect(resources.pl.accountSettings.deletion.accessibilityLabel).toContain(
      "destrukcyjne"
    );
    expect(resources.pl.deleteAccount.cta.accessibilityLabel).toContain(
      "destrukcyjne"
    );
    expect(resources.pl.deleteAccount.confirm.ariaLabel).toContain(
      "destrukcyjne"
    );
  });

  it("keeps Polish copy aligned with deleted data, retention, and billing", () => {
    const { deleteAccount, accountSettings } = resources.pl;

    expect(deleteAccount.warning.body).toContain("14 dni");
    expect(deleteAccount.warning.body).toContain("zalogować się ponownie");
    expect(deleteAccount.retention.body).toContain(
      "dane aplikacji należące do użytkownika"
    );
    expect(deleteAccount.subscription.body).toContain("nie anuluje");
    expect(accountSettings.difference.body).toContain("Wylogowanie");
    expect(accountSettings.difference.body).toContain("Anulowanie subskrypcji");
    expect(accountSettings.difference.body).toContain(
      "nie anuluje subskrypcji"
    );
  });
});
