import Foundation

// NOTE: This file is intentionally duplicated in
// targets/widget/AppGroupBridge.swift
// Both copies must remain identical. Each target compiles its own copy
// because Swift modules are isolated, but they read/write the same
// `UserDefaults(suiteName:)` instance backed by the shared App Group.

enum AppGroupBridge {
  static let suiteName = "group.com.ogig.sweaty"
  private static let pendingActionsKey = "liveActivity.pendingActions"

  static var defaults: UserDefaults? {
    UserDefaults(suiteName: suiteName)
  }

  /// Append a single action to the pending queue. Atomic: read-modify-write
  /// is wrapped so concurrent intents from rapid taps don't lose updates.
  static func enqueueAction(_ payload: [String: Any]) {
    guard let store = defaults else { return }
    var enriched = payload
    if enriched["timestamp"] == nil {
      enriched["timestamp"] = Date().timeIntervalSince1970
    }
    let queue = (store.array(forKey: pendingActionsKey) as? [[String: Any]]) ?? []
    store.set(queue + [enriched], forKey: pendingActionsKey)
  }

  /// Atomically read and clear the queue. Caller is responsible for applying
  /// each action to the JS store. Returns an empty array if no actions are
  /// pending or the App Group is misconfigured.
  static func drainPendingActions() -> [[String: Any]] {
    guard let store = defaults else { return [] }
    let queue = (store.array(forKey: pendingActionsKey) as? [[String: Any]]) ?? []
    if !queue.isEmpty {
      store.removeObject(forKey: pendingActionsKey)
    }
    return queue
  }
}
