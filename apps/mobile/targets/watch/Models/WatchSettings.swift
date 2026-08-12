import Foundation

let watchSettingsSchemaVersion = 1

/// Preferences owned by the iPhone and consumed by the Watch companion.
///
/// The decoder intentionally supplies a safe value for an absent or malformed
/// field. This keeps a first install usable when an older phone omits newer
/// fields, while unsupported schema versions are rejected by the envelope
/// decoder and cannot replace a previously persisted snapshot.
struct WatchSettingsSnapshot: Codable, Equatable {
    enum RestCompletionBehavior: String, Codable {
        case stayOnTimer
        case openNextSet
    }

    static let storageKey = "SweatyWatch.settings.v1"
    static let revisionKey = "SweatyWatch.settingsRevision"

    static let defaults = WatchSettingsSnapshot(
        restWarningSeconds: 10,
        restEndHapticsEnabled: true,
        restAdjustmentSeconds: 15,
        autoShowRestTimer: true,
        restCompletionBehavior: .stayOnTimer,
        setCompletionHapticsEnabled: true,
        confirmSkipRest: true,
        confirmEndWorkout: true,
        showHeartRate: true,
        showPreviousPerformance: true
    )

    let schemaVersion: Int
    let restWarningSeconds: Int
    let restEndHapticsEnabled: Bool
    let restAdjustmentSeconds: Int
    let autoShowRestTimer: Bool
    let restCompletionBehavior: RestCompletionBehavior
    let setCompletionHapticsEnabled: Bool
    let confirmSkipRest: Bool
    let confirmEndWorkout: Bool
    let showHeartRate: Bool
    let showPreviousPerformance: Bool

    init(
        restWarningSeconds: Int,
        restEndHapticsEnabled: Bool,
        restAdjustmentSeconds: Int,
        autoShowRestTimer: Bool,
        restCompletionBehavior: RestCompletionBehavior,
        setCompletionHapticsEnabled: Bool,
        confirmSkipRest: Bool,
        confirmEndWorkout: Bool,
        showHeartRate: Bool,
        showPreviousPerformance: Bool
    ) {
        schemaVersion = watchSettingsSchemaVersion
        self.restWarningSeconds = restWarningSeconds
        self.restEndHapticsEnabled = restEndHapticsEnabled
        self.restAdjustmentSeconds = restAdjustmentSeconds
        self.autoShowRestTimer = autoShowRestTimer
        self.restCompletionBehavior = restCompletionBehavior
        self.setCompletionHapticsEnabled = setCompletionHapticsEnabled
        self.confirmSkipRest = confirmSkipRest
        self.confirmEndWorkout = confirmEndWorkout
        self.showHeartRate = showHeartRate
        self.showPreviousPerformance = showPreviousPerformance
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // A missing schema is treated as a legacy payload, but a known,
        // unsupported schema must never silently replace persisted settings.
        if let schema = try? container.decode(Int.self, forKey: .schemaVersion),
            schema != watchSettingsSchemaVersion
        {
            throw WatchSettingsDecodeError.unsupportedSchema
        }

        let defaults = Self.defaults
        self.init(
            restWarningSeconds: Self.decodeAllowed(
                Int.self,
                from: container,
                forKey: .restWarningSeconds,
                allowed: [0, 5, 10, 15, 30],
                defaultValue: defaults.restWarningSeconds
            ),
            restEndHapticsEnabled: Self.decode(
                Bool.self,
                from: container,
                forKey: .restEndHapticsEnabled,
                defaultValue: defaults.restEndHapticsEnabled
            ),
            restAdjustmentSeconds: Self.decodeAllowed(
                Int.self,
                from: container,
                forKey: .restAdjustmentSeconds,
                allowed: [10, 15, 30],
                defaultValue: defaults.restAdjustmentSeconds
            ),
            autoShowRestTimer: Self.decode(
                Bool.self,
                from: container,
                forKey: .autoShowRestTimer,
                defaultValue: defaults.autoShowRestTimer
            ),
            restCompletionBehavior: Self.decodeAllowed(
                RestCompletionBehavior.self,
                from: container,
                forKey: .restCompletionBehavior,
                allowed: [.stayOnTimer, .openNextSet],
                defaultValue: defaults.restCompletionBehavior
            ),
            setCompletionHapticsEnabled: Self.decode(
                Bool.self,
                from: container,
                forKey: .setCompletionHapticsEnabled,
                defaultValue: defaults.setCompletionHapticsEnabled
            ),
            confirmSkipRest: Self.decode(
                Bool.self,
                from: container,
                forKey: .confirmSkipRest,
                defaultValue: defaults.confirmSkipRest
            ),
            confirmEndWorkout: Self.decode(
                Bool.self,
                from: container,
                forKey: .confirmEndWorkout,
                defaultValue: defaults.confirmEndWorkout
            ),
            showHeartRate: Self.decode(
                Bool.self,
                from: container,
                forKey: .showHeartRate,
                defaultValue: defaults.showHeartRate
            ),
            showPreviousPerformance: Self.decode(
                Bool.self,
                from: container,
                forKey: .showPreviousPerformance,
                defaultValue: defaults.showPreviousPerformance
            )
        )
    }

    static func decodeJSON(_ data: Data) -> WatchSettingsSnapshot? {
        try? JSONDecoder().decode(WatchSettingsSnapshot.self, from: data)
    }

    static func load(from defaultsStore: UserDefaults = .standard)
        -> WatchSettingsSnapshot
    {
        guard let data = defaultsStore.data(forKey: storageKey),
            let settings = decodeJSON(data)
        else {
            return .defaults
        }
        return settings
    }

    static func loadRevision(from defaultsStore: UserDefaults = .standard)
        -> Int64
    {
        guard
            let value = defaultsStore.object(forKey: revisionKey) as? NSNumber,
            value.int64Value > 0
        else {
            return 0
        }
        return value.int64Value
    }

    func persist(to defaultsStore: UserDefaults = .standard) {
        guard let data = try? JSONEncoder().encode(self) else { return }
        defaultsStore.set(data, forKey: Self.storageKey)
    }

    private enum CodingKeys: String, CodingKey {
        case schemaVersion
        case restWarningSeconds
        case restEndHapticsEnabled
        case restAdjustmentSeconds
        case autoShowRestTimer
        case restCompletionBehavior
        case setCompletionHapticsEnabled
        case confirmSkipRest
        case confirmEndWorkout
        case showHeartRate
        case showPreviousPerformance
    }

    private enum WatchSettingsDecodeError: Error {
        case unsupportedSchema
    }

    private static func decode<Value: Decodable>(
        _ type: Value.Type,
        from container: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys,
        defaultValue: Value
    ) -> Value {
        (try? container.decodeIfPresent(type, forKey: key)) ?? defaultValue
    }

    private static func decodeAllowed<Value: Decodable & Equatable>(
        _ type: Value.Type,
        from container: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys,
        allowed: [Value],
        defaultValue: Value
    ) -> Value {
        let value = decode(type, from: container, forKey: key, defaultValue: defaultValue)
        return allowed.contains(value) ? value : defaultValue
    }
}
