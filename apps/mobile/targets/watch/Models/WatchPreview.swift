#if DEBUG
import Foundation

// Deterministic, isolated launch fixtures for small-watch layout verification.
@MainActor
extension WorkoutCoordinator {
    func configurePreview() {
        let args = ProcessInfo.processInfo.arguments
        guard let index = args.firstIndex(of: "--watch-preview"), args.indices.contains(index + 1) else { return }
        let scenario = args[index + 1]
        let polish = Locale.preferredLanguages.first?.hasPrefix("pl") == true
        let completed = scenario == "complete" || scenario == "exerciseComplete"
        let timed = scenario == "timed"
        let first = WatchExercise(id: "preview-1", catalogExerciseId: "preview-1",
            name: polish ? "Wyciskanie hantli na ławce skośnej" : "Incline dumbbell bench press",
            exerciseType: timed ? .time : .weight, restDurationSeconds: 90,
            notes: polish ? "Utrzymuj kontrolowane tempo ruchu." : "Keep the movement controlled.",
            sets: (0..<3).map { index in
                WatchSet(id: "preview-set-\(index)", type: index == 0 ? .warmup : .working,
                    targetLoadKg: 22.5, targetReps: 12, actualLoadKg: 22.5,
                    actualReps: 12, durationSeconds: timed ? 45 : nil,
                    isCompleted: completed || (scenario == "rest" && index == 0),
                    previousDisplay: "20 kg × 12")
            })
        let rows = WatchExercise(id: "preview-2", catalogExerciseId: "preview-2",
            name: polish ? "Wiosłowanie sztangą" : "Barbell row",
            exerciseType: .weight, restDurationSeconds: 120, notes: nil,
            sets: (0..<4).map { index in
                WatchSet(id: "preview-row-\(index)", type: .working,
                    targetLoadKg: 102.5, targetReps: 8, actualLoadKg: 102.5, actualReps: 8,
                    isCompleted: scenario == "complete" || (scenario == "list" && index < 1))
            })
        let plank = WatchExercise(id: "preview-3", catalogExerciseId: "preview-3",
            name: polish ? "Deska" : "Plank",
            exerciseType: .time, restDurationSeconds: 60, notes: nil,
            sets: (0..<3).map { index in
                WatchSet(id: "preview-plank-\(index)", type: .working, durationSeconds: 45,
                    isCompleted: scenario == "complete", targetDurationSeconds: 45)
            })
        snapshot = WatchWorkoutSnapshot(workoutId: "preview", name: polish ? "Trening całego ciała" : "Full body strength",
            status: scenario == "complete" ? .completed : .active,
            startedAt: .now.addingTimeInterval(-2835),
            finishedAt: scenario == "complete" ? .now : nil,
            selectedExerciseId: first.id,
            exercises: timed ? [first] : [first, rows, plank], weightUnit: "kg",
            warmup: WatchWarmup(durationSeconds: 300, isCompleted: scenario != "waiting"))
        if scenario == "rest" {
            snapshot?.rest = RestTimerState(id: "preview-rest", exerciseId: first.id,
                durationSeconds: 90, endDate: .now.addingTimeInterval(75))
        }
        switch scenario {
        case "rest": screen = .rest
        case "heartRate": screen = .heartRate
        case "exerciseComplete": screen = .exerciseComplete
        case "list": screen = .exerciseList
        case "details": screen = .details
        case "waiting": snapshot = nil
        default: screen = .activeSet
        }
    }
}
#endif
