import SwiftUI

struct HeartRateView: View {
    @Environment(HealthKitClient.self) private var healthKit

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "heart.fill")
                .font(.title)
                .foregroundStyle(.red)
                .symbolEffect(.pulse, isActive: healthKit.heartRate != nil)

            if let hr = healthKit.heartRate {
                Text("\(hr)")
                    .font(.system(size: 56, weight: .light, design: .rounded))
                    .monospacedDigit()
                Text("BPM")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("--")
                    .font(.system(size: 56, weight: .light, design: .rounded))
                Text("Measuring...")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
