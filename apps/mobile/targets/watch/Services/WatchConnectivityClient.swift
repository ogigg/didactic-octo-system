import Foundation
import Observation
import WatchConnectivity

@MainActor
@Observable
final class WatchConnectivityClient: NSObject, WCSessionDelegate {
    var isReachable = false
    var onEnvelope: ((WatchSyncEnvelope) -> Void)?

    private let outboxKey = "SweatyWatch.commandOutbox"
    private var outbox: [WatchCommand] = []
    private var transferredCommandIDs = Set<String>()
    private var session: WCSession { WCSession.default }

    override init() {
        super.init()
        if let data = UserDefaults.standard.data(forKey: outboxKey),
            let stored = try? JSONDecoder().decode([WatchCommand].self, from: data)
        {
            outbox = stored
        }
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        session.delegate = self
        session.activate()
    }

    func waitForPendingContent() async {
        guard WCSession.isSupported() else { return }
        activate()
        while !Task.isCancelled {
            if session.activationState == .activated,
               !session.hasContentPending
            {
                return
            }
            try? await Task.sleep(for: .milliseconds(200))
        }
    }

    func enqueue(_ command: WatchCommand) {
        guard !outbox.contains(where: { $0.commandID == command.commandID }) else {
            return
        }
        outbox.append(command)
        persistOutbox()
        deliver(command, includeDurableTransfer: true)
    }

    func acknowledge(_ commandIDs: [String]) {
        guard !commandIDs.isEmpty else { return }
        let acknowledged = Set(commandIDs)
        outbox.removeAll { acknowledged.contains($0.commandID) }
        transferredCommandIDs.subtract(acknowledged)
        persistOutbox()
    }

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        Task { @MainActor in
            self.isReachable = session.isReachable
            if activationState == .activated {
                self.consume(session.receivedApplicationContext)
                self.flushOutbox()
            }
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any]
    ) {
        Task { @MainActor in self.consume(message) }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        Task { @MainActor in self.consume(applicationContext) }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = session.isReachable
            if session.isReachable {
                self.flushOutbox()
            }
        }
    }

    private func consume(_ dictionary: [String: Any]) {
        guard let envelope = WatchSyncEnvelope(dictionary: dictionary) else {
            return
        }
        acknowledge(envelope.acknowledgedCommandIDs)
        onEnvelope?(envelope)
    }

    private func flushOutbox() {
        for command in outbox {
            deliver(
                command,
                includeDurableTransfer: !transferredCommandIDs.contains(
                    command.commandID
                )
            )
        }
    }

    private func deliver(
        _ command: WatchCommand,
        includeDurableTransfer: Bool
    ) {
        guard session.activationState == .activated else { return }

        if includeDurableTransfer {
            session.transferUserInfo(command.dictionary)
            transferredCommandIDs.insert(command.commandID)
        }

        if session.isReachable {
            session.sendMessage(
                command.dictionary,
                replyHandler: nil,
                errorHandler: { error in
                    print("[SweatyWatch] immediate command failed:", error)
                }
            )
        }
    }

    private func persistOutbox() {
        guard let data = try? JSONEncoder().encode(outbox) else { return }
        UserDefaults.standard.set(data, forKey: outboxKey)
    }
}
