import Foundation

struct RestTimerState: Codable {
    let startedAt: Date
    let durationSeconds: Int

    var endAt: Date {
        startedAt.addingTimeInterval(TimeInterval(durationSeconds))
    }

    func remainingSeconds(now: Date = .now) -> Int {
        max(0, Int(endAt.timeIntervalSince(now)))
    }

    func isActive(now: Date = .now) -> Bool {
        remainingSeconds(now: now) > 0
    }
}
