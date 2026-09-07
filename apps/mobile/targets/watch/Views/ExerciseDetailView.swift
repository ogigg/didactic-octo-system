import SwiftUI

struct ExerciseDetailView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    @Environment(\.dynamicTypeSize) private var textSize

    private var selectedExercise: WatchExercise? { coordinator.selectedExercise }
    private var currentSet: WatchSet? { coordinator.currentSet }
    private var isTimed: Bool { selectedExercise?.exerciseType == .time }
    private var isTimedSetStarted: Bool { coordinator.timedSetEnd != nil }

    var body: some View {
        WatchScreen(
            title: headerTitle,
            onBack: { coordinator.navigate(.exerciseList) },
            headerAction: .details,
            primaryTitle: primaryTitle,
            primaryTint: WatchTheme.primary,
            primaryDisabled: coordinator.isFinishing,
            onPrimary: primaryAction
        ) {
            VStack(alignment: .leading, spacing: 4) {
                if let exercise = selectedExercise, currentSet != nil {
                    Text(exercise.name)
                        .font(textSize > .large ? .headline : .system(size: 13, weight: .semibold))
                        .lineLimit(textSize > .large ? nil : 2)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .top)
                        .frame(height: textSize > .large ? nil : 32, alignment: .top)

                    SetLoggerView()
                        .frame(maxWidth: .infinity)
                        .frame(height: textSize > .large ? nil : 38)
                } else {
                    Text(String(localized: "No set is ready"))
                        .font(.headline)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                }
            }
        }
    }

    private var headerTitle: String {
        guard let exercise = selectedExercise, let set = currentSet else { return String(localized: "Workout") }
        let number = setIndexLabel(exercise: exercise, set: set)
        return set.type == .warmup ? watchLocalizedFormat("%@ warm-up", number) : number
    }

    private var primaryTitle: String {
        guard currentSet != nil else { return String(localized: "Exercise complete") }
        if isTimed, !isTimedSetStarted { return String(localized: "Start timer") }
        return String(localized: "Log set")
    }

    private func primaryAction() {
        guard currentSet != nil else { return }
        if isTimed, !isTimedSetStarted {
            coordinator.startTimedSet()
        } else {
            coordinator.completeCurrentSet()
        }
    }

    private func setIndexLabel(exercise: WatchExercise, set: WatchSet) -> String {
        let index = (exercise.sets.firstIndex(where: { $0.id == set.id }) ?? 0) + 1
        return watchLocalizedFormat("%lld/%lld", index, exercise.sets.count)
    }

}

struct ExerciseCompleteView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @State private var finishConfirmation = false

    var body: some View {
        WatchScreen(
            title: String(localized: "Complete"),
            onBack: { coordinator.navigate(.exerciseList) },
            headerAction: .details,
            primaryTitle: coordinator.hasNextExercise
                ? String(localized: "Start next exercise")
                : String(localized: "Finish workout"),
            primaryTint: WatchTheme.success,
            primaryRole: coordinator.hasNextExercise ? nil : .destructive,
            onPrimary: {
                if coordinator.hasNextExercise {
                    coordinator.showNextExercise()
                } else {
                    finishConfirmation = true
                }
            }
        ) {
            VStack(spacing: 4) {
                Text(coordinator.selectedExercise?.name ?? String(localized: "Exercise complete"))
                    .font(.system(size: 13, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .frame(height: 32)
                Label(watchLocalizedFormat("%lld sets", coordinator.selectedExercise?.sets.filter(\.isCompleted).count ?? 0), systemImage: "checkmark.circle.fill")
                    .font(.caption2)
                    .foregroundStyle(WatchTheme.success)
            }
            .frame(maxWidth: .infinity)

        }
        .confirmationDialog(
            String(localized: "Finish workout?"),
            isPresented: $finishConfirmation,
            titleVisibility: .visible
        ) {
            Button(String(localized: "Finish workout"), role: .destructive) {
                coordinator.finishWorkout()
            }
            Button(String(localized: "Cancel"), role: .cancel) {}
        } message: {
            Text("You can still review this workout on your iPhone")
        }
    }

}
