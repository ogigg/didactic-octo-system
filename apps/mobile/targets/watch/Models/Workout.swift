import Foundation

let watchSyncProtocolVersion = 1

struct WatchWorkoutSnapshot: Codable, Equatable {
    var workoutId: String
    var name: String
    var status: Status
    var startedAt: Date
    var finishedAt: Date?
    var selectedExerciseId: String?
    var exercises: [WatchExercise]
    var rest: RestTimerState?

    enum Status: String, Codable {
        case active
        case completed
    }
}

struct WatchExercise: Codable, Equatable, Identifiable {
    var id: String
    var name: String
    var exerciseType: ExerciseType
    var restDurationSeconds: Int
    var notes: String?
    var progressionType: String?
    var sets: [WatchSet]

    enum ExerciseType: String, Codable {
        case weight
        case time
    }
}

struct WatchSet: Codable, Equatable, Identifiable {
    var id: String
    var type: SetType
    var targetLoadKg: Double?
    var targetReps: Double?
    var actualLoadKg: Double?
    var actualReps: Double?
    var durationSeconds: Int?
    var isCompleted: Bool
    var previousDisplay: String?

    enum SetType: String, Codable {
        case warmup
        case working
    }
}

struct WatchSyncEnvelope {
    let revision: Int
    let snapshot: WatchWorkoutSnapshot
    let acknowledgedCommandIDs: [String]

    init?(dictionary: [String: Any]) {
        guard (dictionary["protocolVersion"] as? NSNumber)?.intValue == watchSyncProtocolVersion,
              let revision = (dictionary["revision"] as? NSNumber)?.intValue,
              let payload = dictionary["payload"] as? String,
              let data = payload.data(using: .utf8)
        else { return nil }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let snapshot = try? decoder.decode(WatchWorkoutSnapshot.self, from: data)
        else { return nil }

        self.revision = revision
        self.snapshot = snapshot
        acknowledgedCommandIDs =
            dictionary["acknowledgedCommandIDs"] as? [String] ?? []
    }
}

struct WatchCommand: Codable, Identifiable {
    let protocolVersion: Int
    let commandID: String
    let baseRevision: Int
    let sentAt: String
    let type: CommandType
    let payload: String

    var id: String { commandID }

    enum CommandType: String, Codable {
        case selectExercise
        case updateSet
        case completeSet
        case adjustRest
        case pauseRest
        case resumeRest
        case skipRest
        case healthWorkoutStarted
        case finishWorkout
    }

    var dictionary: [String: Any] {
        [
            "protocolVersion": protocolVersion,
            "commandID": commandID,
            "baseRevision": baseRevision,
            "sentAt": sentAt,
            "type": type.rawValue,
            "payload": payload,
        ]
    }
}
