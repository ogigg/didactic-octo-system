import ExpoModulesCore
import Foundation
import WidgetKit

// NOTE: The suite name and key must match
// targets/widget/Home/HomeWidgetStore.swift, which reads the snapshot inside
// the widget extension.
private enum HomeWidgetSnapshotStorage {
  static let suiteName = "group.com.ogig.sweaty"
  static let snapshotKey = "homeWidgets.snapshot.v1"

  static func defaults() throws -> UserDefaults {
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      throw Exception(
        name: "HomeWidgetsAppGroupUnavailable",
        description: "The shared App Group \(suiteName) is not available.",
        code: "ERR_HOME_WIDGETS_APP_GROUP"
      )
    }
    return defaults
  }
}

public class HomeWidgetsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HomeWidgets")

    /// Stores the JSON snapshot rendered by the app and asks WidgetKit to
    /// redraw. Reloads requested while the app is in the foreground do not
    /// count against the widget refresh budget.
    AsyncFunction("setSnapshot") { (json: String) throws in
      try HomeWidgetSnapshotStorage.defaults()
        .set(json, forKey: HomeWidgetSnapshotStorage.snapshotKey)
      WidgetCenter.shared.reloadAllTimelines()
    }

    AsyncFunction("clearSnapshot") { () throws in
      try HomeWidgetSnapshotStorage.defaults()
        .removeObject(forKey: HomeWidgetSnapshotStorage.snapshotKey)
      WidgetCenter.shared.reloadAllTimelines()
    }

    /// True when at least one of this app's widgets is placed on the Home
    /// Screen or Lock Screen.
    AsyncFunction("hasInstalledWidgets") { (promise: Promise) in
      WidgetCenter.shared.getCurrentConfigurations { result in
        switch result {
        case .success(let widgets):
          promise.resolve(!widgets.isEmpty)
        case .failure(let error):
          promise.reject(
            "ERR_HOME_WIDGETS_CONFIGURATIONS",
            error.localizedDescription
          )
        }
      }
    }
  }
}
