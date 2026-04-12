import Foundation
import WatchKit

struct HapticsClient {
    static func restTimerComplete() {
        WKInterfaceDevice.current().play(.success)
    }

    static func setCompleted() {
        WKInterfaceDevice.current().play(.click)
    }
}
