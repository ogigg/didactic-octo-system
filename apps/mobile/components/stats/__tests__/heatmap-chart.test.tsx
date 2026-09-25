let mockLanguage = "en";
const mockLegend: Record<string, Record<string, string>> = {
  en: { "heatmap.less": "Less", "heatmap.more": "More" },
  pl: { "heatmap.less": "Mniej", "heatmap.more": "Więcej" },
  de: { "heatmap.less": "Deutlich weniger", "heatmap.more": "Mehr" },
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => mockLegend[mockLanguage]?.[key] ?? key,
  }),
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useAppCatalogLanguage: () => mockLanguage,
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

import { render } from "@testing-library/react-native";
import { Rect, Text as SvgText } from "react-native-svg";

import { HeatmapChart } from "../heatmap-chart";

function renderedLabels(): string[] {
  const { UNSAFE_getAllByType } = render(<HeatmapChart data={[]} weeks={9} />);
  return UNSAFE_getAllByType(SvgText).map((node) =>
    String(node.props.children)
  );
}

describe("HeatmapChart labels", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 2, 18, 12) });
  });

  afterEach(() => {
    jest.useRealTimers();
    mockLanguage = "en";
  });

  it("keeps the English month, weekday and legend labels", () => {
    const labels = renderedLabels();

    expect(labels).toEqual(
      expect.arrayContaining([
        "Jan",
        "Feb",
        "Mar",
        "M",
        "W",
        "F",
        "Less",
        "More",
      ])
    );
  });

  it("uses Polish month, weekday and legend labels for the Polish app language", () => {
    mockLanguage = "pl";

    const labels = renderedLabels();

    expect(labels).toEqual(
      expect.arrayContaining([
        "sty",
        "lut",
        "mar",
        "pon",
        "śr",
        "pt",
        "Mniej",
        "Więcej",
      ])
    );
    expect(labels).not.toEqual(expect.arrayContaining(["Jan"]));
    expect(labels).not.toEqual(expect.arrayContaining(["Less"]));
  });

  it("keeps a long 'less' label inside the chart, left of the legend cells", () => {
    mockLanguage = "de";

    const { UNSAFE_getAllByType } = render(
      <HeatmapChart data={[]} weeks={9} />
    );
    const less = UNSAFE_getAllByType(SvgText).find(
      (node) => node.props.children === "Deutlich weniger"
    );
    const legendCells = UNSAFE_getAllByType(Rect).slice(-5);
    const estimatedWidth = Math.ceil("Deutlich weniger".length * 9 * 0.6);

    expect(less?.props.x).toBeGreaterThanOrEqual(estimatedWidth);
    expect(legendCells[0]?.props.x).toBeGreaterThan(less?.props.x);
  });
});
