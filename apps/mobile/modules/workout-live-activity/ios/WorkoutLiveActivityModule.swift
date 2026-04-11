import ExpoModulesCore
import Foundation

public class WorkoutLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WorkoutLiveActivity")

    AsyncFunction("areActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.1, *) {
        return await LiveActivityManager.shared.areActivitiesEnabled()
      }
      return false
    }

    AsyncFunction("startActivity") { (workoutId: String, stateDict: [String: Any]) -> String? in
      guard #available(iOS 16.1, *) else { return nil }
      guard let state = Self.contentState(from: stateDict) else { return nil }
      do {
        try await LiveActivityManager.shared.start(workoutId: workoutId, state: state)
        return workoutId
      } catch {
        print("[WorkoutLiveActivity] startActivity failed:", error)
        return nil
      }
    }

    AsyncFunction("updateActivity") { (stateDict: [String: Any]) in
      guard #available(iOS 16.1, *) else { return }
      guard let state = Self.contentState(from: stateDict) else { return }
      await LiveActivityManager.shared.update(state: state)
    }

    AsyncFunction("endActivity") { (dismissImmediately: Bool) in
      guard #available(iOS 16.1, *) else { return }
      await LiveActivityManager.shared.end(dismissImmediately: dismissImmediately)
    }
  }

  // MARK: - Helpers

  private static func contentState(from dict: [String: Any]) -> SweatyWorkoutAttributes.ContentState? {
    guard
      let exerciseName = dict["exerciseName"] as? String,
      let setDisplay = dict["setDisplay"] as? String,
      let exerciseId = dict["exerciseId"] as? String,
      let setId = dict["setId"] as? String,
      let workoutStartedAtMs = dict["workoutStartedAtMs"] as? Double
    else { return nil }

    let workoutStartedAt = Date(timeIntervalSince1970: workoutStartedAtMs / 1000)

    var restStartedAt: Date?
    var restEndsAt: Date?
    if let startMs = dict["restStartedAtMs"] as? Double,
       let endMs = dict["restEndsAtMs"] as? Double
    {
      restStartedAt = Date(timeIntervalSince1970: startMs / 1000)
      restEndsAt = Date(timeIntervalSince1970: endMs / 1000)
    }

    return SweatyWorkoutAttributes.ContentState(
      exerciseName: exerciseName,
      setDisplay: setDisplay,
      exerciseId: exerciseId,
      setId: setId,
      workoutStartedAt: workoutStartedAt,
      restStartedAt: restStartedAt,
      restEndsAt: restEndsAt
    )
  }
}
