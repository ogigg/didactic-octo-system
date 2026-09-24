import Foundation
import WatchKit

struct HapticsClient {
    /// A restrained warning distinct from the completion success haptic.
    /// Digital Crown feedback is owned by SwiftUI and never passes through
    /// this preference-gated client.
    static func restTimerWarning(enabled: Bool = true) {
        guard enabled else { return }
        WKInterfaceDevice.current().play(.directionUp)
    }

    static func restTimerComplete(enabled: Bool = true) {
        guard enabled else { return }
        WKInterfaceDevice.current().play(.success)
    }

    static func setCompleted(enabled: Bool = true) {
        guard enabled else { return }
        WKInterfaceDevice.current().play(.click)
    }
}
