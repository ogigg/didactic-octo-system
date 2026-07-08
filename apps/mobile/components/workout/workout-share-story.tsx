import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import type { WorkoutShareHighlight } from "@/lib/workout-share-utils";

export const SHARE_STORY_VIEW_WIDTH = 360;
export const SHARE_STORY_VIEW_HEIGHT = 640;
export const SHARE_STORY_IMAGE_WIDTH = 1080;
export const SHARE_STORY_IMAGE_HEIGHT = 1920;

const GRID_LINE_KEYS = [
  "grid-line-0",
  "grid-line-1",
  "grid-line-2",
  "grid-line-3",
  "grid-line-4",
  "grid-line-5",
  "grid-line-6",
  "grid-line-7",
  "grid-line-8",
  "grid-line-9",
  "grid-line-10",
];

interface WorkoutShareStoryProps {
  workoutName: string;
  dateLabel: string;
  durationLabel: string;
  volumeLabel: string;
  setsLabel: string;
  completionLabel: string;
  streakLabel: string | null;
  highlights: WorkoutShareHighlight[];
}

export function WorkoutShareStory({
  workoutName,
  dateLabel,
  durationLabel,
  volumeLabel,
  setsLabel,
  completionLabel,
  streakLabel,
  highlights,
}: WorkoutShareStoryProps) {
  const { t } = useTranslation("workout");

  return (
    <View style={styles.story} collapsable={false} testID="workout-share-story">
      <LinearGradient
        colors={["#111418", "#182027", "#0E1115"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blueBeam} />
      <View style={styles.greenBeam} />
      <View style={styles.grid}>
        {GRID_LINE_KEYS.map((key) => (
          <View key={key} style={styles.gridLine} />
        ))}
      </View>

      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Text style={styles.brandInitial}>S</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.brand}>{t("summary.share.brand")}</Text>
          <Text style={styles.date}>
            {t("summary.share.dateLabel")} - {dateLabel}
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t("summary.share.eyebrow")}</Text>
        <Text
          style={styles.title}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          {workoutName}
        </Text>
      </View>

      <View style={styles.volumePanel}>
        <Text style={styles.panelLabel}>{t("summary.share.volumeLabel")}</Text>
        <Text
          style={styles.volumeValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {volumeLabel}
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        <MetricTile
          label={t("summary.share.durationLabel")}
          value={durationLabel}
        />
        <MetricTile label={t("summary.share.setsLabel")} value={setsLabel} />
        <MetricTile
          label={t("summary.share.completionLabel")}
          value={completionLabel}
        />
        <MetricTile
          label={t("summary.share.streakLabel")}
          value={streakLabel ?? "-"}
        />
      </View>

      <View style={styles.highlights}>
        <Text style={styles.sectionTitle}>
          {t("summary.share.exercisesTitle")}
        </Text>
        {highlights.length > 0 ? (
          highlights.map((highlight, index) => (
            <View key={highlight.id} style={styles.highlightRow}>
              <View style={styles.highlightIndex}>
                <Text style={styles.highlightIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.highlightCopy}>
                <Text style={styles.highlightName} numberOfLines={1}>
                  {highlight.name}
                </Text>
                <Text style={styles.highlightMeta} numberOfLines={1}>
                  {highlight.metric
                    ? `${t("summary.share.bestLabel")}: ${highlight.metric}`
                    : t("summary.share.setsCompleted", {
                        count: highlight.completedSets,
                      })}
                </Text>
              </View>
              <Text style={styles.highlightSets}>
                {highlight.completedSets}/{highlight.totalSets}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyHighlights}>
            <Text style={styles.emptyText}>
              {t("summary.share.noHighlights")}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.footer}>{t("summary.share.footer")}</Text>
    </View>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={styles.metricValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.78}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  story: {
    width: SHARE_STORY_VIEW_WIDTH,
    height: SHARE_STORY_VIEW_HEIGHT,
    overflow: "hidden",
    backgroundColor: "#111418",
    padding: 24,
  },
  blueBeam: {
    position: "absolute",
    width: 520,
    height: 104,
    top: 52,
    left: -96,
    backgroundColor: "#2A9FDF",
    opacity: 0.92,
    transform: [{ rotate: "-12deg" }],
  },
  greenBeam: {
    position: "absolute",
    width: 440,
    height: 88,
    right: -120,
    bottom: 44,
    backgroundColor: "#4FE0A5",
    opacity: 0.9,
    transform: [{ rotate: "-12deg" }],
  },
  grid: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 188,
    flexDirection: "row",
    justifyContent: "space-between",
    opacity: 0.1,
  },
  gridLine: {
    width: 1,
    height: 392,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  brandInitial: {
    color: "#111418",
    fontSize: 19,
    fontWeight: "800",
  },
  headerText: {
    flex: 1,
  },
  brand: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  date: {
    marginTop: 2,
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0,
  },
  hero: {
    marginTop: 56,
  },
  eyebrow: {
    color: "#BFF7DC",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 7,
    color: "#FFFFFF",
    fontSize: 42,
    lineHeight: 45,
    fontWeight: "900",
    letterSpacing: 0,
  },
  volumePanel: {
    marginTop: 28,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: "#F8FAFC",
  },
  panelLabel: {
    color: "#52606D",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  volumeValue: {
    marginTop: 2,
    color: "#111418",
    fontSize: 54,
    lineHeight: 60,
    fontWeight: "900",
    letterSpacing: 0,
  },
  metricsGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricTile: {
    width: 148,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  metricLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  metricValue: {
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: 0,
  },
  highlights: {
    marginTop: 22,
    gap: 9,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0,
  },
  highlightRow: {
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(8,10,12,0.56)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  highlightIndex: {
    width: 27,
    height: 27,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4FE0A5",
  },
  highlightIndexText: {
    color: "#0E1115",
    fontSize: 13,
    fontWeight: "900",
  },
  highlightCopy: {
    flex: 1,
  },
  highlightName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
  },
  highlightMeta: {
    marginTop: 2,
    color: "rgba(255,255,255,0.64)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0,
  },
  highlightSets: {
    color: "#BFF7DC",
    fontSize: 13,
    fontWeight: "900",
  },
  emptyHighlights: {
    borderRadius: 8,
    padding: 14,
    backgroundColor: "rgba(8,10,12,0.56)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  emptyText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  footer: {
    position: "absolute",
    left: 24,
    bottom: 18,
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0,
  },
});
