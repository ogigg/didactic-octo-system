import ActivityKit
import Foundation

struct SweatyWorkoutAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var exerciseName: String
    /// Formatted as "60 kg × 8" or "Bodyweight × 12"
    var setDisplay: String
    /// Expanded island: e.g. "60 kg × 12 reps"
    var proposalDisplay: String
    var exerciseId: String
    var setId: String
    /// 1-based index within the exercise (compact island "1/4")
    var currentSetNumber: Int
    var totalSets: Int
    var workoutName: String
    var workoutStartedAt: Date
    /// Non-nil only while rest timer is running
    var restStartedAt: Date?
    var restEndsAt: Date?
  }

  var workoutId: String
}
