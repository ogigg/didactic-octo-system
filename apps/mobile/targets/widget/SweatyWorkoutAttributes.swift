import ActivityKit
import Foundation

// NOTE: This file is intentionally duplicated in
// modules/workout-live-activity/ios/SweatyWorkoutAttributes.swift
// Both copies must remain identical. ActivityKit matches activities between
// the app and widget targets by Codable field names (not Swift module identity).

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
    /// True for the final state sent while the workout is being completed.
    /// The widget uses this to render a completion state before dismissal.
    var isWorkoutComplete: Bool
    /// Non-nil only while rest timer is running
    var restStartedAt: Date?
    var restEndsAt: Date?

    private enum CodingKeys: String, CodingKey {
      case exerciseName
      case setDisplay
      case proposalDisplay
      case exerciseId
      case setId
      case currentSetNumber
      case totalSets
      case workoutName
      case workoutStartedAt
      case isWorkoutComplete
      case restStartedAt
      case restEndsAt
    }

    init(
      exerciseName: String,
      setDisplay: String,
      proposalDisplay: String,
      exerciseId: String,
      setId: String,
      currentSetNumber: Int,
      totalSets: Int,
      workoutName: String,
      workoutStartedAt: Date,
      isWorkoutComplete: Bool,
      restStartedAt: Date?,
      restEndsAt: Date?
    ) {
      self.exerciseName = exerciseName
      self.setDisplay = setDisplay
      self.proposalDisplay = proposalDisplay
      self.exerciseId = exerciseId
      self.setId = setId
      self.currentSetNumber = currentSetNumber
      self.totalSets = totalSets
      self.workoutName = workoutName
      self.workoutStartedAt = workoutStartedAt
      self.isWorkoutComplete = isWorkoutComplete
      self.restStartedAt = restStartedAt
      self.restEndsAt = restEndsAt
    }

    /// Keep activities created by older binaries decodable after adding the
    /// completion marker. ActivityKit may restore their prior ContentState
    /// payload without the new key, so a synthesized decoder would otherwise
    /// discard the activity before the app can reconcile it.
    init(from decoder: Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)
      exerciseName = try container.decode(String.self, forKey: .exerciseName)
      setDisplay = try container.decode(String.self, forKey: .setDisplay)
      proposalDisplay = try container.decode(String.self, forKey: .proposalDisplay)
      exerciseId = try container.decode(String.self, forKey: .exerciseId)
      setId = try container.decode(String.self, forKey: .setId)
      currentSetNumber = try container.decode(Int.self, forKey: .currentSetNumber)
      totalSets = try container.decode(Int.self, forKey: .totalSets)
      workoutName = try container.decode(String.self, forKey: .workoutName)
      workoutStartedAt = try container.decode(Date.self, forKey: .workoutStartedAt)
      isWorkoutComplete = try container.decodeIfPresent(Bool.self, forKey: .isWorkoutComplete) ?? false
      restStartedAt = try container.decodeIfPresent(Date.self, forKey: .restStartedAt)
      restEndsAt = try container.decodeIfPresent(Date.self, forKey: .restEndsAt)
    }
  }

  var workoutId: String
}
