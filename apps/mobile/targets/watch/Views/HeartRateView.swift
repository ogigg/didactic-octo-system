import SwiftUI

struct HeartRateView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        let _ = coordinator.now
        let heartRate = coordinator.health.heartRate
        WatchScreen(
            title: String(localized: "Heart rate"),
            onBack: { coordinator.goBack() },
            headerAction: .details,
            accent: WatchTheme.heart
        ) {
            VStack(spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(heartRate == nil ? Color.secondary : WatchTheme.heart)
                        .symbolEffect(.pulse, isActive: heartRate != nil)
                    Text(heartRate.map(String.init) ?? "--")
                        .font(.system(size: 40, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .contentTransition(.numericText())
                        .foregroundStyle(heartRate == nil ? .secondary : .primary)
                    Text("BPM")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
                .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(heartRate.map { watchLocalizedFormat("%lld beats per minute", $0) }
                    ?? String(localized: "Heart rate unavailable"))

                Text(trendMessage(heartRate))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)

                if let snapshot = coordinator.snapshot {
                    HStack(spacing: 4) {
                        VStack(spacing: 0) {
                            Text(snapshot.startedAt, style: .timer)
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .monospacedDigit()
                                .multilineTextAlignment(.center)
                                .lineLimit(1)
                            Text(String(localized: "TIME"))
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .accessibilityElement(children: .combine)
                        WatchStat(
                            label: String(localized: "SETS"),
                            value: watchLocalizedFormat(
                                "%lld/%lld",
                                coordinator.completedSetCount,
                                coordinator.totalSetCount
                            )
                        )
                    }
                    .padding(.vertical, 4)
                    .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: WatchLayout.dataRadius))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 2)
        }
    }

    private func trendMessage(_ heartRate: Int?) -> String {
        guard let current = heartRate else { return String(localized: "Waiting for a reading") }
        guard let previous = coordinator.heartRateAtLastSet else { return String(localized: "LIVE") }
        return watchLocalizedFormat(
            "%@%lld BPM since last set",
            current >= previous ? "+" : "",
            current - previous
        )
    }
}
