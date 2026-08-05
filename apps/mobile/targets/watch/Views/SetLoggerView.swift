import SwiftUI

struct SetLoggerView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @State private var metric: Metric = .reps

    private enum Metric {
        case reps
        case load
    }

    var body: some View {
        VStack(spacing: 7) {
            HStack {
                Button {
                    nudge(-1)
                } label: {
                    Image(systemName: "minus")
                }
                .accessibilityLabel(
                    metric == .reps
                        ? String(localized: "Decrease reps")
                        : String(localized: "Decrease load")
                )

                Spacer()
                VStack(spacing: 0) {
                    Text(
                        metric == .reps
                            ? "\(coordinator.reps)"
                            : coordinator.loadKg.formatted()
                    )
                    .font(.system(size: 34, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    Text(
                        metric == .reps
                            ? String(localized: "REPS")
                            : String(localized: "KG")
                    )
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
                }
                .focusable()
                .digitalCrownRotation(
                    metric == .reps ? repsBinding : loadBinding,
                    from: 0,
                    through: metric == .reps ? 100 : 500,
                    by: metric == .reps ? 1 : 0.5,
                    sensitivity: .medium,
                    isContinuous: false,
                    isHapticFeedbackEnabled: true
                )
                Spacer()

                Button {
                    nudge(1)
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel(
                    metric == .reps
                        ? String(localized: "Increase reps")
                        : String(localized: "Increase load")
                )
            }

            HStack(spacing: 5) {
                metricButton(
                    .reps,
                    label: String(localized: "REPS"),
                    value: "\(coordinator.reps)"
                )
                metricButton(
                    .load,
                    label: String(localized: "LOAD KG"),
                    value: coordinator.loadKg.formatted()
                )
            }
        }
    }

    private var repsBinding: Binding<Double> {
        Binding(
            get: { Double(coordinator.reps) },
            set: { coordinator.updateEditor(loadKg: coordinator.loadKg, reps: Int($0)) }
        )
    }

    private var loadBinding: Binding<Double> {
        Binding(
            get: { coordinator.loadKg },
            set: { coordinator.updateEditor(loadKg: $0, reps: coordinator.reps) }
        )
    }

    private func nudge(_ direction: Int) {
        if metric == .reps {
            coordinator.updateEditor(
                loadKg: coordinator.loadKg,
                reps: max(0, coordinator.reps + direction)
            )
        } else {
            coordinator.updateEditor(
                loadKg: max(0, coordinator.loadKg + Double(direction) * 0.5),
                reps: coordinator.reps
            )
        }
    }

    private func metricButton(
        _ candidate: Metric,
        label: String,
        value: String
    ) -> some View {
        Button {
            metric = candidate
        } label: {
            VStack(spacing: 1) {
                Text(label).font(.system(size: 8, weight: .semibold))
                Text(value).font(.caption).monospacedDigit()
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .tint(metric == candidate ? WatchTheme.primary : .secondary)
        .accessibilityLabel(
            watchLocalizedFormat("%@, %@", label, value)
        )
        .accessibilityAddTraits(metric == candidate ? .isSelected : [])
    }
}
