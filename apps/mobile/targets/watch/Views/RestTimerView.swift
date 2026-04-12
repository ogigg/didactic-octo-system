import SwiftUI

struct RestTimerView: View {
    @Environment(WorkoutStore.self) private var store

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            VStack(spacing: 8) {
                if let rest = store.restTimer, rest.isActive(now: context.date) {
                    let remaining = rest.remainingSeconds(now: context.date)

                    Text("Rest")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Text(formatTime(remaining))
                        .font(.system(size: 48, weight: .light, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(remaining <= 10 ? .orange : .primary)

                    ProgressView(value: Double(remaining), total: Double(rest.durationSeconds))
                        .tint(remaining <= 10 ? .orange : .blue)

                    Button("Skip") {
                        store.clearRest()
                    }
                    .font(.caption)
                } else {
                    Image(systemName: "checkmark.circle")
                        .font(.largeTitle)
                        .foregroundStyle(.green)
                    Text("Ready")
                        .font(.headline)
                }
            }
            .onChange(of: store.restTimer) { oldValue, _ in
                if let old = oldValue, old.isActive(), store.restTimer?.isActive() != true {
                    HapticsClient.restTimerComplete()
                }
            }
        }
    }

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%d:%02d", m, s)
    }
}
