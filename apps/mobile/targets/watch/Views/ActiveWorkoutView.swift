import SwiftUI

struct ActiveWorkoutView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        switch coordinator.screen {
        case .exerciseList:
            ExerciseListView()
        case .activeSet:
            ExerciseDetailView()
        case .rest:
            RestTimerView()
        case .heartRate:
            HeartRateView()
        case .exerciseComplete:
            ExerciseCompleteView()
        }
    }
}

private struct ExerciseListView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @State private var endConfirmation = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(
                            coordinator.snapshot?.name
                                ?? String(localized: "Workout")
                        )
                            .font(.headline)
                            .lineLimit(2)
                        Text(
                            watchLocalizedFormat(
                                "%lld/%lld sets",
                                coordinator.completedSetCount,
                                coordinator.totalSetCount
                            )
                        )
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                    Spacer()
                    HeartRateButton()
                }

                ForEach(coordinator.snapshot?.exercises ?? []) { exercise in
                    Button {
                        coordinator.selectExercise(exercise.id)
                    } label: {
                        HStack(spacing: 8) {
                            Image(
                                systemName: exercise.sets.allSatisfy(\.isCompleted)
                                    ? "checkmark.circle.fill"
                                    : exercise.id == coordinator.selectedExercise?.id
                                        ? "circle.inset.filled"
                                        : "circle"
                            )
                            .foregroundStyle(
                                exercise.sets.allSatisfy(\.isCompleted)
                                    ? WatchTheme.success : WatchTheme.primary
                            )
                            VStack(alignment: .leading, spacing: 2) {
                                Text(exercise.name)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .lineLimit(3)
                                    .multilineTextAlignment(.leading)
                                Text(exerciseSummary(exercise))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(
                                "\(exercise.sets.filter(\.isCompleted).count)/\(exercise.sets.count)"
                            )
                            .font(.caption2)
                            .monospacedDigit()
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(8)
                    .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: 11))
                    .accessibilityLabel(
                        watchLocalizedFormat(
                            "%@, %lld of %lld sets complete",
                            exercise.name,
                            exercise.sets.filter(\.isCompleted).count,
                            exercise.sets.count
                        )
                    )
                }

                Button(role: endConfirmation ? .destructive : nil) {
                    if !coordinator.watchSettings.confirmEndWorkout {
                        coordinator.finishWorkout()
                    } else if endConfirmation {
                        coordinator.finishWorkout()
                    } else {
                        endConfirmation = true
                    }
                } label: {
                    Text(
                        endConfirmation
                            ? String(localized: "Tap again to end")
                            : String(localized: "End workout")
                    )
                }
                .frame(maxWidth: .infinity)
                .accessibilityLabel(
                    coordinator.watchSettings.confirmEndWorkout && !endConfirmation
                        ? String(localized: "End workout, confirmation required")
                        : String(localized: "End workout")
                )
                .accessibilityHint(
                    coordinator.watchSettings.confirmEndWorkout && !endConfirmation
                        ? String(localized: "Tap twice to finish this workout")
                        : String(localized: "Finishes this workout")
                )
            }
            .padding(.horizontal, 6)
        }
    }

    private func exerciseSummary(_ exercise: WatchExercise) -> String {
        guard let set = exercise.sets.first else {
            return String(localized: "No sets")
        }
        let reps = Int(set.targetReps ?? 0)
        if exercise.exerciseType == .time {
            return watchLocalizedFormat(
                "%lld sets · %lld seconds",
                exercise.sets.count,
                set.durationSeconds ?? 0
            )
        }
        if let load = set.targetLoadKg {
            return watchLocalizedFormat(
                "%lld × %lld · %@ kg",
                exercise.sets.count,
                reps,
                load.formatted()
            )
        }
        return watchLocalizedFormat(
            "%lld × %lld",
            exercise.sets.count,
            reps
        )
    }
}

struct HeartRateButton: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        if coordinator.watchSettings.showHeartRate {
            Button {
                coordinator.screen = .heartRate
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "heart.fill")
                    Text(coordinator.health.heartRate.map(String.init) ?? "—")
                        .monospacedDigit()
                }
                .font(.caption)
                .foregroundStyle(.red)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(
                coordinator.health.heartRate.map {
                    watchLocalizedFormat("Heart rate %lld beats per minute", $0)
                } ?? String(localized: "Heart rate unavailable")
            )
        }
    }
}
