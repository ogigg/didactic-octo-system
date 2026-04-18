import ActivityKit
import Foundation

@available(iOS 16.2, *)
actor LiveActivityManager {
  static let shared = LiveActivityManager()

  private var currentActivity: Activity<SweatyWorkoutAttributes>?

  func start(workoutId: String, state: SweatyWorkoutAttributes.ContentState) async throws {
    // End any lingering activity first
    await endAll()

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
    guard let activity = currentActivity else { return }
    let policy: ActivityUIDismissalPolicy = dismissImmediately ? .immediate : .default
    await activity.end(nil, dismissalPolicy: policy)
    currentActivity = nil
  }

  func areActivitiesEnabled() -> Bool {
    ActivityAuthorizationInfo().areActivitiesEnabled
  }

  // MARK: - Private

  private func endAll() async {
    for activity in Activity<SweatyWorkoutAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
    currentActivity = nil
  }
}
