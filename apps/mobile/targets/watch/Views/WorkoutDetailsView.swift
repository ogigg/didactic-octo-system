import SwiftUI

struct WorkoutDetailsView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    private var lastCompletedSet: WatchSet? {
        coordinator.selectedExercise?.sets.last(where: \.isCompleted)
    }

    var body: some View {
        WatchScreen(
            title: String(localized: "Details"),
            contentScrolls: true,
            onBack: { coordinator.goBack() },
            headerAction: .none
        ) {
            ScrollView {
                VStack(alignment: .leading, spacing: 7) {
                    if let snapshot = coordinator.snapshot {
                        Text(snapshot.name).font(.headline)
                        Text(watchLocalizedFormat("%lld/%lld sets", coordinator.completedSetCount, coordinator.totalSetCount))
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                    SyncStatusSummary()
                    Button(String(localized: "Sync now")) { coordinator.connectivity.requestState() }
                        .buttonStyle(.bordered)
                    if coordinator.watchSettings.showHeartRate {
                        Button(String(localized: "Heart rate")) { coordinator.navigate(.heartRate) }
                            .buttonStyle(.bordered)
                    }

                    if coordinator.healthSaveFailed {
                        Button(String(localized: "Try Apple Health again")) {
                            coordinator.retryHealthWorkout()
                        }
                        .buttonStyle(.bordered)
                        .tint(WatchTheme.gold)
                        .frame(maxWidth: .infinity, minHeight: 32)
                    }

                    if let exercise = coordinator.selectedExercise {
                        Text(exercise.name)
                            .font(.headline)


                        if let notes = exercise.notes, !notes.isEmpty {
                            Text(notes)
                                .font(.caption2)
                                .foregroundStyle(.secondary)

                        }

                        ForEach(exercise.sets) { set in
                            setRow(set, exercise: exercise)
                        }

                        if let lastCompletedSet, coordinator.snapshot?.status == .active {
                            Button(String(localized: "Undo last set"), role: .destructive) {
                                coordinator.reopenSet(lastCompletedSet.id)
                            }
                            .buttonStyle(.bordered)
                            .frame(maxWidth: .infinity, minHeight: 32)
                        }
                    } else {
                        Text(String(localized: "No workout details yet"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    if coordinator.snapshot?.rest != nil {
                        HStack(spacing: 5) {
                            Button("−15s") { coordinator.adjustRest(by: -15) }
                            Button("+15s") { coordinator.adjustRest(by: 15) }
                        }
                        .font(.caption2)
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.bottom, 6)
            }
            .scrollIndicators(.hidden)
        }
    }

    private func setRow(_ set: WatchSet, exercise: WatchExercise) -> some View {
        HStack(spacing: 6) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 4) {
                    Text(watchSetTypeLabel(set.type))
                    Text(setLabel(set, exercise: exercise))
                }
                .font(.caption2)
                .foregroundStyle(.secondary)

                Text(watchLocalizedFormat("Target %@", WatchDisplay.set(set, unit: coordinator.weightUnit, target: true)))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(WatchDisplay.set(set, unit: coordinator.weightUnit))
                    .font(.caption)


                if coordinator.watchSettings.showPreviousPerformance,
                   let previous = set.previousDisplay {
                    Text(
                        watchLocalizedFormat(
                            "Previous %@",
                            previous
                        )
                    )
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if set.isCompleted {
                Button { coordinator.reopenSet(set.id) } label: {
                    Image(systemName: "arrow.uturn.backward.circle")
                        .foregroundStyle(WatchTheme.success)
                        .frame(width: 30, height: 32)
                }
                .buttonStyle(.plain)
                .disabled(coordinator.snapshot?.status != .active)
                .accessibilityLabel(String(localized: "Reopen set"))
            } else if set.id == coordinator.currentSet?.id {
                Text(String(localized: "Current"))
                    .font(.caption2)
                    .foregroundStyle(WatchTheme.primary)
            }
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 5)
        .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: 8))
        .accessibilityElement(children: .combine)
    }

    private func setLabel(_ set: WatchSet, exercise: WatchExercise) -> String {
        let index = (exercise.sets.firstIndex(where: { $0.id == set.id }) ?? 0) + 1
        return watchLocalizedFormat("SET %lld OF %lld", index, exercise.sets.count)
    }
}
