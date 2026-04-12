import ExpoModulesCore
import Foundation
import WatchConnectivity

public class WatchBridgeModule: Module {
  private let sessionDelegate = PhoneSessionDelegate()

  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    Events("onSetCompleted")

    OnCreate {
      sessionDelegate.onSetCompleted = { [weak self] payload in
        self?.sendEvent("onSetCompleted", payload)
      }
      if WCSession.isSupported() {
        let session = WCSession.default
        session.delegate = sessionDelegate
        session.activate()
      }
    }

    AsyncFunction("sendWorkoutState") { (stateDict: [String: Any]) in
      guard WCSession.default.activationState == .activated else { return }

      if WCSession.default.isReachable {
        WCSession.default.sendMessage(stateDict, replyHandler: nil)
      } else {
        try? WCSession.default.updateApplicationContext(stateDict)
      }
    }

    AsyncFunction("sendWorkoutEnded") {
      let message: [String: Any] = ["workoutEnded": true]
      guard WCSession.default.activationState == .activated else { return }

      if WCSession.default.isReachable {
        WCSession.default.sendMessage(message, replyHandler: nil)
      } else {
        try? WCSession.default.updateApplicationContext(message)
      }
    }

    Function("isWatchPaired") { () -> Bool in
      guard WCSession.isSupported() else { return false }
      return WCSession.default.isPaired
    }

    Function("isWatchReachable") { () -> Bool in
      guard WCSession.isSupported() else { return false }
      return WCSession.default.isReachable
    }
  }
}
