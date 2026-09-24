import Foundation

enum HomeWidgetStore {
  // NOTE: Must match modules/home-widgets/ios/HomeWidgetsModule.swift, which
  // writes the snapshot from the app into the shared App Group.
  static let snapshotKey = "homeWidgets.snapshot.v1"

  static func load() -> HomeWidgetSnapshot? {
    guard
      let json = UserDefaults(suiteName: AppGroupBridge.suiteName)?.string(forKey: snapshotKey),
      let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(HomeWidgetSnapshot.self, from: data),
      snapshot.version == HomeWidgetSnapshot.supportedVersion,
      !snapshot.summaries.isEmpty
    else { return nil }
    return snapshot
  }
}
