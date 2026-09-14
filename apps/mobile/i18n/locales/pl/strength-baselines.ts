export const strengthBaselines = {
  exercises: {
    pushups: "Pompki",
    pullups: "Podciąganie",
    db_bench: "Wyciskanie hantli",
    db_row: "Wiosłowanie hantlą",
    bb_bench: "Wyciskanie sztangi",
    bb_squat: "Przysiad ze sztangą",
    deadlift: "Martwy ciąg",
  },
  form: {
    guidance:
      "Podaj niedawną serię roboczą, nie próbę maksymalną. Dla hantli podaj ciężar jednej hantli, dla sztangi uwzględnij gryf. Nieznane ćwiczenia pozostaw puste. Wpisz 0 powtórzeń, jeśli nie potrafisz jeszcze wykonać ćwiczenia z masą ciała.",
    reps: "Powtórzenia",
    loadLabel: "{{exercise}} — ciężar w {{unit}}",
    repsLabel: "{{exercise}} — liczba powtórzeń",
    pairError:
      "Podaj nieujemny ciężar i 1–999 pełnych powtórzeń lub wyczyść oba pola.",
    repsError: "Podaj 0–999 pełnych powtórzeń lub pozostaw puste pole.",
  },

  header: {
    title: "Moje poziomy siły",
  },
  subtitle: "Pomagają AI dobrać odpowiednie ciężary.",
  skipHint: "Zostaw puste pola, aby pominąć - AI oszacuje ostrożnie.",
  save: {
    button: "Zapisz",
    saving: "Zapisywanie...",
  },
  success: "Poziomy siły zaktualizowane!",
  retry: "Spróbuj ponownie",
  error: "Nie udało się zapisać. Spróbuj ponownie.",
} as const;
