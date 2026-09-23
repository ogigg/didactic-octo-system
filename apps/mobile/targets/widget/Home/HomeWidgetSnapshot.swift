import Foundation

// Mirrors lib/home-widgets/types.ts (version 1). All copy arrives already
// localized by the app; keep both files in sync when the contract changes.
struct HomeWidgetSnapshot: Codable {
  static let supportedVersion = 1

  let version: Int
  let generatedAt: String
  let language: String
  let status: String
  let message: String?
  let dayLetters: [String]
  let next: NextWorkout
  let week: Week
  let streak: Streak
  let consistency: Consistency
  let trainingTime: TrainingTime

  var isReady: Bool { status == "ready" }

  struct ExerciseRow: Codable {
    let name: String
    let detail: String
  }

  struct NextWorkout: Codable {
    let state: String
    let deepLink: String?
    let eyebrow: String
    let eyebrowShort: String
    let upNext: String
    let title: String
    let shortTitle: String
    let focus: String?
    let meta: String?
    let metaShort: String?
    let inline: String
    let exercises: [ExerciseRow]
    let moreExercises: String?
    let action: String
    let actionShort: String
  }

  struct Week: Codable {
    let weekStart: String
    let done: Int
    let target: Int
    let of: String
    let thisWeekShort: String
    let ringCaptionShort: String
  }

  struct Streak: Codable {
    let weeks: Int
    let longestWeeks: Int
    let label: String
    let unit: String
    let unitShort: String
    let title: String
    let inline: String
    let longest: String
    let freezes: String?
    let startTitle: String

    /// Title that still reads well before the first streak week.
    var displayTitle: String { weeks > 0 ? title : startTitle }
    var displayInline: String { weeks > 0 ? inline : startTitle }
  }

  struct ActivityDay: Codable {
    let date: String
    let trained: Bool
  }

  struct Consistency: Codable {
    let days: [ActivityDay]
    let label: String
    let windowShort: String
    let sessionsShort: Int
    let sessionsShortUnit: String
    let averageShort: String
    let sessionsLong: Int
    let sessionsLongUnit: String
    let inLastWeeks: String
    let weeksLong: String
    let averageLongValue: String
    let averageLongCaption: String
    let currentStreakValue: String
    let currentStreakCaption: String
    let longestStreakValue: String
    let longestStreakCaption: String
  }

  struct WeekMinutes: Codable {
    let weekStart: String
    let minutes: Int
  }

  struct LastWorkout: Codable {
    let name: String
    let completedAt: String
    let minutes: String
  }

  struct TrainingTime: Codable {
    let weeks: [WeekMinutes]
    let label: String
    let window: String
    let weeksLabel: String
    let minutesUnit: String
    let thisWeek: String
    let averageMinutes: Int
    let average: String
    let averageInline: String
    let totalHours: String
    let totalCaption: String
    let bestWeek: String
    let bestWeekCaption: String
    let totalWorkouts: Int?
    let totalWorkoutsCaption: String
    let lastPrefix: String
    let lastWorkout: LastWorkout?
  }
}
