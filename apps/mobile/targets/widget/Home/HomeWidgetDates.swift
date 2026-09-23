import Foundation

enum HomeWidgetDayState {
  case trained
  case rest
  case today
  case todayTrained
  case future
}

struct HomeWidgetGridWeek: Identifiable {
  let id: String
  let start: Date
  let days: [HomeWidgetDayState]
}

/// Local, Monday-first calendar math matching the app's calendar screens.
enum HomeWidgetCalendar {
  /// Built per use so a long-lived extension process follows time-zone changes.
  static var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.firstWeekday = 2
    calendar.timeZone = .autoupdatingCurrent
    return calendar
  }

  static func key(for date: Date) -> String {
    let components = calendar.dateComponents([.year, .month, .day], from: date)
    return String(
      format: "%04d-%02d-%02d",
      components.year ?? 0,
      components.month ?? 0,
      components.day ?? 0
    )
  }

  static func startOfWeek(for date: Date) -> Date {
    let day = calendar.startOfDay(for: date)
    let weekday = calendar.component(.weekday, from: day)
    let offset = (weekday + 5) % 7
    return calendar.date(byAdding: .day, value: -offset, to: day) ?? day
  }

  static func adding(days: Int, to date: Date) -> Date {
    calendar.date(byAdding: .day, value: days, to: date) ?? date
  }

  static func nextMidnight(after date: Date) -> Date {
    adding(days: 1, to: calendar.startOfDay(for: date))
  }

  static func shortDayMonth(_ date: Date, language: String) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: language)
    formatter.setLocalizedDateFormatFromTemplate("dM")
    return formatter.string(from: date)
  }

  /// "today", "yesterday", "3 days ago" in the snapshot's language.
  static func relativeDay(_ date: Date, now: Date, language: String) -> String {
    let days = calendar.dateComponents(
      [.day],
      from: calendar.startOfDay(for: date),
      to: calendar.startOfDay(for: now)
    ).day ?? 0
    let formatter = RelativeDateTimeFormatter()
    formatter.locale = Locale(identifier: language)
    formatter.dateTimeStyle = .named
    formatter.unitsStyle = .full
    return formatter.localizedString(from: DateComponents(day: -max(0, days)))
  }
}

/// Resolves the snapshot against the widget's timeline date, so the "today"
/// marker, future days and a newly started week stay correct even when the app
/// has not published since.
struct HomeWidgetResolved {
  let snapshot: HomeWidgetSnapshot
  let now: Date

  private var currentWeekStart: Date { HomeWidgetCalendar.startOfWeek(for: now) }

  private var isSnapshotWeekCurrent: Bool {
    snapshot.week.weekStart == HomeWidgetCalendar.key(for: currentWeekStart)
  }

  var weekDone: Int { isSnapshotWeekCurrent ? snapshot.week.done : 0 }
  var weekTarget: Int { max(1, snapshot.week.target) }
  var weekFraction: Double { min(1, Double(weekDone) / Double(weekTarget)) }
  var weekCompact: String { "\(weekDone)/\(weekTarget)" }
  var weekProgress: String { "\(weekDone) \(snapshot.week.of) \(weekTarget)" }

  func grid(weeks: Int) -> [HomeWidgetGridWeek] {
    let trained = Dictionary(
      snapshot.consistency.days.map { ($0.date, $0.trained) },
      uniquingKeysWith: { first, second in first || second }
    )
    let todayKey = HomeWidgetCalendar.key(for: now)
    let today = HomeWidgetCalendar.calendar.startOfDay(for: now)

    return (0..<weeks).map { weekIndex in
      let start = HomeWidgetCalendar.adding(days: -7 * (weeks - 1 - weekIndex), to: currentWeekStart)
      let days: [HomeWidgetDayState] = (0..<7).map { dayIndex in
        let date = HomeWidgetCalendar.adding(days: dayIndex, to: start)
        let key = HomeWidgetCalendar.key(for: date)
        let didTrain = trained[key] ?? false
        if key == todayKey { return didTrain ? .todayTrained : .today }
        if date > today { return .future }
        return didTrain ? .trained : .rest
      }
      return HomeWidgetGridWeek(id: HomeWidgetCalendar.key(for: start), start: start, days: days)
    }
  }

  var currentWeekDays: [HomeWidgetDayState] { grid(weeks: 1).first?.days ?? [] }

  var weeklyMinutes: [(start: Date, minutes: Int)] {
    let minutes = Dictionary(
      snapshot.trainingTime.weeks.map { ($0.weekStart, $0.minutes) },
      uniquingKeysWith: { first, _ in first }
    )
    let count = max(1, snapshot.trainingTime.weeks.count)
    return (0..<count).map { index in
      let start = HomeWidgetCalendar.adding(days: -7 * (count - 1 - index), to: currentWeekStart)
      return (start, minutes[HomeWidgetCalendar.key(for: start)] ?? 0)
    }
  }

  var thisWeekMinutes: Int { weeklyMinutes.last?.minutes ?? 0 }

  func dayMonth(_ date: Date) -> String {
    HomeWidgetCalendar.shortDayMonth(date, language: snapshot.language)
  }

  var lastWorkoutLine: String? {
    let time = snapshot.trainingTime
    guard
      let last = time.lastWorkout,
      let completedAt = ISO8601DateFormatter.withFractionalSeconds.date(from: last.completedAt)
        ?? ISO8601DateFormatter().date(from: last.completedAt)
    else { return nil }
    let when = HomeWidgetCalendar.relativeDay(completedAt, now: now, language: snapshot.language)
    let parts = [when, last.name, last.minutes].filter { !$0.isEmpty }
    return "\(time.lastPrefix): \(parts.joined(separator: " · "))"
  }
}

extension ISO8601DateFormatter {
  static let withFractionalSeconds: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
}
