import ActivityKit
import Foundation

@available(iOS 16.2, *)
actor LiveActivityManager {
  static let shared = LiveActivityManager()

  /// Starts (or reconciles) the activity for a workout and returns ActivityKit's
  /// identifier. ActivityKit keeps activities alive independently of the app
  /// process, so its registry is the source of truth across JS remounts and
  /// process recreation.
  func start(workoutId: String, state: SweatyWorkoutAttributes.ContentState) async throws -> String {
    let content = ActivityContent(state: state, staleDate: nil)
    let activities = activeActivities()

    // A JS remount can call start again while the existing activity is still
    // visible. Reuse that activity instead of ending it and requesting a
    // duplicate (which also avoids an unnecessary Dynamic Island transition).
    if let existing = activities.first(where: { $0.attributes.workoutId == workoutId }) {
      await existing.update(content)

      // Repair duplicates left by an older app version or a race between JS
      // runtimes. Keep the one we reconciled and dismiss every other activity
      // owned by this module.
      await endActivities(activities.filter { $0.id != existing.id }, dismissalPolicy: .immediate)
      return existing.id
    }

    // There is no activity for this workout. Remove stale activities before
    // requesting a new one so the system's activity limit cannot make a valid
    // request fail because of our own leftovers.
    await endActivities(activities, dismissalPolicy: .immediate)

    let attributes = SweatyWorkoutAttributes(workoutId: workoutId)
    let activity = try Activity.request(
      attributes: attributes,
      content: content,
      pushType: nil
    )
    return activity.id
  }

  func update(state: SweatyWorkoutAttributes.ContentState) async {
    let content = ActivityContent(state: state, staleDate: nil)
    let activities = activeActivities()

    // The app process can be recreated while the Live Activity remains active.
    // Always reconcile from ActivityKit's registry instead of relying on
    // references held by a prior JS/native process. There should normally be
    // one activity; update every discovered activity to repair duplicates
    // consistently.
    guard !activities.isEmpty else {
      return
    }

    for activity in activities {
      await activity.update(content)
    }
  }

  func end(dismissImmediately: Bool) async {
    let policy: ActivityUIDismissalPolicy = dismissImmediately ? .immediate : .default
    // Always read ActivityKit's registry so JS remounts/process recreation do
    // not leave stale in-memory references behind.
    await endActivities(activeActivities(), dismissalPolicy: policy)
  }

  func areActivitiesEnabled() -> Bool {
    ActivityAuthorizationInfo().areActivitiesEnabled
  }

  // MARK: - Private

  private func activeActivities() -> [Activity<SweatyWorkoutAttributes>] {
    Activity<SweatyWorkoutAttributes>.activities
  }

  private func endActivities(
    _ activities: [Activity<SweatyWorkoutAttributes>],
    dismissalPolicy: ActivityUIDismissalPolicy
  ) async {
    for activity in activities {
      await activity.end(nil, dismissalPolicy: dismissalPolicy)
    }
  }
}
