import SwiftUI

struct RestTimerView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @State private var skipConfirmation = false

    var body: some View {
        let rest = coordinator.snapshot?.rest
        let remaining = rest?.remainingSeconds(at: coordinator.now) ?? 0
        let adjustment = coordinator.watchSettings.restAdjustmentSeconds
        WatchScreen(title: rest?.isPaused == true ? String(localized: "Paused") : String(localized: "Rest"),
            onBack: { coordinator.navigate(.activeSet) }, headerAction: .details,
            primaryTitle: remaining == 0 ? String(localized: "Start next set") : String(localized: "Skip"),
            primaryTint: remaining == 0 ? WatchTheme.success : WatchTheme.primary,
            onPrimary: {
                if remaining == 0 || !coordinator.watchSettings.confirmSkipRest {
                    coordinator.skipRest()
                } else {
                    skipConfirmation = true
                }
            }) {
            VStack(spacing: 2) {
                Text(String(format: "%d:%02d", remaining / 60, remaining % 60))
                    .font(.system(size: 32, weight: .light, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(remaining == 0 ? WatchTheme.success : .primary)
                    .frame(height: 40)
                    .accessibilityLabel(watchLocalizedFormat("%lld seconds remaining", remaining))
                HStack(spacing: 0) {
                    Button { coordinator.adjustRest(by: -adjustment) } label: { Text("−\(adjustment)s").frame(maxWidth: .infinity, minHeight: 28) }
                    .accessibilityLabel(watchLocalizedFormat("Decrease rest by %lld seconds", adjustment))
                    Button {
                        if rest?.isPaused == true { coordinator.resumeRest() } else { coordinator.pauseRest() }
                    } label: { Image(systemName: rest?.isPaused == true ? "play.fill" : "pause.fill").frame(maxWidth: .infinity, minHeight: 28) }
                    .accessibilityLabel(rest?.isPaused == true ? String(localized: "Resume rest timer") : String(localized: "Pause rest timer"))
                    Button { coordinator.adjustRest(by: adjustment) } label: { Text("+\(adjustment)s").frame(maxWidth: .infinity, minHeight: 28) }
                    .accessibilityLabel(watchLocalizedFormat("Increase rest by %lld seconds", adjustment))
                }
                .font(.caption2)
                .buttonStyle(.plain)
                .frame(height: 28)
                .frame(maxWidth: .infinity)
            }
        }
        .confirmationDialog(String(localized: "Skip rest?"), isPresented: $skipConfirmation, titleVisibility: .visible) {
            Button(String(localized: "Skip"), role: .destructive) { coordinator.skipRest() }
            Button(String(localized: "Cancel"), role: .cancel) {}
        }
    }
}
