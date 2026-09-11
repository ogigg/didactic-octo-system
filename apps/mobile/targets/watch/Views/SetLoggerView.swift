import SwiftUI

struct SetLoggerView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @ScaledMetric(relativeTo: .title2) private var valueSize = 22.0
    @ScaledMetric(relativeTo: .caption2) private var labelSize = 9.0
    @ScaledMetric(relativeTo: .body) private var editorHeight = 38.0
    @State private var metric: Metric = .reps
    @FocusState private var focusedMetric: Metric?

    private enum Metric: Hashable {
        case reps
        case load
    }

    private var isTimed: Bool {
        coordinator.selectedExercise?.exerciseType == .time
    }

    var body: some View {
        if isTimed {
            timedEditor
        } else {
            weightEditor
        }
    }

    private var weightEditor: some View {
        HStack(spacing: 4) {
            metricEditor(
                .reps,
                label: String(localized: "REPS"),
                value: String(coordinator.reps)
            )
            metricEditor(
                .load,
                label: coordinator.weightUnit.uppercased(),
                value: WatchDisplay.load(coordinator.loadKg, unit: coordinator.weightUnit)
            )
        }
        .frame(maxWidth: .infinity)
        .frame(height: editorHeight)
        .accessibilityElement(children: .contain)
    }

    private var timedEditor: some View {
        metricEditor(
            .reps,
            label: String(localized: "SECONDS"),
            value: timerValue,
            isDuration: true
        )
        .frame(maxWidth: .infinity)
        .frame(height: editorHeight)
        .accessibilityElement(children: .contain)
    }

    private var timerValue: String {
        coordinator.timedSetEnd == nil
            ? String(coordinator.durationSeconds)
            : String(coordinator.timedSetRemaining)
    }

    private var repsBinding: Binding<Double> {
        Binding(
            get: { Double(coordinator.reps) },
            set: { coordinator.updateEditor(loadKg: coordinator.loadKg, reps: Int($0.rounded())) }
        )
    }

    private var loadBinding: Binding<Double> {
        Binding(
            get: { coordinator.displayedLoad },
            set: { coordinator.updateDisplayedLoad($0) }
        )
    }

    private var durationBinding: Binding<Double> {
        Binding(
            get: { Double(coordinator.durationSeconds) },
            set: { if coordinator.timedSetEnd == nil { coordinator.updateDuration(Int($0.rounded())) } }
        )
    }

    private func metricEditor(
        _ candidate: Metric,
        label: String,
        value: String,
        isDuration: Bool = false
    ) -> some View {
        Button {
            metric = candidate
            focusedMetric = candidate
        } label: {
            HStack(spacing: 4) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(label)
                        .font(.system(size: labelSize, weight: .semibold))
                    Text(value)
                        .font(.system(size: valueSize, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

            }
            .foregroundStyle(metric == candidate ? WatchTheme.primary : .secondary)
            .padding(.horizontal, 7)
            .frame(maxWidth: .infinity, minHeight: editorHeight)
            .background(
                metric == candidate ? WatchTheme.primary.opacity(0.2) : WatchTheme.surface,
                in: RoundedRectangle(cornerRadius: 8)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .focusable()
        .focused($focusedMetric, equals: candidate)
        .onAppear { if candidate == .reps { focusedMetric = .reps } }
        .onChange(of: focusedMetric) { _, value in if let value { metric = value } }
        .digitalCrownRotation(
            crownBinding(for: candidate, isDuration: isDuration),
            from: isDuration ? 1 : 0,
            through: isDuration ? 3600 : (candidate == .reps ? 1000 : (coordinator.weightUnit == "lbs" ? 3306.9 : 1500)),
            by: isDuration ? 5 : (candidate == .load && coordinator.weightUnit != "lbs" ? 0.5 : 1),
            sensitivity: .medium,
            isContinuous: false,
            isHapticFeedbackEnabled: true
        )
        .accessibilityLabel(watchLocalizedFormat("%@, %@", label, value))
        .accessibilityAddTraits(metric == candidate ? .isSelected : [])
        .accessibilityAdjustableAction { direction in
            adjust(candidate, direction: direction, isDuration: isDuration)
        }
    }

    private func crownBinding(for candidate: Metric, isDuration: Bool) -> Binding<Double> {
        if isDuration { return durationBinding }
        return candidate == .reps ? repsBinding : loadBinding
    }

    private func adjust(
        _ candidate: Metric,
        direction: AccessibilityAdjustmentDirection,
        isDuration: Bool
    ) {
        let amount = direction == .increment ? 1 : -1
        if isDuration {
            coordinator.updateDuration(coordinator.durationSeconds + amount * 5)
        } else if candidate == .reps {
            coordinator.updateEditor(
                loadKg: coordinator.loadKg,
                reps: max(0, coordinator.reps + amount)
            )
        } else {
            let increment = coordinator.weightUnit == "lbs" ? 1.0 : 0.5
            coordinator.updateDisplayedLoad(
                max(0, coordinator.displayedLoad + Double(amount) * increment)
            )
        }
    }
}
