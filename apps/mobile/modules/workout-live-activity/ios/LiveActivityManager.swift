import ActivityKit
import Foundation

@available(iOS 16.2, *)
actor LiveActivityManager {
  static let shared = LiveActivityManager()

  private var currentActivity: Activity<SweatyWorkoutAttributes>?

  func start(workoutId: String, state: SweatyWorkoutAttributes.ContentState) async throws {
    // End any lingering activity first
    await endAll(dismissImmediately: true)

    let attributes = SweatyWorkoutAttributes(workoutId: workoutId)
    let content = ActivityContent(state: state, staleDate: nil)
    let activity = try Activity.request(
      attributes: attributes,
      content: content,
      pushType: nil
    )
    currentActivity = activity
  }

  func update(state: SweatyWorkoutAttributes.ContentState) async {
    guard let activity = currentActivity else { return }
    let content = ActivityContent(state: state, staleDate: nil)
    await activity.update(content)
  }

  func end(dismissImmediately: Bool) async {
    let policy: ActivityUIDismissalPolicy = dismissImmediately ? .immediate : .default
    if let activity = currentActivity {
      await activity.end(nil, dismissalPolicy: policy)
    }

    for activity in Activity<SweatyWorkoutAttributes>.activities {
      if activity.id != currentActivity?.id {
        await activity.end(nil, dismissalPolicy: policy)
      }
    }

    currentActivity = nil
  }

  func areActivitiesEnabled() -> Bool {
    ActivityAuthorizationInfo().areActivitiesEnabled
  }

  // MARK: - Private

  private func endAll(dismissImmediately: Bool) async {
    let policy: ActivityUIDismissalPolicy = dismissImmediately ? .immediate : .default
    for activity in Activity<SweatyWorkoutAttributes>.activities {
      await activity.end(nil, dismissalPolicy: policy)
    }
    currentActivity = nil
  }
}
