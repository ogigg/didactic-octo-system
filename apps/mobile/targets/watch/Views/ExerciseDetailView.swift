import SwiftUI

struct ExerciseDetailView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    @Environment(\.dynamicTypeSize) private var textSize

    private var selectedExercise: WatchExercise? { coordinator.selectedExercise }
    private var currentSet: WatchSet? { coordinator.currentSet }
    private var isTimed: Bool { selectedExercise?.exerciseType == .time }
    private var isTimedSetStarted: Bool { coordinator.timedSetEnd != nil }
    private var isLargeText: Bool { textSize > .large }

    var body: some View {
        WatchScreen(
            title: headerTitle,
            titleTint: currentSet?.type == .warmup ? WatchTheme.gold : .primary,
            onBack: { coordinator.navigate(.exerciseList) },
            headerAction: .details,
            accent: isTimedSetStarted ? WatchTheme.success : WatchTheme.primary,
            primaryTitle: primaryTitle,
            primarySymbol: primarySymbol,
            primaryTint: isTimed && !isTimedSetStarted ? WatchTheme.success : WatchTheme.primary,
            primaryDisabled: coordinator.isFinishing,
            onPrimary: primaryAction
        ) {
            if let exercise = selectedExercise, let set = currentSet {
                // Values lead at large text sizes so logging never needs a scroll.
                VStack(alignment: .leading, spacing: 3) {
                    if isLargeText {
                        SetLoggerView()
                        exerciseTitle(exercise)
                    } else {
                        exerciseTitle(exercise)
                        SetLoggerView()
                    }
                    SetProgressBar(sets: exercise.sets, currentSetID: set.id)
                        .padding(.horizontal, 2)
                    let previous = coordinator.watchSettings.showPreviousPerformance ? set.previousDisplay : nil
                    // With automatic rest presentation off, keep the running
                    // rest one tap away from the set logger.
                    let rest = coordinator.watchSettings.autoShowRestTimer ? nil : coordinator.snapshot?.rest
                    if previous != nil || rest != nil {
                        // One shared row keeps the 40 mm screen free of scrolling.
                        HStack(spacing: 4) {
                            if let previous {
                                Text(watchLocalizedFormat("Previous %@", previous))
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            if let rest { restShortcut(rest) }
                        }
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .monospacedDigit()
                        .padding(.horizontal, 2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .top)
            } else {
                Text(String(localized: "No set is ready"))
                    .font(.headline)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            }
        }
    }

    private func restShortcut(_ rest: RestTimerState) -> some View {
        let remaining = rest.remainingSeconds(at: coordinator.now)
        return Button { coordinator.navigate(.rest) } label: {
            Label(String(format: "%d:%02d", remaining / 60, remaining % 60), systemImage: "timer")
                .fontWeight(.semibold)
                .fixedSize()
        }
        .buttonStyle(.plain)
        .foregroundStyle(WatchTheme.primary)
        .accessibilityLabel(watchLocalizedFormat("Open rest timer, %lld seconds remaining", remaining))
    }

    private func exerciseTitle(_ exercise: WatchExercise) -> some View {
        Text(exercise.name)
            .font(.system(size: 15, weight: .semibold, design: .rounded))
            .lineLimit(isLargeText ? 2 : 1)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 2)
    }

    private var headerTitle: String {
        guard let exercise = selectedExercise, let set = currentSet else { return String(localized: "Workout") }
        let index = (exercise.sets.firstIndex(where: { $0.id == set.id }) ?? 0) + 1
        return set.type == .warmup
            ? watchLocalizedFormat("Warm-up %lld/%lld", index, exercise.sets.count)
            : watchLocalizedFormat("Set %lld/%lld", index, exercise.sets.count)
    }

    private var primaryTitle: String {
        guard currentSet != nil else { return String(localized: "Exercise complete") }
        if isTimed, !isTimedSetStarted { return String(localized: "Start timer") }
        return String(localized: "Log set")
    }

    private var primarySymbol: String? {
        guard currentSet != nil else { return nil }
        return isTimed && !isTimedSetStarted ? "play.fill" : "checkmark"
    }

    private func primaryAction() {
        guard currentSet != nil else { return }
        if isTimed, !isTimedSetStarted {
            coordinator.startTimedSet()
        } else {
            coordinator.completeCurrentSet()
        }
    }
}

struct ExerciseCompleteView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @State private var finishConfirmation = false

    private var nextExercise: WatchExercise? {
        coordinator.snapshot?.exercises.first {
            $0.id != coordinator.selectedExercise?.id && $0.sets.contains { !$0.isCompleted }
        }
    }

    var body: some View {
        WatchScreen(
            title: String(localized: "Complete"),
            titleTint: WatchTheme.success,
            onBack: { coordinator.navigate(.exerciseList) },
            headerAction: .details,
            accent: WatchTheme.success,
            primaryTitle: coordinator.hasNextExercise
                ? String(localized: "Start next exercise")
                : String(localized: "Finish workout"),
            primarySymbol: coordinator.hasNextExercise ? "arrow.right" : "flag.checkered",
            primaryTint: WatchTheme.success,
            primaryRole: coordinator.hasNextExercise ? nil : .destructive,
            onPrimary: {
                if coordinator.hasNextExercise {
                    coordinator.showNextExercise()
                } else {
                    finishConfirmation = coordinator.finishOrRequestConfirmation()
                }
            }
        ) {
            VStack(spacing: 3) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(WatchTheme.success)
                    .shadow(color: WatchTheme.success.opacity(0.6), radius: 8)
                    .accessibilityHidden(true)
                Text(coordinator.selectedExercise?.name ?? String(localized: "Exercise complete"))
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                Text(
                    WatchSummary.setsAndVolume(
                        coordinator.selectedExercise?.sets ?? [],
                        unit: coordinator.weightUnit
                    )
                )
                .font(.caption2)
                .monospacedDigit()
                .foregroundStyle(WatchTheme.success)
                if let nextExercise {
                    Text(watchLocalizedFormat("Next: %@", nextExercise.name))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .workoutEndConfirmation(isPresented: $finishConfirmation, isFinish: true)
    }
}
