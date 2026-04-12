import SwiftUI

struct ExerciseDetailView: View {
    @Environment(WorkoutStore.self) private var store
    @Environment(WatchConnectivityClient.self) private var connectivity
    @Environment(HealthKitClient.self) private var healthKit

    @State private var loadKg: Double = 0
    @State private var reps: Int = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                if let exercise = store.currentExercise {
                    // Header
                    HStack {
                        Text(exercise.name)
                            .font(.headline)
                            .lineLimit(2)
                        Spacer()
                        if let hr = healthKit.heartRate {
                            Label("\(hr)", systemImage: "heart.fill")
                                .font(.caption2)
                                .foregroundStyle(.red)
                        }
                    }

                    Text("Exercise \(store.exerciseProgress) · Set \(store.setProgress)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    if let previous = exercise.previousDisplay {
                        Text("Previous: \(previous)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Divider()

                    // Weight picker
                    SetLoggerView(loadKg: $loadKg, reps: $reps)

                    // Done button
                    Button {
                        completeCurrentSet()
                    } label: {
                        Text("Done")
                            .frame(maxWidth: .infinity)
                    }
                    .tint(.green)
                } else {
                    Text("Workout complete!")
                        .font(.headline)
                }
            }
            .padding(.horizontal)
        }
        .onChange(of: store.currentSet) { _, newSet in
            if let set = newSet {
                loadKg = set.targetLoadKg ?? 0
                reps = set.targetReps ?? 0
            }
        }
        .onAppear {
            if let set = store.currentSet {
                loadKg = set.targetLoadKg ?? 0
                reps = set.targetReps ?? 0
            }
        }
    }

    private func completeCurrentSet() {
        guard let exercise = store.currentExercise else { return }

        let completion = store.completeSet(
            exerciseId: exercise.id,
            setIndex: store.currentSetIndex,
            loadKg: loadKg,
            reps: reps
        )
        connectivity.sendSetCompletion(completion)
        HapticsClient.setCompleted()

        // Start rest timer then advance
        store.startRest(durationSeconds: exercise.restDurationSeconds)
        store.advanceToNextSet()
    }
}
