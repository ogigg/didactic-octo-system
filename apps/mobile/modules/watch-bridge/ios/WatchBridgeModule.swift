import ExpoModulesCore
import Foundation
import WatchConnectivity

public final class WatchBridgeModule: Module {
  private let sessionDelegate = PhoneSessionDelegate()

  public func definition() -> ModuleDefinition {
    Name("WatchBridge")
    Events("onWatchAction")

    OnCreate {
      sessionDelegate.onWatchAction = { [weak self] payload in
        self?.sendEvent("onWatchAction", payload)
      }
      guard WCSession.isSupported() else { return }
      let session = WCSession.default
      session.delegate = sessionDelegate
      session.activate()
    }

    AsyncFunction("sendWorkoutState") { (incomingEnvelope: [String: Any]) in
      guard WCSession.isSupported() else { return }
      let session = WCSession.default
      var envelope = incomingEnvelope
      envelope["acknowledgedCommandIDs"] = self.sessionDelegate.acknowledgedCommandIDs
      guard session.activationState == .activated else {
        self.sessionDelegate.pendingApplicationContext = envelope
        session.activate()
        return
      }

      // Application context is the durable, latest-wins canonical snapshot.
      try session.updateApplicationContext(envelope)

      // A reachable message makes the UI feel immediate. The watch rejects
      // stale revisions, so receiving both paths is harmless.
      if session.isReachable {
        session.sendMessage(envelope, replyHandler: nil) { error in
          print("[WatchBridge] immediate state delivery failed:", error)
        }
      }
    }

    AsyncFunction("drainPendingActions") { () -> [[String: Any]] in
      self.sessionDelegate.pendingActions
    }

    AsyncFunction("acknowledgeCommand") { (commandID: String) in
      self.sessionDelegate.acknowledge(commandID: commandID)
    }

    Function("isWatchPaired") { () -> Bool in
      WCSession.isSupported() && WCSession.default.isPaired
    }

    Function("isWatchReachable") { () -> Bool in
      WCSession.isSupported() && WCSession.default.isReachable
    }
  }
}
