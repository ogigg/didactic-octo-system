import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, Spacing, Radii, Typography, Opacity } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useColorScheme } from "@/hooks/use-color-scheme";

function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText type="titleLg" style={styles.sectionTitle}>
      {children}
    </ThemedText>
  );
}

function ColorSwatch({ name, value }: { name: string; value: string }) {
  const captionColor = useThemeColor({}, "textSecondary");

  return (
    <View style={styles.swatchRow}>
      <View style={[styles.swatchBox, { backgroundColor: value }]} />
      <View style={styles.swatchInfo}>
        <ThemedText type="bodyMedium">{name}</ThemedText>
        <ThemedText type="caption" style={{ color: captionColor }}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

function ColorGroup({
  title,
  tokens,
  colors,
}: {
  title: string;
  tokens: string[];
  colors: Record<string, string>;
}) {
  return (
    <View style={styles.colorGroup}>
      <ThemedText type="titleSm" style={styles.groupTitle}>
        {title}
      </ThemedText>
      {tokens.map((token) => (
        <ColorSwatch key={token} name={token} value={colors[token]} />
      ))}
    </View>
  );
}

export default function DesignSystemScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const primaryColor = useThemeColor({}, "primary");
  const errorColor = useThemeColor({}, "error");
  const textDisabled = useThemeColor({}, "textDisabled");
  const inputFill = useThemeColor({}, "inputFill");
  const { t } = useTranslation("designSystem");

  const typographySamples: Record<keyof typeof Typography, string> = {
    displayLg: t("typography.displayLg"),
    displaySm: t("typography.displaySm"),
    titleLg: t("typography.titleLg"),
    titleMd: t("typography.titleMd"),
    titleSm: t("typography.titleSm"),
    body: t("typography.body"),
    bodyMedium: t("typography.bodyMedium"),
    caption: t("typography.caption"),
    label: t("typography.label"),
    micro: t("typography.micro"),
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText type="titleLg">{t("title")}</ThemedText>
        <ThemedText type="caption" color="textSecondary">
          {t("tokenReference", { mode: colorScheme })}
        </ThemedText>

        {/* Colors */}
        <SectionTitle>{t("section.colors")}</SectionTitle>
        <ColorGroup
          title={t("colorGroup.backgrounds")}
          tokens={["background", "backgroundSubtle", "backgroundElevated"]}
          colors={colors}
        />
        <ColorGroup
          title={t("colorGroup.text")}
          tokens={["text", "textSecondary", "textMuted", "textDisabled"]}
          colors={colors}
        />
        <ColorGroup
          title={t("colorGroup.primary")}
          tokens={["primary", "primarySurface", "primaryContainer"]}
          colors={colors}
        />
        <ColorGroup
          title={t("colorGroup.bordersInputs")}
          tokens={["border", "borderSubtle", "inputFill", "inputFillFocused"]}
          colors={colors}
        />
        <ColorGroup
          title={t("colorGroup.semantic")}
          tokens={["success", "warning", "error", "destructiveSurface", "glow"]}
          colors={colors}
        />

        {/* Typography */}
        <SectionTitle>{t("section.typography")}</SectionTitle>
        {(Object.keys(Typography) as (keyof typeof Typography)[]).map((key) => (
          <View key={key} style={styles.typeRow}>
            <ThemedText type={key}>{typographySamples[key]}</ThemedText>
            <ThemedText type="caption" color="textMuted">
              {key} — {Typography[key].fontSize}px /{" "}
              {Typography[key].fontWeight}
            </ThemedText>
          </View>
        ))}

        {/* Spacing */}
        <SectionTitle>{t("section.spacing")}</SectionTitle>
        {(Object.entries(Spacing) as [string, number][]).map(
          ([name, value]) => (
            <View key={name} style={styles.spacingRow}>
              <ThemedText type="caption" style={styles.spacingLabel}>
                {name} ({value}px)
              </ThemedText>
              <View
                style={[
                  styles.spacingBar,
                  {
                    width: value * 4,
                    backgroundColor: primaryColor,
                  },
                ]}
              />
            </View>
          )
        )}

        {/* Radii */}
        <SectionTitle>{t("section.radii")}</SectionTitle>
        <View style={styles.radiiRow}>
          {(Object.entries(Radii) as [string, number][]).map(
            ([name, value]) => (
              <View key={name} style={styles.radiiItem}>
                <View
                  style={[
                    styles.radiiBox,
                    {
                      borderRadius: value,
                      borderColor: primaryColor,
                    },
                  ]}
                />
                <ThemedText type="caption">{name}</ThemedText>
                <ThemedText type="micro" color="textMuted">
                  {value}px
                </ThemedText>
              </View>
            )
          )}
        </View>

        {/* Buttons */}
        <SectionTitle>{t("section.buttons")}</SectionTitle>
        <View style={styles.buttonGroup}>
          {/* Primary */}
          <View
            style={[
              styles.button,
              {
                backgroundColor: primaryColor,
                borderRadius: Radii.lg,
              },
            ]}
          >
            <ThemedText
              type="bodyMedium"
              style={{ color: colorScheme === "light" ? "#FFFFFF" : "#1A1A1A" }}
            >
              {t("button.primary")}
            </ThemedText>
          </View>

          {/* Secondary */}
          <View
            style={[
              styles.button,
              {
                backgroundColor: colors.primaryContainer,
                borderRadius: Radii.lg,
              },
            ]}
          >
            <ThemedText type="bodyMedium" color="primary">
              {t("button.secondary")}
            </ThemedText>
          </View>

          {/* Ghost */}
          <View style={[styles.button, { borderRadius: Radii.lg }]}>
            <ThemedText type="bodyMedium" color="primary">
              {t("button.ghost")}
            </ThemedText>
          </View>

          {/* Destructive */}
          <View
            style={[
              styles.button,
              {
                backgroundColor: colors.destructiveSurface,
                borderRadius: Radii.lg,
              },
            ]}
          >
            <ThemedText type="bodyMedium" style={{ color: errorColor }}>
              {t("button.destructive")}
            </ThemedText>
          </View>

          {/* Disabled */}
          <View
            style={[
              styles.button,
              {
                backgroundColor: colors.borderSubtle,
                borderRadius: Radii.lg,
                opacity: Opacity.disabled,
              },
            ]}
          >
            <ThemedText type="bodyMedium" style={{ color: textDisabled }}>
              {t("button.disabled")}
            </ThemedText>
          </View>

          {/* Pill */}
          <View
            style={[
              styles.pill,
              {
                backgroundColor: colors.primarySurface,
                borderRadius: Radii.full,
              },
            ]}
          >
            <ThemedText type="caption" color="primary">
              {t("button.pill")}
            </ThemedText>
          </View>
        </View>

        {/* Inputs */}
        <SectionTitle>{t("section.inputs")}</SectionTitle>
        <View style={styles.inputGroup}>
          {/* Empty input */}
          <View style={styles.inputRow}>
            <ThemedText type="label" color="textMuted">
              {t("input.empty")}
            </ThemedText>
            <View
              style={[
                styles.input,
                {
                  backgroundColor: inputFill,
                  borderRadius: Radii.sm,
                },
              ]}
            >
              <ThemedText
                type="bodyMedium"
                style={{ color: textDisabled, textAlign: "center" }}
              >
                —
              </ThemedText>
            </View>
          </View>

          {/* Filled input */}
          <View style={styles.inputRow}>
            <ThemedText type="label" color="textMuted">
              {t("input.filled")}
            </ThemedText>
            <View
              style={[
                styles.input,
                {
                  backgroundColor: inputFill,
                  borderRadius: Radii.sm,
                },
              ]}
            >
              <ThemedText type="bodyMedium" style={{ textAlign: "center" }}>
                80
              </ThemedText>
            </View>
          </View>

          {/* Focused input */}
          <View style={styles.inputRow}>
            <ThemedText type="label" color="textMuted">
              {t("input.focused")}
            </ThemedText>
            <View
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputFillFocused,
                  borderRadius: Radii.sm,
                  borderWidth: 1.5,
                  borderColor: primaryColor,
                },
              ]}
            >
              <ThemedText type="bodyMedium" style={{ textAlign: "center" }}>
                80
              </ThemedText>
            </View>
          </View>

          {/* Checkboxes */}
          <View style={styles.inputRow}>
            <ThemedText type="label" color="textMuted">
              {t("input.checks")}
            </ThemedText>
            <View style={styles.checkboxRow}>
              {/* Empty checkbox */}
              <View style={[styles.checkbox, { borderColor: textDisabled }]} />
              {/* Completed checkbox */}
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  },
                ]}
              >
                <ThemedText
                  type="micro"
                  style={{ color: "#FFFFFF", textAlign: "center" }}
                >
                  ✓
                </ThemedText>
              </View>
              {/* PR checkbox */}
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: colors.success,
                    borderColor: colors.success,
                  },
                ]}
              >
                <ThemedText
                  type="micro"
                  style={{ color: "#FFFFFF", textAlign: "center" }}
                >
                  ★
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    paddingTop: Spacing["4xl"],
  },
  sectionTitle: {
    marginTop: Spacing["3xl"],
    marginBottom: Spacing.lg,
  },
  colorGroup: {
    marginBottom: Spacing.lg,
  },
  groupTitle: {
    marginBottom: Spacing.sm,
  },
  swatchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  swatchBox: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  swatchInfo: {
    marginLeft: Spacing.md,
  },
  typeRow: {
    marginBottom: Spacing.lg,
  },
  spacingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  spacingLabel: {
    width: 80,
  },
  spacingBar: {
    height: 12,
    borderRadius: Radii.sm,
  },
  radiiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  radiiItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  radiiBox: {
    width: 48,
    height: 48,
    borderWidth: 2,
  },
  buttonGroup: {
    gap: Spacing.md,
  },
  button: {
    paddingVertical: 13,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    alignItems: "center",
  },
  inputGroup: {
    gap: Spacing.lg,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  input: {
    width: 64,
    height: 36,
    justifyContent: "center",
  },
  checkboxRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    height: Spacing["5xl"],
  },
});
