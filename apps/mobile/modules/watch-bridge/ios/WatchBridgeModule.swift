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
      // Persist first so a paired Watch whose companion is still installing
      // does not turn normal installation state into a rejected JS promise.
      self.sessionDelegate.queueApplicationContext(envelope, on: session)

      // A reachable message makes the UI feel immediate. The watch rejects
      // stale revisions, so receiving both paths is harmless.
      if session.isWatchAppInstalled && session.isReachable {
        session.sendMessage(envelope, replyHandler: nil) { error in
          let code = (error as NSError).code
          print("[WatchBridge] immediate state delivery failed reason=\(code)")
        }
      }
    }

    AsyncFunction("sendWatchSettings") { (incomingEnvelope: [String: Any]) in
      guard WCSession.isSupported() else { return }
      let session = WCSession.default

      // Settings use the durable user-info lane. The delegate retains one
      // latest pre-activation envelope until WatchConnectivity accepts it.
      self.sessionDelegate.queueSettingsUserInfo(incomingEnvelope, on: session)

      // Reachable delivery is only a latency optimization. It is safe to
      // receive this alongside the queued user-info copy because the Watch
      // applies settings by their independent monotonic revision.
      if session.isWatchAppInstalled && session.isReachable {
        session.sendMessage(incomingEnvelope, replyHandler: nil) { error in
          let code = (error as NSError).code
          print("[WatchBridge] immediate settings delivery failed reason=\(code)")
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

    Function("isWatchAppInstalled") { () -> Bool in
      WCSession.isSupported() && WCSession.default.isWatchAppInstalled
    }

    Function("isWatchReachable") { () -> Bool in
      WCSession.isSupported() && WCSession.default.isReachable
    }
  }
}
