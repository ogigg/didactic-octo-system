import Foundation
import WatchConnectivity

class PhoneSessionDelegate: NSObject, WCSessionDelegate {
  var onSetCompleted: (([String: Any]) -> Void)?

  // MARK: - WCSessionDelegate (required)

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let error {
      print("[WatchBridge] activation failed:", error)
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // Re-activate for watch switching scenarios
    WCSession.default.activate()
  }

  // MARK: - Receive messages from watch

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handleMessage(message)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    handleMessage(userInfo)
  }

  private func handleMessage(_ message: [String: Any]) {
    guard let type = message["type"] as? String else { return }

    switch type {
    case "setCompleted":
      guard let payloadData = message["payload"] as? Data,
            let payload = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any]
      else { return }
      onSetCompleted?(payload)
    default:
      break
    }
  }
}
