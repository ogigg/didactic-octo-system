import Foundation
import Observation

@Observable
final class WorkoutStore {
    var workout: WatchWorkout?
    var currentExerciseIndex: Int = 0
    var currentSetIndex: Int = 0
    var completedSets: [String: Set<Int>] = [:] // exerciseId -> set indices
    var restTimer: RestTimerState?

    var isActive: Bool { workout != nil }

    var currentExercise: WatchExercise? {
        guard let workout, currentExerciseIndex < workout.exercises.count else { return nil }
        return workout.exercises[currentExerciseIndex]
    }

    var currentSet: WatchSet? {
        guard let exercise = currentExercise, currentSetIndex < exercise.sets.count else { return nil }
        return exercise.sets[currentSetIndex]
    }

    var exerciseProgress: String {
        guard let workout else { return "" }
        return "\(currentExerciseIndex + 1)/\(workout.exercises.count)"
    }

    var setProgress: String {
        guard let exercise = currentExercise else { return "" }
        return "\(currentSetIndex + 1)/\(exercise.sets.count)"
    }

    func isSetCompleted(exerciseId: String, setIndex: Int) -> Bool {
        completedSets[exerciseId]?.contains(setIndex) == true
    }

    func completeSet(exerciseId: String, setIndex: Int, loadKg: Double, reps: Int) -> SetCompletion {
        var indices = completedSets[exerciseId] ?? []
        indices.insert(setIndex)
        completedSets[exerciseId] = indices

        return SetCompletion(
            exerciseId: exerciseId,
            setIndex: setIndex,
            loadKg: loadKg,
            reps: reps,
            completedAt: .now
        )
    }

    func startRest(durationSeconds: Int) {
        restTimer = RestTimerState(startedAt: .now, durationSeconds: durationSeconds)
    }

    func startRest(from state: RestTimerState) {
        restTimer = state
    }

    func clearRest() {
        restTimer = nil
    }

    func advanceToNextSet() {
        guard let exercise = currentExercise else { return }
        if currentSetIndex + 1 < exercise.sets.count {
            currentSetIndex += 1
        } else {
            advanceToNextExercise()
        }
    }

    func advanceToNextExercise() {
        guard let workout else { return }
        if currentExerciseIndex + 1 < workout.exercises.count {
            currentExerciseIndex += 1
            currentSetIndex = 0
        }
    }

    func reset() {
        workout = nil
        currentExerciseIndex = 0
        currentSetIndex = 0
        completedSets = [:]
        restTimer = nil
    }

    func applyState(from message: [String: Any]) {
        if let jsonString = message["workout"] as? String,
           let data = jsonString.data(using: .utf8) {
            workout = try? JSONDecoder().decode(WatchWorkout.self, from: data)
        }
        if let idx = message["currentExerciseIndex"] as? Int {
            currentExerciseIndex = idx
        }
        if let idx = message["currentSetIndex"] as? Int {
            currentSetIndex = idx
        }
        if let restString = message["restTimer"] as? String,
           let data = restString.data(using: .utf8) {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            restTimer = try? decoder.decode(RestTimerState.self, from: data)
        }
        if message["workoutEnded"] as? Bool == true {
            reset()
        }
    }
}
