import SwiftUI

struct ContentView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        ZStack {
            WatchTheme.background
                .ignoresSafeArea()

            Group {
                if let snapshot = coordinator.snapshot {
                    if snapshot.status == .completed {
                        WorkoutCompleteView(snapshot: snapshot)
                    } else if snapshot.status == .active {
                        ActiveWorkoutView()
                    } else {
                        WaitingView()
                    }
                } else {
                    WaitingView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Keep rest alerts and automatic zero behavior alive even when
            // the user stays on the exercise screen (auto-show disabled) or
            // backs out of the dedicated timer view.
            RestTimerMonitor()
                .frame(width: 1, height: 1)
                .opacity(0)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .task { coordinator.start() }
    }
}

private struct RestTimerMonitor: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        Color.clear
            .task {
                while !Task.isCancelled {
                    coordinator.observeRest()
                    try? await Task.sleep(for: .seconds(1))
                }
            }
    }
}

struct WaitingView: View {
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "figure.strengthtraining.traditional")
                .font(.system(size: 34))
                .foregroundStyle(WatchTheme.primary)
            Text("Ready to train")
                .font(.headline)
            Text(
                "Start a workout on your iPhone. It will appear here even if your watch reconnects later."
            )
            .font(.caption2)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
        .accessibilityElement(children: .combine)
    }
}

private struct WorkoutCompleteView: View {
    let snapshot: WatchWorkoutSnapshot

    private var completedSets: Int {
        snapshot.exercises.flatMap(\.sets).filter(\.isCompleted).count
    }

    private var volume: Double {
        snapshot.exercises.flatMap(\.sets).filter(\.isCompleted).reduce(0) {
            $0 + ($1.actualLoadKg ?? 0) * ($1.actualReps ?? 0)
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 42))
                    .foregroundStyle(WatchTheme.success)
                    .accessibilityHidden(true)
                Text(
                    watchLocalizedFormat(
                        "%@ complete",
                        snapshot.name
                    )
                )
                .font(.headline)
                .multilineTextAlignment(.center)

                HStack {
                    summaryStat(
                        "\(completedSets)",
                        label: String(localized: "Sets")
                    )
                    summaryStat(
                        volume.formatted(
                            .number.precision(.fractionLength(0))
                        ),
                        label: String(localized: "kg volume")
                    )
                }

                ForEach(snapshot.exercises) { exercise in
                    HStack {
                        Text(exercise.name)
                            .lineLimit(2)
                        Spacer()
                        Text(
                            watchLocalizedFormat(
                                "%lld/%lld",
                                exercise.sets.filter(\.isCompleted).count,
                                exercise.sets.count
                            )
                        )
                        .foregroundStyle(.secondary)
                    }
                    .font(.caption)
                    .accessibilityElement(children: .combine)
                }

                Text("Open Sweaty on iPhone to save feedback and view your full summary.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 8)
        }
    }

    private func summaryStat(_ value: String, label: String) -> some View {
        VStack {
            Text(value).font(.headline).monospacedDigit()
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
    }
}
