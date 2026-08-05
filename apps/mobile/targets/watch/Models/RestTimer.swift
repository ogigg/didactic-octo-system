import Foundation

struct RestTimerState: Codable, Equatable {
    var id: String
    var exerciseId: String
    var durationSeconds: Int
    var endDate: Date?
    var pausedRemainingSeconds: Double?

    func remainingSeconds(at date: Date = .now) -> Int {
        if let pausedRemainingSeconds {
            return max(0, Int(pausedRemainingSeconds.rounded(.up)))
        }
        guard let endDate else { return 0 }
        return max(0, Int(endDate.timeIntervalSince(date).rounded(.up)))
    }

    var isPaused: Bool { pausedRemainingSeconds != nil }
}
