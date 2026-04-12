import SwiftUI

@main
struct WorkoutWatchApp: App {
    @State private var workoutStore = WorkoutStore()
    @State private var connectivityClient = WatchConnectivityClient()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(workoutStore)
                .environment(connectivityClient)
        }
    }
}
