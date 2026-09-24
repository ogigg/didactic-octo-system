import SwiftUI

struct HeartRateView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        let _ = coordinator.now
        let heartRate = coordinator.health.heartRate
        WatchScreen(title: String(localized: "Heart rate"),
            onBack: { coordinator.goBack() }, headerAction: .details) {
            VStack(spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Image(systemName: "heart.fill").font(.caption).foregroundStyle(.red)
                    Text(heartRate.map(String.init) ?? "—")
                        .font(.system(size: 38, weight: .light, design: .rounded))
                        .monospacedDigit()
                    Text("BPM").font(.caption2).foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(heartRate.map { watchLocalizedFormat("%lld beats per minute", $0) }
                    ?? String(localized: "Heart rate unavailable"))
                Text(heartRate == nil ? String(localized: "Waiting for a reading") : String(localized: "LIVE"))
                    .font(.caption2)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                if let current = heartRate, let previous = coordinator.heartRateAtLastSet {
                    Text(watchLocalizedFormat("%@%lld BPM since last set", current >= previous ? "+" : "", current - previous))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 4)
        }
    }
}
