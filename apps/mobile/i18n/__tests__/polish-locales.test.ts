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

function collectKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    collectKeys(nestedValue, prefix ? `${prefix}.${key}` : key)
  );
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
    expect(resources.pl.deleteAccount.retention.body).toContain(
      "dane aplikacji należące do użytkownika"
    );
    expect(resources.pl.widgets.status.signedOut).toBe(
      "Zaloguj się w Sweaty, aby zobaczyć swoje treningi"
    );
    expect(resources.pl.widgets.dayLetters).toBe("P W Ś C P S N");
    expect(resources.pl.widgets.streak.freezes_many).toBe(
      "{{count}} zamrożeń w zapasie"
    );
  });

  it("contains every English translation key", () => {
    const polishKeys = new Set(collectKeys(resources.pl));
    const missingKeys = collectKeys(resources.en).filter(
      (key) => !polishKeys.has(key)
    );

    expect(missingKeys).toEqual([]);
  });
});
