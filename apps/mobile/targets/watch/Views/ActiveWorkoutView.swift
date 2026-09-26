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

    private enum Primary { case resume, next, finish }

    private var primary: Primary {
        if coordinator.currentSet != nil { return .resume }
        return coordinator.hasNextExercise ? .next : .finish
    }

    var body: some View {
        WatchScreen(
            title: coordinator.snapshot?.name ?? String(localized: "Workout"),
            contentScrolls: true,
            headerAction: .details,
            primaryTitle: primaryTitle,
            primarySymbol: primary == .finish ? "flag.checkered" : "play.fill",
            primaryTint: primary == .finish ? WatchTheme.success : WatchTheme.primary,
            primaryDisabled: coordinator.isFinishing,
            onPrimary: primaryAction
        ) {
            ScrollViewReader { reader in
                ScrollView {
                    LazyVStack(spacing: 4) {
                        warmupRow

                        ForEach(coordinator.snapshot?.exercises ?? []) { exercise in
                            exerciseRow(exercise)
                                .id(exercise.id)
                        }

                        if primary != .finish {
                            Button(role: .destructive, action: requestEnd) {
                                Text(String(localized: "End workout"))
                                    .font(.system(.footnote, design: .rounded).weight(.semibold))
                                    .foregroundStyle(WatchTheme.danger)
                                    .frame(maxWidth: .infinity, minHeight: 32)
                            }
                            .buttonStyle(WatchPressStyle())
                            .disabled(coordinator.isFinishing)
                            .padding(.top, 4)
                        }
                    }
                    .padding(.bottom, 2)
                }
                .scrollIndicators(.hidden)
                .frame(maxHeight: .infinity)
                .onAppear {
                    if let id = coordinator.selectedExercise?.id { reader.scrollTo(id, anchor: .center) }
                }
            }
        }
        .workoutEndConfirmation(isPresented: $endConfirmation, isFinish: primary == .finish)
    }

    private var primaryTitle: String {
        if coordinator.isFinishing { return String(localized: "Saving") }
        switch primary {
        case .resume: return String(localized: "Continue")
        case .next: return String(localized: "Start next exercise")
        case .finish: return String(localized: "Finish workout")
        }
    }

    private func primaryAction() {
        switch primary {
        case .resume: coordinator.navigate(.activeSet)
        case .next: coordinator.showNextExercise()
        case .finish: requestEnd()
        }
    }

    private func requestEnd() {
        endConfirmation = coordinator.finishOrRequestConfirmation()
    }

    private func exerciseRow(_ exercise: WatchExercise) -> some View {
        let done = exercise.sets.filter(\.isCompleted).count
        let isComplete = !exercise.sets.isEmpty && done == exercise.sets.count
        let isCurrent = exercise.id == coordinator.selectedExercise?.id && !isComplete
        return Button {
            coordinator.selectExercise(exercise.id)
        } label: {
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: statusSymbol(exercise, isComplete: isComplete, isCurrent: isCurrent))
                    .font(.system(size: 14))
                    .foregroundStyle(isComplete ? WatchTheme.success : (isCurrent ? WatchTheme.primary : .secondary))
                    .frame(width: 16)
                    .padding(.top, 1)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 1) {
                    Text(exercise.name)
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(isComplete ? .secondary : .primary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(watchLocalizedFormat("%lld/%lld sets", done, exercise.sets.count))
                        .font(.caption2)
                        .monospacedDigit()
                        .foregroundStyle(isCurrent ? WatchTheme.primary : .secondary)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: WatchLayout.cardRadius)
                    .fill(isCurrent ? WatchTheme.primary.opacity(0.14) : WatchTheme.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: WatchLayout.cardRadius)
                    .strokeBorder(isCurrent ? WatchTheme.primary.opacity(0.7) : .clear, lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: WatchLayout.cardRadius))
        }
        .buttonStyle(WatchPressStyle())
        .accessibilityLabel(
            watchLocalizedFormat("%@, %lld of %lld sets complete", exercise.name, done, exercise.sets.count)
        )
    }

    @ViewBuilder
    private var warmupRow: some View {
        if let warmup = coordinator.snapshot?.warmup {
            Button {
                coordinator.setWarmupComplete(!warmup.isCompleted)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: warmup.isCompleted ? "checkmark.circle.fill" : "flame")
                        .font(.system(size: 14))
                        .foregroundStyle(warmup.isCompleted ? WatchTheme.success : WatchTheme.gold)
                        .frame(width: 16)
                    Text(String(localized: "Warm-up"))
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(warmup.isCompleted ? .secondary : .primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .layoutPriority(1)
                    Spacer(minLength: 4)
                    Text(watchLocalizedFormat("%lld min", Int((warmup.durationSeconds + 59) / 60)))
                        .font(.caption2)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .fixedSize()
                }
                .padding(.horizontal, 8)
                .frame(minHeight: 36)
                .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: WatchLayout.cardRadius))
            }
            .buttonStyle(WatchPressStyle())
            .accessibilityLabel(
                warmup.isCompleted
                    ? String(localized: "Warm-up complete")
                    : String(localized: "Mark warm-up complete")
            )
        }
    }

    private func statusSymbol(_ exercise: WatchExercise, isComplete: Bool, isCurrent: Bool) -> String {
        if isComplete { return "checkmark.circle.fill" }
        if isCurrent { return "play.circle.fill" }
        return exercise.exerciseType == .time ? "timer" : "circle"
    }
}
