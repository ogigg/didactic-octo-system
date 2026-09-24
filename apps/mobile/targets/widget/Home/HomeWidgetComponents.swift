import SwiftUI
import WidgetKit

struct HomeWidgetHairline: View {
  var body: some View {
    Rectangle()
      .fill(HomeWidgetPalette.hairline)
      .frame(height: 1)
  }
}

struct HomeWidgetFlame: View {
  var size: CGFloat = 14

  var body: some View {
    Image(systemName: "flame.fill")
      .font(.system(size: size, weight: .semibold))
      .foregroundStyle(HomeWidgetPalette.accent)
      .widgetAccentable()
  }
}

struct HomeWidgetStreakLabel: View {
  let text: String

  var body: some View {
    HStack(spacing: 6) {
      HomeWidgetFlame(size: 13)
      Text(text)
        .font(.system(size: 13, weight: .semibold))
        .lineLimit(1)
    }
  }
}

struct HomeWidgetWeekRing: View {
  let fraction: Double
  var lineWidth: CGFloat = 12

  var body: some View {
    ZStack {
      Circle()
        .stroke(HomeWidgetPalette.track, lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: max(0, min(1, fraction)))
        .stroke(
          HomeWidgetPalette.accent,
          style: StrokeStyle(lineWidth: lineWidth, lineCap: fraction > 0 ? .round : .butt)
        )
        .rotationEffect(.degrees(-90))
        .widgetAccentable()
    }
    .padding(lineWidth / 2)
  }
}

struct HomeWidgetDayCell: View {
  let state: HomeWidgetDayState
  let size: CGFloat
  let cornerRadius: CGFloat

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
    switch state {
    case .trained, .todayTrained:
      shape.fill(HomeWidgetPalette.accent).frame(width: size, height: size).widgetAccentable()
    case .rest, .today:
      shape.fill(HomeWidgetPalette.restCell).frame(width: size, height: size)
    case .future:
      shape.strokeBorder(HomeWidgetPalette.futureCell, lineWidth: 1).frame(width: size, height: size)
    }
  }
}

/// GitHub-style grid: one column per week (oldest first), Monday on top.
struct HomeWidgetActivityGrid: View {
  let weeks: [HomeWidgetGridWeek]
  let cellSize: CGFloat
  let spacing: CGFloat
  let cornerRadius: CGFloat

  var body: some View {
    HStack(spacing: spacing) {
      ForEach(weeks) { week in
        VStack(spacing: spacing) {
          ForEach(Array(week.days.enumerated()), id: \.offset) { _, state in
            HomeWidgetDayCell(state: state, size: cellSize, cornerRadius: cornerRadius)
          }
        }
      }
    }
  }
}

/// Weekly minutes, oldest first; the current week is highlighted.
struct HomeWidgetDurationBars: View {
  let minutes: [Int]
  let maxHeight: CGFloat
  let spacing: CGFloat
  let cornerRadius: CGFloat

  var body: some View {
    let peak = max(1, minutes.max() ?? 1)
    HStack(alignment: .bottom, spacing: spacing) {
      ForEach(Array(minutes.enumerated()), id: \.offset) { index, value in
        let height = max(3, maxHeight * CGFloat(value) / CGFloat(peak))
        if index == minutes.count - 1 {
          RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(HomeWidgetPalette.accent)
            .frame(height: height)
            .widgetAccentable()
        } else {
          RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(HomeWidgetPalette.mutedBar)
            .frame(height: height)
        }
      }
    }
    .frame(height: maxHeight, alignment: .bottom)
  }
}

struct HomeWidgetMetric: View {
  let value: String
  let caption: String

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(value)
        .font(.system(size: 20, weight: .bold))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      Text(caption)
        .font(.system(size: 12))
        .foregroundStyle(.secondary)
        .lineLimit(2)
        // Wrap to a second line instead of truncating in narrow columns.
        .fixedSize(horizontal: false, vertical: true)
    }
    // Equal columns keep every value at the same size.
    .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
    .layoutPriority(1)
  }
}

/// Signed out, onboarding unfinished, or no data published yet.
struct HomeWidgetStatusView: View {
  let snapshot: HomeWidgetSnapshot?
  let family: WidgetFamily
  var systemImage = "dumbbell.fill"

  private var message: String {
    snapshot?.message ?? String(localized: "widget.status.openApp")
  }

  var body: some View {
    switch family {
    case .accessoryInline:
      Label(message, systemImage: systemImage)
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: systemImage).font(.system(size: 20, weight: .semibold))
      }
    case .accessoryRectangular:
      Text(message)
        .font(.system(size: 13, weight: .semibold))
        .lineLimit(3)
        .frame(maxWidth: .infinity, alignment: .leading)
    default:
      VStack(alignment: .leading, spacing: 8) {
        Image(systemName: systemImage)
          .font(.system(size: 20, weight: .semibold))
          .foregroundStyle(HomeWidgetPalette.accent)
          .widgetAccentable()
        Spacer(minLength: 0)
        Text(message)
          .font(.system(size: 15, weight: .semibold))
          .lineLimit(3)
          .minimumScaleFactor(0.8)
        Text("Sweaty")
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}
