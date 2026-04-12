import SwiftUI

struct ActiveWorkoutView: View {
    @Environment(WorkoutStore.self) private var store
    @State private var healthKit = HealthKitClient()

    var body: some View {
        TabView {
            ExerciseDetailView()
                .environment(healthKit)

            RestTimerView()

            HeartRateView()
                .environment(healthKit)
        }
        .tabViewStyle(.verticalPage)
        .task {
            let authorized = await healthKit.requestAuthorization()
            if authorized {
                await healthKit.startWorkoutSession()
            }
        }
        .onChange(of: store.isActive) { _, isActive in
            if !isActive {
                Task { await healthKit.endWorkoutSession() }
            }
        }
    }
}
