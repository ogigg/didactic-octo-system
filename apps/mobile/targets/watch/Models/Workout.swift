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
    var weightUnit: String?
    var warmup: WatchWarmup?

    enum Status: String, Codable {
        case active
        case completed
        case cancelled
    }
}

struct WatchWarmup: Codable, Equatable {
    var durationSeconds: Int
    var isCompleted: Bool
}

struct WatchExercise: Codable, Equatable, Identifiable {
    var id: String
    var catalogExerciseId: String
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
    var targetDurationSeconds: Int?

    enum SetType: String, Codable {
        case warmup
        case working
    }
}

struct WatchSyncEnvelope {
    let revision: Int64
    let snapshot: WatchWorkoutSnapshot
    let acknowledgedCommandIDs: [String]

    init?(dictionary: [String: Any]) {
        guard (dictionary["protocolVersion"] as? NSNumber)?.intValue == watchSyncProtocolVersion,
            let revision = (dictionary["revision"] as? NSNumber)?.int64Value,
            let payload = dictionary["payload"] as? String,
            let data = payload.data(using: .utf8)
        else { return nil }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Invalid workout date"))
        }
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
    let baseRevision: Int64
    let sentAt: String
    let type: CommandType
    let payload: String

    var id: String { commandID }

    var decodedPayload: [String: Any] {
        guard let data = payload.data(using: .utf8),
              let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }
        return value
    }

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
        case requestState
        case reopenSet
        case setWarmupComplete
        case healthWorkoutSaved
        case healthWorkoutFailed
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
