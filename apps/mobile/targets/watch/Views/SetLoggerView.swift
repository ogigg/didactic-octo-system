import SwiftUI

struct SetLoggerView: View {
    @Binding var loadKg: Double
    @Binding var reps: Int

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text("Weight")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(loadKg, specifier: "%.1f") kg")
                    .font(.body)
                    .monospacedDigit()
            }

            Stepper(value: $loadKg, in: 0...500, step: 2.5) {
                EmptyView()
            }

            HStack {
                Text("Reps")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(reps)")
                    .font(.body)
                    .monospacedDigit()
            }

            Stepper(value: $reps, in: 0...100) {
                EmptyView()
            }
        }
    }
}
