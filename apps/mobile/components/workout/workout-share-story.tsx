import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import type { WorkoutShareHighlight } from "@/lib/workout-share-utils";

export const SHARE_STORY_VIEW_WIDTH = 360;
export const SHARE_STORY_VIEW_HEIGHT = 640;
export const SHARE_STORY_IMAGE_WIDTH = 1080;
export const SHARE_STORY_IMAGE_HEIGHT = 1920;

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
        colors={[
          Colors.dark.primarySurface,
          Colors.dark.background,
          Colors.dark.background,
        ]}
        locations={[0, 0.32, 1]}
        style={StyleSheet.absoluteFill}
      />

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

      <View style={styles.summaryPanel}>
        <View style={styles.volumeBlock}>
          <Text style={styles.panelLabel}>
            {t("summary.share.volumeLabel")}
          </Text>
          <Text
            style={styles.volumeValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {volumeLabel}
          </Text>
        </View>
        <View style={styles.completionBlock}>
          <Text style={styles.panelLabel}>
            {t("summary.share.completionLabel")}
          </Text>
          <Text style={styles.completionValue}>{completionLabel}</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <MetricTile
          label={t("summary.share.durationLabel")}
          value={durationLabel}
        />
        <MetricTile label={t("summary.share.setsLabel")} value={setsLabel} />
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
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.primary,
  },
  brandInitial: {
    color: Colors.dark.background,
    fontFamily: Fonts?.rounded,
    fontSize: 18,
    fontWeight: "800",
  },
  headerText: {
    flex: 1,
  },
  brand: {
    color: Colors.dark.text,
    fontFamily: Fonts?.rounded,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0,
  },
  date: {
    marginTop: 2,
    color: Colors.dark.textSecondary,
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0,
  },
  hero: {
    marginTop: 26,
  },
  eyebrow: {
    color: Colors.dark.primary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 6,
    color: Colors.dark.text,
    fontFamily: Fonts?.rounded,
    fontSize: 36,
    lineHeight: 39,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  summaryPanel: {
    marginTop: 18,
    minHeight: 82,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.dark.backgroundSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  volumeBlock: {
    flex: 1,
  },
  completionBlock: {
    alignItems: "flex-end",
  },
  panelLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  volumeValue: {
    marginTop: 3,
    color: Colors.dark.text,
    fontFamily: Fonts?.rounded,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  completionValue: {
    marginTop: 4,
    color: Colors.dark.primary,
    fontFamily: Fonts?.rounded,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
  },
  metricsGrid: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  metricTile: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.dark.backgroundSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
  metricLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  metricValue: {
    marginTop: 3,
    color: Colors.dark.text,
    fontFamily: Fonts?.rounded,
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "700",
    letterSpacing: 0,
  },
  highlights: {
    marginTop: 16,
    gap: 7,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
  },
  highlightRow: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: Colors.dark.backgroundSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
  highlightIndex: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.primaryContainer,
  },
  highlightIndexText: {
    color: Colors.dark.primary,
    fontFamily: Fonts?.rounded,
    fontSize: 12,
    fontWeight: "800",
  },
  highlightCopy: {
    flex: 1,
  },
  highlightName: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
  },
  highlightMeta: {
    marginTop: 1,
    color: Colors.dark.textSecondary,
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0,
  },
  highlightSets: {
    color: Colors.dark.primary,
    fontFamily: Fonts?.rounded,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyHighlights: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.dark.backgroundSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 16,
  },
});
