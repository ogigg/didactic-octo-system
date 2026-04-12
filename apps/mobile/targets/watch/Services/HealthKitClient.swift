import Foundation
import HealthKit
import Observation

@Observable
final class HealthKitClient {
    var heartRate: Int?
    var isSessionActive = false

    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var heartRateQuery: HKAnchoredObjectQuery?

    func requestAuthorization() async -> Bool {
        let typesToShare: Set<HKSampleType> = [HKWorkoutType.workoutType()]
        let typesToRead: Set<HKObjectType> = [
            HKQuantityType.quantityType(forIdentifier: .heartRate)!,
            HKWorkoutType.workoutType(),
        ]

        do {
            try await healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead)
            return true
        } catch {
            return false
        }
    }

    func startWorkoutSession() async {
        let config = HKWorkoutConfiguration()
        config.activityType = .traditionalStrengthTraining
        config.locationType = .indoor

        do {
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)

            self.workoutSession = session
            self.builder = builder

            session.startActivity(with: .now)
            try await builder.beginCollection(at: .now)
            isSessionActive = true

            startHeartRateQuery()
        } catch {
            // handle error
        }
    }

    func endWorkoutSession() async {
        workoutSession?.end()
        stopHeartRateQuery()

        if let builder {
            try? await builder.endCollection(at: .now)
            try? await builder.finishWorkout()
        }

        workoutSession = nil
        self.builder = nil
        isSessionActive = false
        heartRate = nil
    }

    // MARK: - Heart Rate

    private func startHeartRateQuery() {
        guard let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate) else { return }

        let query = HKAnchoredObjectQuery(
            type: heartRateType,
            predicate: HKQuery.predicateForSamples(withStart: .now, end: nil),
            anchor: nil,
            limit: HKObjectQueryNoLimit
        ) { [weak self] _, samples, _, _, _ in
            self?.processHeartRateSamples(samples)
        }

        query.updateHandler = { [weak self] _, samples, _, _, _ in
            self?.processHeartRateSamples(samples)
        }

        healthStore.execute(query)
        heartRateQuery = query
    }

    private func stopHeartRateQuery() {
        if let query = heartRateQuery {
            healthStore.stop(query)
            heartRateQuery = nil
        }
    }

    private func processHeartRateSamples(_ samples: [HKSample]?) {
        guard let quantitySamples = samples as? [HKQuantitySample],
              let latest = quantitySamples.last
        else { return }

        let bpm = Int(latest.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute())))

        Task { @MainActor in
            self.heartRate = bpm
        }
    }
}
