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
        colors={["#162738", Colors.dark.background, "#0E1012"]}
        locations={[0, 0.38, 1]}
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

      <LinearGradient
        colors={[
          Colors.dark.heroGradientStart,
          "#3B83CC",
          Colors.dark.heroGradientEnd,
        ]}
        locations={[0, 0.58, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.summaryPanel}
      >
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
      </LinearGradient>

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
            <View
              key={highlight.id}
              style={[
                styles.highlightRow,
                index === 0 && styles.featuredHighlightRow,
              ]}
            >
              <View style={styles.highlightIndex}>
                <Text style={styles.highlightIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.highlightCopy}>
                <Text style={styles.highlightName} numberOfLines={1}>
                  {highlight.name}
                </Text>
                <View style={styles.highlightDetailRow}>
                  <Text style={styles.highlightMeta} numberOfLines={1}>
                    {highlight.metric
                      ? `${t("summary.share.bestLabel")}: ${highlight.metric}`
                      : t("summary.share.setsCompleted", {
                          count: highlight.completedSets,
                        })}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.round(
                              (highlight.completedSets /
                                Math.max(1, highlight.totalSets)) *
                                100
                            )
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
              <View style={styles.highlightSetsPill}>
                <Text style={styles.highlightSets}>
                  {highlight.completedSets}/{highlight.totalSets}
                </Text>
              </View>
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

      <LinearGradient
        colors={[Colors.dark.primaryContainer, Colors.dark.primarySurface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.joinCard}
      >
        <View style={styles.joinBrandMark}>
          <Text style={styles.joinBrandInitial}>S</Text>
        </View>
        <View style={styles.joinCopy}>
          <Text style={styles.joinTitle}>{t("summary.share.footer")}</Text>
          <Text style={styles.joinSubtitle}>
            {t("summary.share.footerSubtitle")}
          </Text>
        </View>
        <View style={styles.joinArrow}>
          <Text style={styles.joinArrowText}>→</Text>
        </View>
      </LinearGradient>
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
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  volumeBlock: {
    flex: 1,
  },
  completionBlock: {
    alignItems: "flex-end",
    minWidth: 78,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: "rgba(12, 18, 25, 0.24)",
  },
  panelLabel: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  volumeValue: {
    marginTop: 3,
    color: "#FFFFFF",
    fontFamily: Fonts?.rounded,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  completionValue: {
    marginTop: 4,
    color: "#FFFFFF",
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
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(30, 37, 48, 0.86)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(90, 174, 224, 0.18)",
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
    marginTop: 14,
    gap: 7,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
  },
  highlightRow: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "rgba(26, 29, 32, 0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.dark.border,
  },
  featuredHighlightRow: {
    backgroundColor: "rgba(26, 32, 40, 0.96)",
    borderColor: "rgba(90, 174, 224, 0.34)",
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
    color: Colors.dark.textSecondary,
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0,
    flexShrink: 1,
  },
  highlightDetailRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  progressTrack: {
    width: 28,
    height: 3,
    overflow: "hidden",
    borderRadius: 2,
    backgroundColor: Colors.dark.border,
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.dark.primary,
  },
  highlightSetsPill: {
    minWidth: 38,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: Colors.dark.primaryContainer,
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
  joinCard: {
    minHeight: 54,
    marginTop: 13,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(90, 174, 224, 0.3)",
  },
  joinBrandMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.primary,
  },
  joinBrandInitial: {
    color: Colors.dark.background,
    fontFamily: Fonts?.rounded,
    fontSize: 17,
    fontWeight: "800",
  },
  joinCopy: {
    flex: 1,
  },
  joinTitle: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  joinSubtitle: {
    marginTop: 2,
    color: Colors.dark.textSecondary,
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  joinArrow: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(90, 174, 224, 0.14)",
  },
  joinArrowText: {
    color: Colors.dark.primary,
    fontSize: 17,
    lineHeight: 19,
    fontWeight: "700",
  },
});
