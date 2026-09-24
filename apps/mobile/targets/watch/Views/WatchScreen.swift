import SwiftUI

enum WatchLayout {
    static let horizontalPadding: CGFloat = 8
    static let bottomInset: CGFloat = 6
    static let titleHeight: CGFloat = 18
    static let primaryButtonHeight: CGFloat = 34
    static let footerHeight: CGFloat = 37
    static let cardRadius: CGFloat = 14
    static let dataRadius: CGFloat = 9
}

enum WatchHeaderAction {
    case details
    case none
}

struct WatchScreen<Content: View>: View {
    let title: String
    let titleTint: Color
    let contentScrolls: Bool
    let onBack: (() -> Void)?
    let headerAction: WatchHeaderAction
    let accent: Color
    let primaryTitle: String?
    let primarySymbol: String?
    let primaryTint: Color
    let primaryForeground: Color
    let primaryRole: ButtonRole?
    let primaryDisabled: Bool
    let onPrimary: (() -> Void)?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let content: Content

    init(
        title: String,
        titleTint: Color = .primary,
        contentScrolls: Bool = false,
        onBack: (() -> Void)? = nil,
        headerAction: WatchHeaderAction = .details,
        accent: Color = WatchTheme.primary,
        primaryTitle: String? = nil,
        primarySymbol: String? = nil,
        primaryTint: Color = WatchTheme.primary,
        primaryForeground: Color = .black,
        primaryRole: ButtonRole? = nil,
        primaryDisabled: Bool = false,
        onPrimary: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.titleTint = titleTint
        self.contentScrolls = contentScrolls
        self.onBack = onBack
        self.headerAction = headerAction
        self.accent = accent
        self.primaryTitle = primaryTitle
        self.primarySymbol = primarySymbol
        self.primaryTint = primaryTint
        self.primaryForeground = primaryForeground
        self.primaryRole = primaryRole
        self.primaryDisabled = primaryDisabled
        self.onPrimary = onPrimary
        self.content = content()
    }

    var body: some View {
        GeometryReader { proxy in
            let footerHeight = primaryTitle == nil ? 0 : WatchLayout.footerHeight
            let bodyHeight = max(0, proxy.size.height - WatchLayout.titleHeight - footerHeight)
            VStack(spacing: 0) {
                Text(title)
                    .font(.system(.footnote, design: .rounded).weight(.semibold))
                    .foregroundStyle(titleTint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 2)
                    .frame(height: WatchLayout.titleHeight, alignment: .top)
                    .accessibilityAddTraits(.isHeader)
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
                        HStack(spacing: 5) {
                            if let primarySymbol {
                                Image(systemName: primarySymbol)
                                    .font(.system(size: 14, weight: .bold))
                                    .accessibilityHidden(true)
                            }
                            Text(primaryTitle)
                                .font(.system(.body, design: .rounded).weight(.semibold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.65)
                        }
                        .padding(.horizontal, 10)
                        .frame(maxWidth: .infinity)
                        .frame(height: WatchLayout.primaryButtonHeight)
                        .background(primaryTint, in: Capsule())
                    }
                    .buttonStyle(WatchPressStyle())
                    .foregroundStyle(primaryForeground)
                    .disabled(primaryDisabled)
                    .opacity(primaryDisabled ? 0.5 : 1)
                    .frame(height: footerHeight, alignment: .bottom)
                }
            }
            .padding(.horizontal, WatchLayout.horizontalPadding)
            .padding(.bottom, WatchLayout.bottomInset)
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .top)
        }
        // The primary action sits near the bottom edge instead of above the full safe-area inset.
        .ignoresSafeArea(.container, edges: .bottom)
        .background(alignment: .top) {
            AmbientGlow(color: accent)
        }
        // The system bar beside the clock carries the title and corner controls.
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let onBack {
                ToolbarItem(placement: .topBarLeading) {
                    Button(action: onBack) {
                        Image(systemName: "chevron.left")
                    }
                    .accessibilityLabel(String(localized: "Back"))
                }
            }
            if headerAction == .details {
                ToolbarItem(placement: .topBarTrailing) {
                    WatchStatusButton()
                }
            }
        }
    }
}

/// Soft radial light behind the header that tints each screen by its purpose.
struct AmbientGlow: View {
    let color: Color

    var body: some View {
        GeometryReader { proxy in
            RadialGradient(
                colors: [color.opacity(0.28), color.opacity(0.08), .clear],
                center: .top,
                startRadius: 0,
                endRadius: proxy.size.width * 0.85
            )
            .frame(height: proxy.size.height * 0.75)
            .offset(y: -proxy.size.height * 0.12)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

struct WatchPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

private struct WatchStatusButton: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        Button {
            coordinator.navigate(.details)
        } label: {
            Image(systemName: syncSymbol)
                .foregroundStyle(syncColor)
        }
        .accessibilityLabel(String(localized: "Sync status"))
    }

    // Quiet "more" affordance when healthy; only problems earn a colored glyph.
    private var syncSymbol: String {
        if coordinator.healthSaveFailed { return "exclamationmark" }
        if coordinator.pendingChanges {
            return coordinator.connectivity.isReachable
                ? "arrow.triangle.2.circlepath"
                : "icloud.and.arrow.up"
        }
        return coordinator.connectivity.isReachable
            ? "ellipsis"
            : "iphone.slash"
    }

    private var syncColor: Color {
        if coordinator.healthSaveFailed || coordinator.pendingChanges { return WatchTheme.gold }
        return .secondary
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
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 7)
        .padding(.vertical, 6)
        .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: WatchLayout.cardRadius))
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
