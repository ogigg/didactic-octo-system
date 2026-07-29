import Foundation
import HealthKit
import Observation

@MainActor
@Observable
final class HealthKitClient: NSObject, HKWorkoutSessionDelegate,
    HKLiveWorkoutBuilderDelegate
{
    var heartRate: Int?
    var isSessionActive = false

    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    func startWorkout(at startDate: Date) async -> Bool {
        guard HKHealthStore.isHealthDataAvailable(), !isSessionActive else {
            return isSessionActive
        }
        let workoutType = HKWorkoutType.workoutType()
        let heartRateType = HKQuantityType(.heartRate)
        do {
            try await healthStore.requestAuthorization(
                toShare: [workoutType],
                read: [heartRateType]
            )
            let configuration = HKWorkoutConfiguration()
            configuration.activityType = .traditionalStrengthTraining
            configuration.locationType = .indoor

            let session = try HKWorkoutSession(
                healthStore: healthStore,
                configuration: configuration
            )
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )
            session.delegate = self
            builder.delegate = self
            workoutSession = session
            self.builder = builder
            session.startActivity(with: startDate)
            try await builder.beginCollection(at: startDate)
            isSessionActive = true
            return true
        } catch {
            print("[SweatyWatch] HealthKit start failed:", error)
            return false
        }
    }

    func endWorkout() async -> UUID? {
        guard isSessionActive, let builder else { return nil }
        workoutSession?.end()
        do {
            try await builder.endCollection(at: .now)
            let workout = try await builder.finishWorkout()
            reset()
            return workout?.uuid
        } catch {
            print("[SweatyWatch] HealthKit finish failed:", error)
            reset()
            return nil
        }
    }

    nonisolated func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {}

    nonisolated func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didFailWithError error: Error
    ) {
        Task { @MainActor in self.reset() }
    }

    nonisolated func workoutBuilderDidCollectEvent(
        _ workoutBuilder: HKLiveWorkoutBuilder
    ) {}

    nonisolated func workoutBuilder(
        _ workoutBuilder: HKLiveWorkoutBuilder,
        didCollectDataOf collectedTypes: Set<HKSampleType>
    ) {
        guard collectedTypes.contains(HKQuantityType(.heartRate)) else { return }
        Task { @MainActor in
            guard let statistics = workoutBuilder.statistics(
                for: HKQuantityType(.heartRate)
            ), let quantity = statistics.mostRecentQuantity() else { return }
            let unit = HKUnit.count().unitDivided(by: .minute())
            self.heartRate = Int(quantity.doubleValue(for: unit).rounded())
        }
    }

    private func reset() {
        workoutSession = nil
        builder = nil
        isSessionActive = false
        heartRate = nil
    }
}
