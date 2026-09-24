import SwiftUI
import WidgetKit

enum HomeWidgetPalette {
  static let accent = Color("widgetAccent")
  static let background = Color("widgetBackground")
  static let hairline = Color.primary.opacity(0.08)
  static let track = Color("widgetAccent").opacity(0.18)
  static let restCell = Color.primary.opacity(0.08)
  static let futureCell = Color.primary.opacity(0.22)
  static let mutedBar = Color("widgetAccent").opacity(0.32)
}

/// Background, glow and margins for every home widget. iOS 17+ supplies the
/// content margins and removes the background in StandBy and tinted modes;
/// iOS 16 needs both applied by hand.
struct HomeWidgetSurface: ViewModifier {
  let family: WidgetFamily
  @Environment(\.widgetRenderingMode) private var renderingMode

  private var isAccessory: Bool {
    family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline
  }

  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      if isAccessory {
        content.containerBackground(for: .widget) { Color.clear }
      } else {
        content.containerBackground(for: .widget) { background }
      }
    } else if isAccessory {
      content
    } else {
      content
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(background)
    }
  }

  private var background: some View {
    ZStack {
      HomeWidgetPalette.background
      if renderingMode == .fullColor {
        RadialGradient(
          colors: [HomeWidgetPalette.accent.opacity(0.14), .clear],
          center: .topLeading,
          startRadius: 0,
          endRadius: 240
        )
      }
    }
  }
}

extension View {
  func homeWidgetSurface(_ family: WidgetFamily) -> some View {
    modifier(HomeWidgetSurface(family: family))
  }
}

/// Small uppercase label above a widget's main value.
struct HomeWidgetEyebrow: View {
  let text: String

  var body: some View {
    Text(text)
      .font(.system(size: 11, weight: .semibold))
      .kerning(0.4)
      .textCase(.uppercase)
      .foregroundStyle(HomeWidgetPalette.accent)
      .lineLimit(1)
      .widgetAccentable()
  }
}
