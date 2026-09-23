import Foundation

/// Realistic data for the widget gallery and placeholders, shown before the
/// app has published a snapshot. Follows the device language (en or pl).
enum HomeWidgetSample {
  static func snapshot(now: Date = Date()) -> HomeWidgetSnapshot {
    let pl = Locale.preferredLanguages.first?.hasPrefix("pl") ?? false
    func copy(_ english: String, _ polish: String) -> String { pl ? polish : english }

    let weekStart = HomeWidgetCalendar.startOfWeek(for: now)
    let today = HomeWidgetCalendar.calendar.startOfDay(for: now)
    // Mon–Sun per week, oldest first; one missed week keeps the streak at 5.
    let pattern: [[Bool]] = [
      [false, true, false, true, false, false, false],
      [true, false, false, false, true, false, false],
      [false, true, false, true, false, false, true],
      [true, false, true, false, false, false, false],
      [true, false, false, true, false, false, false],
      [true, false, true, false, false, true, false],
      [false, false, false, false, false, false, false],
      [true, false, true, false, true, false, false],
      [true, false, false, true, false, false, false],
      [true, false, true, false, false, true, false],
      [false, true, false, false, true, false, false],
      [true, false, true, false, false, false, false],
    ]
    var days: [HomeWidgetSnapshot.ActivityDay] = []
    for (weekIndex, week) in pattern.enumerated() {
      let start = HomeWidgetCalendar.adding(days: -7 * (pattern.count - 1 - weekIndex), to: weekStart)
      for (dayIndex, trained) in week.enumerated() {
        let date = HomeWidgetCalendar.adding(days: dayIndex, to: start)
        days.append(.init(date: HomeWidgetCalendar.key(for: date), trained: trained && date <= today))
      }
    }
    let minutes = [95, 120, 0, 135, 110, 146, 90, 97]
    let weeks = minutes.enumerated().map { index, value in
      HomeWidgetSnapshot.WeekMinutes(
        weekStart: HomeWidgetCalendar.key(
          for: HomeWidgetCalendar.adding(days: -7 * (minutes.count - 1 - index), to: weekStart)
        ),
        minutes: value
      )
    }
    let exercises: [HomeWidgetSnapshot.ExerciseRow] = [
      .init(name: copy("Barbell bench press", "Wyciskanie sztangi na ławce płaskiej"), detail: "4 × 8"),
      .init(name: copy("Dumbbell shoulder press", "Wyciskanie hantli nad głowę"), detail: "3 × 10"),
      .init(name: copy("Incline dumbbell press", "Wyciskanie hantli na ławce skośnej"), detail: "3 × 10"),
      .init(name: copy("Dumbbell lateral raise", "Wznosy hantli bokiem"), detail: "3 × 15"),
      .init(name: copy("Parallel bar dips", "Pompki na poręczach"), detail: "3 × 10"),
      .init(name: copy("Cable triceps pushdown", "Prostowanie ramion na wyciągu"), detail: "3 × 12"),
    ]

    return HomeWidgetSnapshot(
      version: HomeWidgetSnapshot.supportedVersion,
      generatedAt: ISO8601DateFormatter().string(from: now),
      language: pl ? "pl" : "en",
      status: "ready",
      message: nil,
      dayLetters: copy("M T W T F S S", "P W Ś C P S N").components(separatedBy: " "),
      next: .init(
        state: "ready",
        deepLink: nil,
        eyebrow: copy("Next workout", "Następny trening"),
        eyebrowShort: copy("Next", "Następny"),
        upNext: copy("Up next", "Dalej"),
        title: copy("Push · chest & shoulders", "Push · klatka i barki"),
        shortTitle: "Push",
        focus: "Push",
        meta: copy("6 exercises · about 45 min", "6 ćwiczeń · ok. 45 min"),
        metaShort: copy("6 ex. · 45 min", "6 ćw. · 45 min"),
        inline: copy("Next: Push · 45 min", "Dalej: Push · 45 min"),
        exercises: exercises,
        moreExercises: nil,
        action: copy("Open workout", "Otwórz trening"),
        actionShort: copy("Open", "Otwórz")
      ),
      week: .init(
        weekStart: HomeWidgetCalendar.key(for: weekStart),
        done: 2,
        target: 3,
        of: copy("of", "z"),
        thisWeekShort: copy("this wk", "w tym tyg."),
        ringCaptionShort: copy("wk", "tydz.")
      ),
      streak: .init(
        weeks: 5,
        longestWeeks: 8,
        label: copy("Streak", "Seria"),
        unit: copy("weeks", "tygodni"),
        unitShort: copy("wk", "tyg."),
        title: copy("5 week streak", "5 tygodni serii"),
        inline: copy("5 wk streak", "5 tyg. serii"),
        longest: copy("Longest: 8 wk", "Najdłuższa: 8 tyg."),
        freezes: copy("1 freeze saved", "1 zamrożenie w zapasie"),
        startTitle: copy("Start a streak", "Zacznij serię")
      ),
      consistency: .init(
        days: days,
        label: copy("Consistency", "Regularność"),
        windowShort: copy("Consistency · 8 wk", "Regularność · 8 tyg."),
        sessionsShort: 17,
        sessionsShortUnit: copy("workouts", "treningów"),
        averageShort: copy("2.1 per week on average", "średnio 2,1 w tygodniu"),
        sessionsLong: 26,
        sessionsLongUnit: copy("workouts", "treningów"),
        inLastWeeks: copy("in the last 12 weeks", "w ostatnich 12 tygodniach"),
        weeksLong: copy("12 weeks", "12 tygodni"),
        averageLongValue: copy("2.2", "2,2"),
        averageLongCaption: copy("avg. per week", "średnio w tyg."),
        currentStreakValue: copy("5 wk", "5 tyg."),
        currentStreakCaption: copy("current streak", "obecna seria"),
        longestStreakValue: copy("8 wk", "8 tyg."),
        longestStreakCaption: copy("longest streak", "najdłuższa seria")
      ),
      trainingTime: .init(
        weeks: weeks,
        label: copy("Training time", "Czas treningu"),
        window: copy("Time · 8 wk", "Czas · 8 tyg."),
        weeksLabel: copy("8 weeks", "8 tygodni"),
        minutesUnit: "min",
        thisWeek: copy("this week", "w tym tygodniu"),
        averageMinutes: 99,
        average: copy("Avg. 99 min", "Średnio 99 min"),
        averageInline: copy("avg. 99 min", "średnio 99 min"),
        totalHours: copy("13.2 h", "13,2 h"),
        totalCaption: copy("total in 8 wk", "łącznie w 8 tyg."),
        bestWeek: "146 min",
        bestWeekCaption: copy("best week", "najlepszy tydzień"),
        totalWorkouts: 48,
        totalWorkoutsCaption: copy("workouts in total", "treningów łącznie"),
        lastPrefix: copy("Last", "Ostatni"),
        lastWorkout: .init(
          name: "Pull",
          completedAt: ISO8601DateFormatter().string(from: now.addingTimeInterval(-2 * 3600)),
          minutes: "52 min"
        )
      )
    )
  }
}
