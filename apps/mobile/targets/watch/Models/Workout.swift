import Foundation

struct WatchWorkout: Codable, Identifiable {
    let id: String
    let name: String
    let exercises: [WatchExercise]
}

struct WatchExercise: Codable, Identifiable {
    let id: String
    let name: String
    let restDurationSeconds: Int
    let notes: String?
    let sets: [WatchSet]
    let progressionType: String?
    let previousDisplay: String?
}

struct WatchSet: Codable, Identifiable {
    let id: String
    let setType: SetType
    let targetLoadKg: Double?
    let targetReps: Int?

    enum SetType: String, Codable {
        case warmup
        case working
    }
}

struct SetCompletion: Codable {
    let exerciseId: String
    let setIndex: Int
    let loadKg: Double
    let reps: Int
    let completedAt: Date
}
