import SwiftUI

struct RestTimerView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @State private var skipConfirmation = false

    var body: some View {
        let rest = coordinator.snapshot?.rest
        let remaining = rest?.remainingSeconds(at: coordinator.now) ?? 0
        let isPaused = rest?.isPaused == true
        let isDone = remaining == 0
        let tint = isDone ? WatchTheme.success : (isPaused ? Color.secondary : WatchTheme.primary)
        let progress = Double(remaining) / Double(max(1, rest?.durationSeconds ?? 1))
        WatchScreen(
            title: isPaused ? String(localized: "Paused") : String(localized: "Rest"),
            titleTint: isPaused ? .secondary : .primary,
            onBack: { coordinator.navigate(.activeSet) },
            headerAction: .details,
            accent: isDone ? WatchTheme.success : WatchTheme.primary,
            primaryTitle: isDone ? String(localized: "Start next set") : String(localized: "Skip"),
            primarySymbol: isDone ? "play.fill" : "forward.end.fill",
            primaryTint: isDone ? WatchTheme.success : WatchTheme.surface,
            primaryForeground: isDone ? .black : .primary,
            onPrimary: { if isDone { coordinator.skipRest() } else { skipConfirmation = true } }
        ) {
            VStack(spacing: 3) {
                HStack(spacing: 0) {
                    adjustButton(seconds: -15)
                    Spacer(minLength: 2)
                    Button {
                        if isPaused { coordinator.resumeRest() } else { coordinator.pauseRest() }
                    } label: {
                        ring(remaining: remaining, progress: progress, tint: tint, isPaused: isPaused)
                    }
                    .buttonStyle(WatchPressStyle())
                    .disabled(isDone)
                    .accessibilityLabel(watchLocalizedFormat("%lld seconds remaining", remaining))
                    .accessibilityHint(
                        isPaused
                            ? String(localized: "Resume rest timer")
                            : String(localized: "Pause rest timer")
                    )
                    Spacer(minLength: 2)
                    adjustButton(seconds: 15)
                }
                nextLine
            }
            .frame(maxWidth: .infinity)
        }
        .confirmationDialog(String(localized: "Skip rest?"), isPresented: $skipConfirmation, titleVisibility: .visible) {
            Button(String(localized: "Skip"), role: .destructive) { coordinator.skipRest() }
            Button(String(localized: "Cancel"), role: .cancel) {}
        }
    }

    private func ring(remaining: Int, progress: Double, tint: Color, isPaused: Bool) -> some View {
        ZStack {
            Circle()
                .stroke(WatchTheme.surface, lineWidth: 5)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(tint, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: tint.opacity(0.5), radius: 4)
                .animation(.linear(duration: 1), value: progress)
            VStack(spacing: 0) {
                Text(String(format: "%d:%02d", remaining / 60, remaining % 60))
                    .font(.system(size: 22, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .contentTransition(.numericText(countsDown: true))
                    .foregroundStyle(remaining == 0 ? WatchTheme.success : (isPaused ? .secondary : .primary))
                    .minimumScaleFactor(0.7)
                if remaining > 0 {
                    Image(systemName: isPaused ? "play.fill" : "pause.fill")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(.secondary)
                        .accessibilityHidden(true)
                }
            }
        }
        .frame(width: 70, height: 70)
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }

    private func adjustButton(seconds: Int) -> some View {
        Button { coordinator.adjustRest(by: seconds) } label: {
            Text(seconds < 0 ? "−15" : "+15")
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .frame(width: 32, height: 32)
                .background(WatchTheme.surface, in: Circle())
        }
        .buttonStyle(WatchPressStyle())
        .accessibilityLabel(
            watchLocalizedFormat(seconds < 0 ? "Remove %lld seconds" : "Add %lld seconds", abs(seconds))
        )
    }

    @ViewBuilder
    private var nextLine: some View {
        HStack(spacing: 4) {
            if let heartRate = coordinator.health.heartRate {
                Button { coordinator.navigate(.heartRate) } label: {
                    Label(String(heartRate), systemImage: "heart.fill")
                        .labelStyle(.titleAndIcon)
                        .foregroundStyle(WatchTheme.heart)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(watchLocalizedFormat("Heart rate %lld beats per minute", heartRate))
            }
            if let set = coordinator.currentSet {
                Text(watchLocalizedFormat("Next: %@", WatchDisplay.set(set, unit: coordinator.weightUnit)))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .font(.system(size: 11, weight: .medium, design: .rounded))
        .monospacedDigit()
    }
}
