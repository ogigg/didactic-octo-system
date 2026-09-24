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
        case .details:
            WorkoutDetailsView()
        }
    }
}

private struct ExerciseListView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @State private var endConfirmation = false

    var body: some View {
        WatchScreen(
            title: String(localized: "Workout"),
            contentScrolls: true,
            headerAction: .details,
            primaryTitle: coordinator.isFinishing
                ? String(localized: "Saving")
                : String(localized: "End workout"),
            primaryRole: .destructive,
            primaryDisabled: coordinator.isFinishing,
            onPrimary: {
                if coordinator.watchSettings.confirmEndWorkout {
                    endConfirmation = true
                } else {
                    coordinator.finishWorkout()
                }
            }
        ) {
            VStack(alignment: .leading, spacing: 5) {
                ScrollView {
                    LazyVStack(spacing: 5) {
                        warmupRow

                        ForEach(coordinator.snapshot?.exercises ?? []) { exercise in
                            Button {
                                coordinator.selectExercise(exercise.id)
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: statusSymbol(for: exercise))
                                        .foregroundStyle(statusColor(for: exercise))
                                        .frame(width: 20)
                                        .accessibilityHidden(true)

                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(exercise.name)
                                            .font(.caption)
                                            .fontWeight(.semibold)
                                            .lineLimit(2)
                                            .multilineTextAlignment(.leading)
                                        Text(exerciseSummary(exercise))
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                    Spacer(minLength: 2)
                                    Text(
                                        watchLocalizedFormat(
                                            "%lld/%lld",
                                            exercise.sets.filter(\.isCompleted).count,
                                            exercise.sets.count
                                        )
                                    )
                                    .font(.caption2)
                                    .monospacedDigit()
                                    .foregroundStyle(.secondary)
                                }
                                .frame(minHeight: 42)
                            }
                            .buttonStyle(.plain)
                            .padding(.horizontal, 6)
                            .background(
                                WatchTheme.surface,
                                in: RoundedRectangle(cornerRadius: 9)
                            )
                            .accessibilityLabel(
                                watchLocalizedFormat(
                                    "%@, %lld of %lld sets complete",
                                    exercise.name,
                                    exercise.sets.filter(\.isCompleted).count,
                                    exercise.sets.count
                                )
                            )
                        }
                    }
                }
                .scrollIndicators(.hidden)
                .frame(maxHeight: .infinity)
            }
        }
        .confirmationDialog(
            String(localized: "End workout?"),
            isPresented: $endConfirmation,
            titleVisibility: .visible
        ) {
            Button(String(localized: "End workout"), role: .destructive) {
                coordinator.finishWorkout()
            }
            Button(String(localized: "Cancel"), role: .cancel) {}
        } message: {
            Text("You can still review this workout on your iPhone")
        }
    }

    @ViewBuilder
    private var warmupRow: some View {
        if let warmup = coordinator.snapshot?.warmup {
            Button {
                coordinator.setWarmupComplete(!warmup.isCompleted)
            } label: {
                HStack(spacing: 6) {
                    Image(
                        systemName: warmup.isCompleted
                            ? "checkmark.circle.fill"
                            : "circle"
                    )
                    .foregroundStyle(
                        warmup.isCompleted ? WatchTheme.success : WatchTheme.primary
                    )
                    Text(String(localized: "Warm-up"))
                        .font(.caption)
                    Spacer()
                    Text(
                        watchLocalizedFormat(
                            "%lld min",
                            Int((warmup.durationSeconds + 59) / 60)
                        )
                    )
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
                .frame(minHeight: 28)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(
                warmup.isCompleted
                    ? String(localized: "Warm-up complete")
                    : String(localized: "Mark warm-up complete")
            )
        }
    }

    private func statusSymbol(for exercise: WatchExercise) -> String {
        if exercise.sets.allSatisfy(\.isCompleted) { return "checkmark.circle.fill" }
        if exercise.id == coordinator.selectedExercise?.id { return "circle.inset.filled" }
        return "circle"
    }

    private func statusColor(for exercise: WatchExercise) -> Color {
        exercise.sets.allSatisfy(\.isCompleted) ? WatchTheme.success : WatchTheme.primary
    }

    private func exerciseSummary(_ exercise: WatchExercise) -> String {
        guard !exercise.sets.isEmpty else { return String(localized: "No sets") }
        let kind = exercise.exerciseType == .time
            ? String(localized: "Timed")
            : String(localized: "Strength")
        return watchLocalizedFormat("%lld sets · %@", exercise.sets.count, kind)
    }
}
