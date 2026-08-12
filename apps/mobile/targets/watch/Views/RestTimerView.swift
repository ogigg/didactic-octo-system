import SwiftUI

struct RestTimerView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @State private var skipConfirmation = false

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let rest = coordinator.snapshot?.rest
            let remaining = rest?.remainingSeconds(at: context.date) ?? 0

            ScrollView {
                VStack(spacing: 9) {
                    HStack {
                        Button {
                            coordinator.screen = .activeSet
                        } label: {
                            Image(systemName: "chevron.left")
                        }
                        .buttonStyle(.plain)
                        Spacer()
                        HeartRateButton()
                    }

                    Text(
                        remaining > 0
                            ? String(localized: "REST")
                            : String(localized: "READY")
                    )
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                    Text(format(remaining))
                        .font(.system(size: 45, weight: .light, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(remaining == 0 ? WatchTheme.success : .primary)
                        .accessibilityLabel(
                            watchLocalizedFormat(
                                "%lld seconds remaining",
                                remaining
                            )
                        )

                    ProgressView(
                        value: Double(remaining),
                        total: Double(max(rest?.durationSeconds ?? 1, 1))
                    )
                    .tint(remaining == 0 ? WatchTheme.success : WatchTheme.primary)

                    if remaining == 0 {
                        Button("Start next set") {
                            coordinator.skipRest()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(WatchTheme.success)
                    } else {
                        HStack {
                            Button {
                                if rest?.isPaused == true {
                                    coordinator.resumeRest()
                                } else {
                                    coordinator.pauseRest()
                                }
                            } label: {
                                Image(
                                    systemName: rest?.isPaused == true ? "play.fill" : "pause.fill")
                            }
                            .accessibilityLabel(
                                rest?.isPaused == true
                                    ? String(localized: "Resume rest timer")
                                    : String(localized: "Pause rest timer")
                            )

                            Button {
                                if !coordinator.watchSettings.confirmSkipRest {
                                    coordinator.skipRest()
                                } else if skipConfirmation {
                                    coordinator.skipRest()
                                } else {
                                    skipConfirmation = true
                                }
                            } label: {
                                Text(
                                    skipConfirmation
                                        ? String(localized: "Skip?")
                                        : String(localized: "Skip")
                                )
                            }
                            .tint(
                                skipConfirmation || !coordinator.watchSettings.confirmSkipRest
                                    ? .red
                                    : .secondary
                            )
                            .accessibilityLabel(
                                coordinator.watchSettings.confirmSkipRest && !skipConfirmation
                                    ? String(localized: "Skip rest, confirmation required")
                                    : String(localized: "Skip rest")
                            )
                        }
                    }

                    let adjustment = coordinator.watchSettings.restAdjustmentSeconds
                    HStack {
                        Button("−\(adjustment)s") {
                            coordinator.adjustRest(by: -adjustment)
                        }
                        .accessibilityLabel(
                            watchLocalizedFormat("Decrease rest by %lld seconds", adjustment)
                        )
                        Button("+\(adjustment)s") {
                            coordinator.adjustRest(by: adjustment)
                        }
                        .accessibilityLabel(
                            watchLocalizedFormat("Increase rest by %lld seconds", adjustment)
                        )
                    }
                    .font(.caption)

                    if let exercise = coordinator.selectedExercise,
                        let set = coordinator.currentSet
                    {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("NEXT SET")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(.secondary)
                            Text(exercise.name)
                                .font(.caption)
                                .fontWeight(.semibold)
                                .lineLimit(3)
                            Text(target(set))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: 10))
                    }
                }
                .padding(.horizontal, 7)
                .onChange(of: rest?.id) { _, _ in
                    skipConfirmation = false
                }
            }
        }
    }

    private func format(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let remainingSeconds = seconds % 60
        return "\(minutes):\(remainingSeconds < 10 ? "0" : "")\(remainingSeconds)"
    }

    private func target(_ set: WatchSet) -> String {
        if let duration = set.durationSeconds {
            return watchLocalizedFormat(
                "Target %lld seconds",
                duration
            )
        }
        let reps = Int(set.actualReps ?? set.targetReps ?? 0)
        if let load = set.actualLoadKg ?? set.targetLoadKg {
            return watchLocalizedFormat(
                "Target %lld × %@ kg",
                reps,
                load.formatted()
            )
        }
        return watchLocalizedFormat("Target %lld reps", reps)
    }
}
