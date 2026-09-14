import SwiftUI

enum WatchLayout {
    static let horizontalPadding: CGFloat = 8
    static let headerHeight: CGFloat = 28
    static let headerButtonSize: CGFloat = 28
    static let primaryButtonHeight: CGFloat = 34
}

enum WatchHeaderAction {
    case heartRate
    case details
    case none
}

struct WatchScreen<Content: View>: View {
    let title: String
    let contentScrolls: Bool
    let onBack: (() -> Void)?
    let headerAction: WatchHeaderAction
    let primaryTitle: String?
    let primaryTint: Color
    let primaryRole: ButtonRole?
    let primaryDisabled: Bool
    let onPrimary: (() -> Void)?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let content: Content

    init(
        title: String,
        contentScrolls: Bool = false,
        onBack: (() -> Void)? = nil,
        headerAction: WatchHeaderAction = .details,
        primaryTitle: String? = nil,
        primaryTint: Color = WatchTheme.primary,
        primaryRole: ButtonRole? = nil,
        primaryDisabled: Bool = false,
        onPrimary: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.contentScrolls = contentScrolls
        self.onBack = onBack
        self.headerAction = headerAction
        self.primaryTitle = primaryTitle
        self.primaryTint = primaryTint
        self.primaryRole = primaryRole
        self.primaryDisabled = primaryDisabled
        self.onPrimary = onPrimary
        self.content = content()
    }

    var body: some View {
        GeometryReader { proxy in
            let footerHeight: CGFloat = primaryTitle == nil ? 0 : 36
            let bodyHeight = max(0, proxy.size.height - WatchLayout.headerHeight - footerHeight)
            VStack(spacing: 0) {
                WatchHeader(title: title, onBack: onBack, action: headerAction)
                Group {
                    if dynamicTypeSize > .large && !contentScrolls {
                        ScrollView { content.padding(.vertical, 2) }
                    } else {
                        content
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: bodyHeight, alignment: .top)
                .clipped()

                if let primaryTitle, let onPrimary {
                    Button(role: primaryRole, action: onPrimary) {
                        Text(primaryTitle)
                            .font(.body.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.65)
                            .padding(.horizontal, 8)
                            .frame(maxWidth: .infinity)
                            .frame(height: WatchLayout.primaryButtonHeight)
                            .background(primaryTint, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.black)
                    .disabled(primaryDisabled)
                    .frame(height: footerHeight, alignment: .bottom)
                }
            }
            .padding(.horizontal, WatchLayout.horizontalPadding)
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .top)
        }
    }
}

private struct WatchHeader: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    let title: String
    let onBack: (() -> Void)?
    let action: WatchHeaderAction

    var body: some View {
        HStack(spacing: 4) {
            if let onBack {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(
                            width: WatchLayout.headerButtonSize,
                            height: WatchLayout.headerButtonSize
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(String(localized: "Back"))
            } else {
                Color.clear
                    .frame(
                        width: WatchLayout.headerButtonSize,
                        height: WatchLayout.headerButtonSize
                    )
                    .accessibilityHidden(true)
            }

            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .frame(maxWidth: .infinity, alignment: .leading)

            switch action {
            case .heartRate:
                Button {
                    coordinator.navigate(.heartRate)
                } label: {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.red)
                        .frame(
                            width: WatchLayout.headerButtonSize,
                            height: WatchLayout.headerButtonSize
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(
                    coordinator.health.heartRate.map {
                        watchLocalizedFormat("Heart rate %lld beats per minute", $0)
                    } ?? String(localized: "Heart rate unavailable")
                )
            case .details:
                Button {
                    coordinator.navigate(.details)
                } label: {
                    Image(systemName: syncSymbol)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(syncColor)
                        .frame(
                            width: WatchLayout.headerButtonSize,
                            height: WatchLayout.headerButtonSize
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(String(localized: "Sync status"))
            case .none:
                Color.clear
                    .frame(
                        width: WatchLayout.headerButtonSize,
                        height: WatchLayout.headerButtonSize
                    )
                    .accessibilityHidden(true)
            }
        }
        .frame(height: WatchLayout.headerHeight)
    }

    private var syncSymbol: String {
        if coordinator.pendingChanges {
            return coordinator.connectivity.isReachable
                ? "arrow.triangle.2.circlepath"
                : "icloud.and.arrow.up"
        }
        return coordinator.connectivity.isReachable
            ? "checkmark.circle"
            : "iphone.slash"
    }

    private var syncColor: Color {
        if coordinator.pendingChanges { return WatchTheme.gold }
        return coordinator.connectivity.isReachable ? WatchTheme.success : .secondary
    }
}

struct SyncStatusSummary: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: symbol)
                .foregroundStyle(color)
                .accessibilityHidden(true)
            Text(message)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 7)
        .padding(.vertical, 6)
        .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: 9))
        .accessibilityElement(children: .combine)
    }

    private var symbol: String {
        if coordinator.pendingChanges {
            return coordinator.connectivity.isReachable
                ? "arrow.triangle.2.circlepath"
                : "icloud.and.arrow.up"
        }
        return coordinator.connectivity.isReachable
            ? "checkmark.circle"
            : "iphone.slash"
    }

    private var color: Color {
        if coordinator.pendingChanges { return WatchTheme.gold }
        return coordinator.connectivity.isReachable ? WatchTheme.success : .secondary
    }

    private var message: String {
        if coordinator.healthSaveFailed {
            return String(localized: "Apple Health still needs attention")
        }
        if coordinator.pendingChanges {
            return coordinator.connectivity.isReachable
                ? String(localized: "Saving changes")
                : String(localized: "Changes will sync when your iPhone reconnects")
        }
        return coordinator.connectivity.isReachable
            ? String(localized: "Up to date")
            : String(localized: "Waiting for your iPhone")
    }
}

enum WatchDisplay {
    static func load(_ kilograms: Double, unit: String) -> String {
        let value = unit == "lbs" ? kilograms * 2.2046226218 : kilograms
        return value.formatted(.number.precision(.fractionLength(0...1)))
    }

    static func loadWithUnit(_ kilograms: Double, unit: String) -> String {
        watchLocalizedFormat("%@ %@", load(kilograms, unit: unit), unit.uppercased())
    }

    static func set(_ set: WatchSet, unit: String, target: Bool = false) -> String {
        if let seconds = target
            ? (set.targetDurationSeconds ?? set.durationSeconds)
            : set.durationSeconds {
            return watchLocalizedFormat("%lld seconds", seconds)
        }

        let reps = Int(target ? (set.targetReps ?? 0) : (set.actualReps ?? set.targetReps ?? 0))
        let kilograms = target ? set.targetLoadKg : (set.actualLoadKg ?? set.targetLoadKg)
        guard let kilograms else {
            return watchLocalizedFormat("%lld reps", reps)
        }
        return watchLocalizedFormat(
            "%lld × %@ %@",
            reps,
            load(kilograms, unit: unit),
            unit.uppercased()
        )
    }
}

func watchSetTypeLabel(_ type: WatchSet.SetType) -> String {
    switch type {
    case .warmup:
        return String(localized: "Warm-up")
    case .working:
        return String(localized: "Working")
    }
}
