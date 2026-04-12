import Foundation
import Observation
import WatchConnectivity

@Observable
final class WatchConnectivityClient: NSObject, WCSessionDelegate {
    var isReachable = false

    private var workoutStore: WorkoutStore?
    private var session: WCSession { WCSession.default }

    func activate(workoutStore: WorkoutStore) {
        self.workoutStore = workoutStore
        session.delegate = self
        session.activate()
    }

    // MARK: - Send to Phone

    func sendSetCompletion(_ completion: SetCompletion) {
        guard let data = try? JSONEncoder().encode(completion) else { return }
        let message: [String: Any] = ["type": "setCompleted", "payload": data]

        if session.isReachable {
            session.sendMessage(message, replyHandler: nil)
        } else {
            session.transferUserInfo(message)
        }
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        guard activationState == .activated else { return }
        // Check for any application context sent while the watch was inactive
        let context = session.receivedApplicationContext
        if !context.isEmpty {
            Task { @MainActor in
                workoutStore?.applyState(from: context)
            }
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in
            workoutStore?.applyState(from: message)
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        Task { @MainActor in
            workoutStore?.applyState(from: userInfo)
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in
            workoutStore?.applyState(from: applicationContext)
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            isReachable = session.isReachable
        }
    }
}
