import SwiftUI

struct HeartRateView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        VStack(spacing: 9) {
            HStack {
                Button {
                    coordinator.screen =
                        coordinator.snapshot?.rest == nil ? .activeSet : .rest
                } label: {
                    Image(systemName: "chevron.left")
                }
                .buttonStyle(.plain)
                Spacer()
                Text("LIVE")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(WatchTheme.primary)
            }

            Image(systemName: "heart.fill")
                .font(.title2)
                .foregroundStyle(.red)
                .symbolEffect(.pulse, isActive: coordinator.health.heartRate != nil)

            Text(coordinator.health.heartRate.map(String.init) ?? "—")
                .font(.system(size: 48, weight: .light, design: .rounded))
                .monospacedDigit()
                .accessibilityLabel(
                    coordinator.health.heartRate.map {
                        watchLocalizedFormat("%lld beats per minute", $0)
                    } ?? String(localized: "Heart rate unavailable")
                )

            Text("BPM")
                .font(.caption2)
                .foregroundStyle(.secondary)

            if let current = coordinator.health.heartRate,
                let previous = coordinator.heartRateAtLastSet
            {
                let delta = current - previous
                Text(
                    delta == 0
                        ? String(localized: "No change since last set")
                        : watchLocalizedFormat(
                            "%@%lld BPM since last set",
                            delta > 0 ? "+" : "",
                            delta
                        )
                )
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            } else {
                Text("Recovery trend appears after you log a set.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button("Back to workout") {
                coordinator.screen =
                    coordinator.snapshot?.rest == nil ? .activeSet : .rest
            }
            .buttonStyle(.borderedProminent)
            .tint(WatchTheme.primary)
        }
        .padding(.horizontal, 8)
    }
}
