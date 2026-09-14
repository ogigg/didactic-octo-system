import Foundation
import Observation
import WatchConnectivity

@MainActor
@Observable
final class WatchConnectivityClient: NSObject, WCSessionDelegate {
    var isReachable = false
    var lastError: String?
    var onEnvelope: ((WatchSyncEnvelope) -> Void)?
    private(set) var outbox: [WatchCommand] = []
    private let outboxKey = "SweatyWatch.commandOutbox"
    private var retryTask: Task<Void, Never>?
    private var session: WCSession { WCSession.default }

    override init() {
        super.init()
        if let data = UserDefaults.standard.data(forKey: outboxKey),
           let stored = try? JSONDecoder().decode([WatchCommand].self, from: data) {
            outbox = stored
        }
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        session.delegate = self
        if session.activationState != .activated { session.activate() }
        else { flushOutbox() }
        if retryTask == nil {
            retryTask = Task { [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(10))
                    guard !Task.isCancelled, let self else { return }
                    self.flushOutbox()
                }
            }
        }
    }

    func waitForPendingContent() async {
        activate()
        // Do not spend an entire background execution budget on failed activation.
        for _ in 0..<100 {
            if Task.isCancelled { return }
            if session.activationState == .activated, !session.hasContentPending { return }
            try? await Task.sleep(for: .milliseconds(100))
        }
    }

    func enqueue(_ command: WatchCommand) {
        guard !outbox.contains(where: { $0.commandID == command.commandID }) else { return }
        outbox.append(command)
        persistOutbox()
        flushOutbox()
    }

    func acknowledge(_ commandIDs: [String]) {
        guard !commandIDs.isEmpty else { return }
        let ids = Set(commandIDs)
        outbox.removeAll { ids.contains($0.commandID) }
        for transfer in session.outstandingUserInfoTransfers {
            if let id = transfer.userInfo["commandID"] as? String, ids.contains(id) {
                transfer.cancel()
            }
        }
        persistOutbox()
        flushOutbox()
    }

    func requestState() {
        guard session.activationState == .activated, session.isReachable else { return }
        let command = WatchCommand(protocolVersion: watchSyncProtocolVersion,
            commandID: UUID().uuidString, baseRevision: 0,
            sentAt: ISO8601DateFormatter().string(from: .now), type: .requestState, payload: "{}")
        session.sendMessage(command.dictionary, replyHandler: { [weak self] reply in
            Task { @MainActor in self?.consume(reply) }
        }, errorHandler: { _ in })
    }

    nonisolated func session(_ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            self.isReachable = session.isReachable
            self.lastError = error?.localizedDescription
            if activationState == .activated {
                self.consume(session.receivedApplicationContext)
                self.flushOutbox()
                self.requestState()
            }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in self.consume(message) }
    }

    nonisolated func session(_ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in self.consume(applicationContext) }
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        Task { @MainActor in self.consume(userInfo) }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = session.isReachable
            if session.isReachable {
                self.flushOutbox()
                self.requestState()
            }
        }
    }

    nonisolated func session(_ session: WCSession,
        didFinish userInfoTransfer: WCSessionUserInfoTransfer, error: Error?) {
        Task { @MainActor in
            self.lastError = error?.localizedDescription
        }
    }

    private func consume(_ dictionary: [String: Any]) {
        acknowledge(dictionary["acknowledgedCommandIDs"] as? [String] ?? [])
        guard let envelope = WatchSyncEnvelope(dictionary: dictionary) else { return }
        lastError = nil
        onEnvelope?(envelope)
    }

    private func flushOutbox() {
        guard session.activationState == .activated, let command = outbox.first else { return }
        // One in-flight command preserves order across immediate and durable delivery.
        let alreadyTransferring = session.outstandingUserInfoTransfers.contains {
            ($0.userInfo["commandID"] as? String) == command.commandID
        }
        if !alreadyTransferring { session.transferUserInfo(command.dictionary) }
        if session.isReachable {
            session.sendMessage(command.dictionary, replyHandler: { [weak self] reply in
                Task { @MainActor in self?.consume(reply) }
            }, errorHandler: { [weak self] error in
                Task { @MainActor in self?.lastError = error.localizedDescription }
            })
        }
    }

    private func persistOutbox() {
        guard let data = try? JSONEncoder().encode(outbox) else { return }
        UserDefaults.standard.set(data, forKey: outboxKey)
    }
}
