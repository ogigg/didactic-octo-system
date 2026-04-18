import AppIntents
import Foundation

@available(iOS 18.0, *)
struct MarkSetDoneIntent: AppIntent {
  static var title: LocalizedStringResource = "Mark Set Done"
  static var description = IntentDescription("Marks the current workout set as completed.")

  /// Open the app so the JS Zustand store can be mutated directly.
  static var openAppWhenRun: Bool = true

  @Parameter(title: "Exercise ID")
  var exerciseId: String

  @Parameter(title: "Set ID")
  var setId: String

  init() {
    self.exerciseId = ""
    self.setId = ""
  }

  init(exerciseId: String, setId: String) {
    self.exerciseId = exerciseId
    self.setId = setId
  }

  func perform() async throws -> some IntentResult & OpensIntent {
    // Force-unwrap is safe: the URL is built from a hard-coded scheme + percent-safe IDs.
    let url = URL(string: "sweaty://workout?action=markSetDone&exerciseId=\(exerciseId)&setId=\(setId)")!
    return .result(opensIntent: OpenURLIntent(url))
  }
}
