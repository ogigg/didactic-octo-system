import SwiftUI

struct RestTimerView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @State private var skipConfirmation = false
    @State private var didAlertCompletion = false

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
                                if skipConfirmation {
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
                            .tint(skipConfirmation ? .red : .secondary)
                        }
                    }

                    HStack {
                        Button("−15s") { coordinator.adjustRest(by: -15) }
                        Button("+15s") { coordinator.adjustRest(by: 15) }
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
                .onChange(of: remaining) { oldValue, newValue in
                    if oldValue > 0, newValue == 0, !didAlertCompletion {
                        didAlertCompletion = true
                        HapticsClient.restTimerComplete()
                    }
                }
            }
        }
    }

    private func format(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
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
