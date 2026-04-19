import ActivityKit
import AppIntents
import Foundation

/// Skip the running rest timer.
///
/// Runs entirely in the widget extension process — `openAppWhenRun = false`
/// so the user is not yanked into the app from the lock screen. The intent
/// optimistically clears the rest fields on the live activity (so the UI
/// flips back to "active set" mode immediately) and queues a `skipRest`
/// action in the shared App Group. The main app drains the queue on its
/// next foreground transition and reconciles the Zustand store, after which
/// `useWorkoutLiveActivity` pushes the canonical state back — idempotent.
@available(iOS 18.0, *)
struct SkipRestIntent: AppIntent {
  static var title: LocalizedStringResource = "Skip Rest Timer"
  static var description = IntentDescription("Ends the current rest period immediately.")

  static var openAppWhenRun: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    if let activity = Activity<SweatyWorkoutAttributes>.activities.first {
      var next = activity.content.state
      next.restStartedAt = nil
      next.restEndsAt = nil
      let content = ActivityContent(state: next, staleDate: nil)
      await activity.update(content)
    }

    AppGroupBridge.enqueueAction([
      "type": "skipRest",
    ])

    return .result()
  }
}

/// Add or subtract seconds from the running rest timer.
@available(iOS 18.0, *)
struct AdjustRestIntent: AppIntent {
  static var title: LocalizedStringResource = "Adjust Rest Timer"
  static var description = IntentDescription("Adds or removes seconds from the current rest period.")

  static var openAppWhenRun: Bool = false

  @Parameter(title: "Delta seconds")
  var deltaSeconds: Int

  init() {
    self.deltaSeconds = 0
  }

  init(deltaSeconds: Int) {
    self.deltaSeconds = deltaSeconds
  }

  func perform() async throws -> some IntentResult {
    if let activity = Activity<SweatyWorkoutAttributes>.activities.first,
       let currentEnd = activity.content.state.restEndsAt,
       let currentStart = activity.content.state.restStartedAt {
      var next = activity.content.state
      let proposedEnd = currentEnd.addingTimeInterval(TimeInterval(deltaSeconds))
      // Mirror the JS `adjustRestTimer` clamp: total duration ≥ 15 s.
      let minEnd = currentStart.addingTimeInterval(15)
      next.restEndsAt = max(proposedEnd, minEnd)
      let content = ActivityContent(state: next, staleDate: nil)
      await activity.update(content)
    }

    AppGroupBridge.enqueueAction([
      "type": "adjustRest",
      "deltaSeconds": deltaSeconds,
    ])

    return .result()
  }
}
