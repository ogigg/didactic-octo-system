import ExpoModulesCore
import Foundation

public class WorkoutLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WorkoutLiveActivity")

    AsyncFunction("areActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.2, *) {
        return await LiveActivityManager.shared.areActivitiesEnabled()
      }
      return false
    }

    AsyncFunction("startActivity") { (workoutId: String, stateDict: [String: Any]) async throws -> String? in
      guard #available(iOS 16.2, *) else { return nil }
      guard let state = Self.contentState(from: stateDict) else {
        throw Exception(
          name: "LiveActivityInvalidState",
          description: "The Live Activity state payload is missing required fields.",
          code: "ERR_LIVE_ACTIVITY_INVALID_STATE"
        )
      }

      do {
        // Return ActivityKit's identifier so JS can distinguish a real start
        // from a failed request. The workout id is only the logical key used
        // to reconcile an existing activity.
        return try await LiveActivityManager.shared.start(workoutId: workoutId, state: state)
      } catch {
        let exception = Exception(
          name: "LiveActivityStartFailed",
          description: "ActivityKit could not start the workout Live Activity.",
          code: "ERR_LIVE_ACTIVITY_START"
        )
        exception.cause = error
        print("[WorkoutLiveActivity] startActivity failed:", error)
        throw exception
      }
    }

    AsyncFunction("updateActivity") { (stateDict: [String: Any]) in
      guard #available(iOS 16.2, *) else { return }
      guard let state = Self.contentState(from: stateDict) else { return }
      await LiveActivityManager.shared.update(state: state)
    }

    AsyncFunction("endActivity") { (dismissImmediately: Bool) in
      guard #available(iOS 16.2, *) else { return }
      await LiveActivityManager.shared.end(dismissImmediately: dismissImmediately)
    }

    /// Atomically read & clear the App-Group pending-actions queue.
    /// Returns an array of plain dictionaries so the JS side can fan them
    /// out to the appropriate Zustand store mutations. Always safe to call
    /// (returns []) on iOS < 16.2 or when the App Group is misconfigured.
    AsyncFunction("drainPendingActions") { () -> [[String: Any]] in
      AppGroupBridge.drainPendingActions()
    }
  }

  // MARK: - Helpers

  private static func intFromDict(_ dict: [String: Any], key: String) -> Int? {
    if let v = dict[key] as? Int { return v }
    if let v = dict[key] as? Double { return Int(v) }
    return nil
  }

  private static func contentState(from dict: [String: Any]) -> SweatyWorkoutAttributes.ContentState? {
    guard
      let exerciseName = dict["exerciseName"] as? String,
      let setDisplay = dict["setDisplay"] as? String,
      let exerciseId = dict["exerciseId"] as? String,
      let setId = dict["setId"] as? String,
      let workoutStartedAtMs = dict["workoutStartedAtMs"] as? Double
    else { return nil }

    let workoutStartedAt = Date(timeIntervalSince1970: workoutStartedAtMs / 1000)

    let proposalDisplay =
      dict["proposalDisplay"] as? String ?? setDisplay
    let workoutName = dict["workoutName"] as? String ?? ""
    let currentSetNumber = Self.intFromDict(dict, key: "currentSetNumber") ?? 1
    let totalSets = max(1, Self.intFromDict(dict, key: "totalSets") ?? 1)
    let completedSets = max(0, Self.intFromDict(dict, key: "completedSets") ?? 0)
    let totalWorkoutSets = max(
      1,
      Self.intFromDict(dict, key: "totalWorkoutSets") ?? totalSets
    )
    let isWorkoutComplete = dict["isWorkoutComplete"] as? Bool ?? false

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
      proposalDisplay: proposalDisplay,
      exerciseId: exerciseId,
      setId: setId,
      currentSetNumber: currentSetNumber,
      totalSets: totalSets,
      completedSets: completedSets,
      totalWorkoutSets: totalWorkoutSets,
      workoutName: workoutName,
      workoutStartedAt: workoutStartedAt,
      isWorkoutComplete: isWorkoutComplete,
      restStartedAt: restStartedAt,
      restEndsAt: restEndsAt
    )
  }
}
