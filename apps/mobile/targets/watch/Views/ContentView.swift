import SwiftUI

struct ContentView: View {
    @Environment(WorkoutStore.self) private var workoutStore
    @Environment(WatchConnectivityClient.self) private var connectivity

    var body: some View {
        Group {
            if workoutStore.isActive {
                ActiveWorkoutView()
            } else {
                WaitingView()
            }
        }
        .onAppear {
            connectivity.activate(workoutStore: workoutStore)
        }
    }
}

struct WaitingView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "figure.strengthtraining.traditional")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("Start a workout\non your phone")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
    }
}
