import { resources } from "../resources";

const polishDiacritics = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.values(value).flatMap(collectStrings);
}

describe("Polish locale resources", () => {
  it("preserves Polish diacritics in app copy", () => {
    const strings = collectStrings(resources.pl);

    expect(strings.some((value) => polishDiacritics.test(value))).toBe(true);
    expect(resources.pl.auth.signIn.subtitle).toBe(
      "Zaloguj się, aby kontynuować"
    );
    expect(resources.pl.workout.summary.stats.exercises).toBe("Ćwiczenia");
    expect(resources.pl.exercisePicker.search.placeholder).toBe(
      "Szukaj ćwiczeń..."
    );
    expect(resources.pl.profile.stats.trainingsCompleted).toBe(
      "UKOŃCZONE TRENINGI"
    );
    expect(resources.pl.accountSettings.accessibility.back).toBe("Wróć");
    expect(resources.pl.deleteAccount.accessibility.back).toBe("Wróć");
    expect(resources.pl.subscription.screen.backAccessibilityLabel).toBe(
      "Wróć"
    );
    expect(resources.en.deleteAccount.retention.body).toContain(
      "user-owned app data"
    );
    expect(resources.en.deleteAccount.retention.body).not.toContain("legal");
    expect(resources.pl.deleteAccount.retention.body).toContain(
      "dane aplikacji należące do użytkownika"
    );
  });
});
