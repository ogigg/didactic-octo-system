import SwiftUI

struct ExerciseDetailView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Button {
                        coordinator.screen = .exerciseList
                    } label: {
                        Label("Session", systemImage: "chevron.left")
                            .labelStyle(.iconOnly)
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    HeartRateButton()
                }

                if let exercise = coordinator.selectedExercise,
                    let set = coordinator.currentSet
                {
                    Text(exercise.name)
                        .font(.headline)
                        .lineLimit(3)
                        .minimumScaleFactor(0.8)

                    Text(setLabel(exercise: exercise, set: set))
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    HStack {
                        prescription(
                            String(localized: "TARGET"),
                            setDisplay(set)
                        )
                        prescription(
                            String(localized: "LAST TIME"),
                            set.previousDisplay ?? "—"
                        )
                    }

                    SetLoggerView()

                    Button {
                        coordinator.completeCurrentSet()
                    } label: {
                        Label("Log set", systemImage: "checkmark")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(WatchTheme.primary)
                    .accessibilityHint(
                        String(localized: "Logs this set and starts the rest timer")
                    )

                    ForEach(Array(exercise.sets.enumerated()), id: \.element.id) {
                        index, loggedSet in
                        HStack {
                            Text("\(index + 1)")
                                .foregroundStyle(.secondary)
                            Text(setDisplay(loggedSet))
                            Spacer()
                            if loggedSet.isCompleted {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(WatchTheme.success)
                            } else if loggedSet.id == set.id {
                                Text("NOW")
                                    .font(.caption2)
                                    .foregroundStyle(WatchTheme.primary)
                            }
                        }
                        .font(.caption)
                        .accessibilityElement(children: .combine)
                    }

                    if let notes = exercise.notes, !notes.isEmpty {
                        Text(notes)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.horizontal, 6)
        }
    }

    private func setLabel(exercise: WatchExercise, set: WatchSet) -> String {
        let index = (exercise.sets.firstIndex(where: { $0.id == set.id }) ?? 0) + 1
        return watchLocalizedFormat(
            "SET %lld OF %lld",
            index,
            exercise.sets.count
        )
    }

    private func setDisplay(_ set: WatchSet) -> String {
        if let seconds = set.durationSeconds {
            return watchLocalizedFormat("%lld seconds", seconds)
        }
        let reps = Int(set.actualReps ?? set.targetReps ?? 0)
        guard let load = set.actualLoadKg ?? set.targetLoadKg else {
            return watchLocalizedFormat("%lld reps", reps)
        }
        return watchLocalizedFormat(
            "%lld × %@ kg",
            reps,
            load.formatted()
        )
    }

    private func prescription(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption)
                .fontWeight(.semibold)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(7)
        .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: 9))
        .accessibilityElement(children: .combine)
    }
}

struct ExerciseCompleteView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        ScrollView {
            VStack(spacing: 9) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(WatchTheme.success)
                Text(
                    coordinator.selectedExercise?.name
                        ?? String(localized: "Exercise complete")
                )
                    .font(.headline)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)

                if let exercise = coordinator.selectedExercise {
                    let completed = exercise.sets.filter(\.isCompleted)
                    HStack {
                        stat(
                            "\(completed.count)",
                            label: String(localized: "Sets")
                        )
                        stat(
                            volume(completed),
                            label: String(localized: "Volume")
                        )
                    }
                }

                Button("Start next exercise") {
                    coordinator.showNextExercise()
                }
                .buttonStyle(.borderedProminent)
                .tint(WatchTheme.success)

                Button("Exercise list") {
                    coordinator.screen = .exerciseList
                }
            }
            .padding(.horizontal, 8)
        }
    }

    private func volume(_ sets: [WatchSet]) -> String {
        let kilograms = sets.reduce(0) {
            $0 + ($1.actualLoadKg ?? 0) * ($1.actualReps ?? 0)
        }
        return watchLocalizedFormat("%lld kg", Int(kilograms))
    }

    private func stat(_ value: String, label: String) -> some View {
        VStack {
            Text(value).font(.headline)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: 9))
    }
}
