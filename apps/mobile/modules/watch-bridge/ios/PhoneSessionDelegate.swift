import Foundation
import WatchConnectivity

final class PhoneSessionDelegate: NSObject, WCSessionDelegate {
  var onWatchAction: (([String: Any]) -> Void)?
  private let defaultsKey = "WatchBridge.acknowledgedCommandIDs"
  private let pendingDefaultsKey = "WatchBridge.pendingActions"
  private let pendingContextDefaultsKey = "WatchBridge.pendingApplicationContext"

  var pendingApplicationContext: [String: Any]? {
    get {
      UserDefaults.standard.dictionary(forKey: pendingContextDefaultsKey)
    }
    set {
      UserDefaults.standard.set(newValue, forKey: pendingContextDefaultsKey)
    }
  }

  var acknowledgedCommandIDs: [String] {
    Array(Set(UserDefaults.standard.stringArray(forKey: defaultsKey) ?? []))
      .suffix(100)
  }

  var pendingActions: [[String: Any]] {
    UserDefaults.standard.array(forKey: pendingDefaultsKey) as? [[String: Any]] ?? []
  }

  func acknowledge(commandID: String) {
    let remaining = pendingActions.filter {
      ($0["commandID"] as? String) != commandID
    }
    UserDefaults.standard.set(remaining, forKey: pendingDefaultsKey)
    var acknowledged = acknowledgedCommandIDs
    if !acknowledged.contains(commandID) {
      acknowledged.append(commandID)
      UserDefaults.standard.set(
        Array(acknowledged.suffix(100)),
        forKey: defaultsKey
      )
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let error {
      print("[WatchBridge] activation failed:", error)
      return
    }
    guard activationState == .activated, let pendingApplicationContext else {
      return
    }
    do {
      try session.updateApplicationContext(pendingApplicationContext)
      self.pendingApplicationContext = nil
    } catch {
      print("[WatchBridge] pending application context failed:", error)
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    deliver(message)
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    let commandID = message["commandID"] as? String
    deliver(message)
    replyHandler(["queued": true, "commandID": commandID ?? ""])
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    deliver(userInfo)
  }

  private func deliver(_ action: [String: Any]) {
    guard action["protocolVersion"] is NSNumber,
          let commandID = action["commandID"] as? String,
          action["type"] is String,
          action["payload"] is String
    else { return }

    guard !acknowledgedCommandIDs.contains(commandID) else { return }
    if !pendingActions.contains(where: {
      ($0["commandID"] as? String) == commandID
    }) {
      UserDefaults.standard.set(
        pendingActions + [action],
        forKey: pendingDefaultsKey
      )
    }

    DispatchQueue.main.async { [weak self] in
      self?.onWatchAction?(action)
    }
  }
}
