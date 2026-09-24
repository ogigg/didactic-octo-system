import Foundation
import WatchConnectivity

final class PhoneSessionDelegate: NSObject, WCSessionDelegate {
  var onWatchAction: (([String: Any]) -> Void)?
  private let defaultsKey = "WatchBridge.acknowledgedCommandIDs"
  private let pendingDefaultsKey = "WatchBridge.pendingActions"
  private let pendingContextDefaultsKey = "WatchBridge.pendingApplicationContext"
  private let stateLock = NSRecursiveLock()
  private var pendingContextGeneration: UInt64 = 0

  private func pendingApplicationContextUnsafe() -> [String: Any]? {
    UserDefaults.standard.dictionary(forKey: pendingContextDefaultsKey)
  }

  var pendingApplicationContext: [String: Any]? {
    get {
      stateLock.lock()
      defer { stateLock.unlock() }
      return pendingApplicationContextUnsafe()
    }
    set {
      stateLock.lock()
      defer { stateLock.unlock() }
      UserDefaults.standard.set(newValue, forKey: pendingContextDefaultsKey)
    }
  }

  var acknowledgedCommandIDs: [String] {
    stateLock.lock()
    defer { stateLock.unlock() }
    return acknowledgedCommandIDsUnsafe()
  }

  var pendingActions: [[String: Any]] {
    stateLock.lock()
    defer { stateLock.unlock() }
    return pendingActionsUnsafe()
  }

  private func acknowledgedCommandIDsUnsafe() -> [String] {
    Array(
      (UserDefaults.standard.stringArray(forKey: defaultsKey) ?? [])
        .suffix(100)
    )
  }

  private func pendingActionsUnsafe() -> [[String: Any]] {
    UserDefaults.standard.array(forKey: pendingDefaultsKey) as? [[String: Any]] ?? []
  }

  func queueApplicationContext(
    _ applicationContext: [String: Any],
    on session: WCSession
  ) {
    stateLock.lock()
    pendingContextGeneration &+= 1
    UserDefaults.standard.set(
      applicationContext,
      forKey: pendingContextDefaultsKey
    )
    stateLock.unlock()
    flushPendingApplicationContext(on: session)
  }

  func flushPendingApplicationContext(on session: WCSession) {
    guard session.activationState == .activated else {
      session.activate()
      return
    }
    stateLock.lock()
    let pendingApplicationContext = pendingApplicationContextUnsafe()
    let generation = pendingContextGeneration
    stateLock.unlock()

    guard session.isPaired, session.isWatchAppInstalled,
          let pendingApplicationContext
    else {
      return
    }

    do {
      try session.updateApplicationContext(pendingApplicationContext)
      stateLock.lock()
      if pendingContextGeneration == generation {
        UserDefaults.standard.removeObject(forKey: pendingContextDefaultsKey)
      }
      stateLock.unlock()
    } catch {
      // Keep the latest snapshot persisted. Watch installation and
      // connectivity state can change after the phone app has launched.
      print("[WatchBridge] pending application context failed:", error)
    }
  }

  func acknowledge(commandID: String, on session: WCSession) {
    stateLock.lock()
    do {
      defer { stateLock.unlock() }
      let remaining = pendingActionsUnsafe().filter {
        ($0["commandID"] as? String) != commandID
      }
      UserDefaults.standard.set(remaining, forKey: pendingDefaultsKey)
      var acknowledged = acknowledgedCommandIDsUnsafe()
      if !acknowledged.contains(commandID) {
        acknowledged.append(commandID)
        UserDefaults.standard.set(
          Array(acknowledged.suffix(100)),
          forKey: defaultsKey
        )
      }
    }
    flushAcknowledgements(on: session)
  }

  private func flushAcknowledgements(on session: WCSession) {
    let acknowledged = acknowledgedCommandIDs
    guard !acknowledged.isEmpty,
          session.activationState == .activated,
          session.isPaired,
          session.isWatchAppInstalled
    else { return }

    let message: [String: Any] = [
      "protocolVersion": 1,
      "kind": "commandAcknowledgement",
      "acknowledgedCommandIDs": acknowledged,
    ]
    if session.isReachable {
      session.sendMessage(message, replyHandler: nil) { error in
        print("[WatchBridge] acknowledgement delivery failed:", error)
      }
    }
    session.transferUserInfo(message)
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
    if activationState == .activated {
      flushPendingApplicationContext(on: session)
      flushAcknowledgements(on: session)
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    flushPendingApplicationContext(on: session)
    flushAcknowledgements(on: session)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    deliver(message, on: session)
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    let commandID = message["commandID"] as? String
    deliver(message, on: session)
    replyHandler(["queued": true, "commandID": commandID ?? ""])
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    deliver(userInfo, on: session)
  }

  private func deliver(_ action: [String: Any], on session: WCSession) {
    guard action["protocolVersion"] is NSNumber,
          let commandID = action["commandID"] as? String,
          !commandID.isEmpty
    else { return }

    stateLock.lock()
    if acknowledgedCommandIDsUnsafe().contains(commandID) {
      stateLock.unlock()
      flushAcknowledgements(on: session)
      return
    }
    if !pendingActionsUnsafe().contains(where: {
      ($0["commandID"] as? String) == commandID
    }) {
      UserDefaults.standard.set(
        pendingActionsUnsafe() + [action],
        forKey: pendingDefaultsKey
      )
    }
    stateLock.unlock()

    DispatchQueue.main.async { [weak self] in
      self?.onWatchAction?(action)
    }
  }
}
