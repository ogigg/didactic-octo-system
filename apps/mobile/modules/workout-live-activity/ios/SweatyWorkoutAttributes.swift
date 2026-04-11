import ActivityKit
import Foundation

struct SweatyWorkoutAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var exerciseName: String
    /// Formatted as "60 kg × 8" or "Bodyweight × 12"
    var setDisplay: String
    var exerciseId: String
    var setId: String
    var workoutStartedAt: Date
    /// Non-nil only while rest timer is running
    var restStartedAt: Date?
    var restEndsAt: Date?
  }

  var workoutId: String
}
