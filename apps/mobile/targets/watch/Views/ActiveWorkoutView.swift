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
                        Text(coordinator.snapshot?.name ?? "Workout")
                            .font(.headline)
                            .lineLimit(2)
                        Text("\(coordinator.completedSetCount)/\(coordinator.totalSetCount) sets")
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
                            Image(systemName: exercise.sets.allSatisfy(\.isCompleted)
                                ? "checkmark.circle.fill"
                                : exercise.id == coordinator.selectedExercise?.id
                                    ? "circle.inset.filled"
                                    : "circle")
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
                            Text("\(exercise.sets.filter(\.isCompleted).count)/\(exercise.sets.count)")
                                .font(.caption2)
                                .monospacedDigit()
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(8)
                    .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: 11))
                    .accessibilityLabel("\(exercise.name), \(exercise.sets.filter(\.isCompleted).count) of \(exercise.sets.count) sets complete")
                }

                Button(
                    endConfirmation ? "Tap again to end" : "End workout",
                    role: endConfirmation ? .destructive : nil
                ) {
                    if endConfirmation {
                        coordinator.finishWorkout()
                    } else {
                        endConfirmation = true
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 6)
        }
    }

    private func exerciseSummary(_ exercise: WatchExercise) -> String {
        guard let set = exercise.sets.first else { return "No sets" }
        let reps = Int(set.targetReps ?? 0)
        if exercise.exerciseType == .time {
            return "\(exercise.sets.count) sets · \(set.durationSeconds ?? 0)s"
        }
        if let load = set.targetLoadKg {
            return "\(exercise.sets.count) × \(reps) · \(load.formatted()) kg"
        }
        return "\(exercise.sets.count) × \(reps)"
    }
}

struct HeartRateButton: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
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
            coordinator.health.heartRate.map { "Heart rate \($0) beats per minute" }
                ?? "Heart rate unavailable"
        )
    }
}
