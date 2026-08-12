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
        case cancelled
    }
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

    enum SetType: String, Codable {
        case warmup
        case working
    }
}

struct WatchSyncEnvelope {
    let revision: Int64
    let snapshot: WatchWorkoutSnapshot
    let acknowledgedCommandIDs: [String]
    let settingsRevision: Int64?
    let settings: WatchSettingsSnapshot?

    /// A settings-only payload is delivered through user-info/message and is
    /// decoded by `WatchSettingsEnvelope`. Workout contexts may carry an
    /// additive settings snapshot so a later context can heal a missed
    /// immediate settings message without changing the legacy workout JSON.
    var hasSettings: Bool { settingsRevision != nil && settings != nil }

    init?(dictionary: [String: Any]) {
        guard (dictionary["protocolVersion"] as? NSNumber)?.intValue == watchSyncProtocolVersion,
            let revision = (dictionary["revision"] as? NSNumber)?.int64Value,
            revision > 0,
            let payload = dictionary["payload"] as? String,
            let data = payload.data(using: .utf8)
        else { return nil }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let snapshot = try? decoder.decode(WatchWorkoutSnapshot.self, from: data)
        else { return nil }

        var parsedSettings: WatchSettingsSnapshot?
        var parsedSettingsRevision: Int64?
        if let rawSettingsRevision = dictionary["settingsRevision"] as? NSNumber {
            let candidateRevision = rawSettingsRevision.int64Value
            if candidateRevision > 0,
                let settingsPayload = dictionary["watchSettingsPayload"] as? String,
                let settingsData = settingsPayload.data(using: .utf8),
                let candidateSettings = WatchSettingsSnapshot.decodeJSON(settingsData)
            {
                parsedSettingsRevision = candidateRevision
                parsedSettings = candidateSettings
            }
        }

        self.revision = revision
        self.snapshot = snapshot
        self.settingsRevision = parsedSettingsRevision
        self.settings = parsedSettings
        acknowledgedCommandIDs =
            dictionary["acknowledgedCommandIDs"] as? [String] ?? []
    }
}

/// Versioned settings-only user-info/message payload. It deliberately has no
/// workout fields, so applying it cannot reset the active workout or command
/// outbox on the Watch.
struct WatchSettingsEnvelope {
    let settingsRevision: Int64
    let sentAt: String
    let settings: WatchSettingsSnapshot

    init?(dictionary: [String: Any]) {
        guard
            (dictionary["protocolVersion"] as? NSNumber)?.intValue ==
                watchSyncProtocolVersion,
            dictionary["kind"] as? String == "watchSettings",
            let revision = (dictionary["settingsRevision"] as? NSNumber)?.int64Value,
            revision > 0,
            let sentAt = dictionary["sentAt"] as? String,
            !sentAt.isEmpty,
            let payload = dictionary["payload"] as? String,
            let data = payload.data(using: .utf8),
            let settings = WatchSettingsSnapshot.decodeJSON(data)
        else {
            return nil
        }

        settingsRevision = revision
        self.sentAt = sentAt
        self.settings = settings
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
