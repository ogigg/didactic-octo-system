import {
  AppBottomSheet,
  type AppBottomSheetHandle,
} from "@/components/ui/app-bottom-sheet";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SearchBar } from "@/components/exercise-picker/search-bar";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  isLoading?: boolean;
  isError?: boolean;
  options: string[];
  selected: string[];
  displayLabels?: ReadonlyMap<string, string>;
  onApply: (selected: string[]) => void;
  onDraftChange: (selected: string[]) => void;
  onRetry: () => void;
  resultCount?: number;
  searchThreshold?: number;
}

export function FilterSheet({
  visible,
  onClose,
  title,
  isLoading = false,
  isError = false,
  options,
  selected,
  displayLabels,
  onApply,
  onDraftChange,
  onRetry,
  resultCount,
  searchThreshold,
}: FilterSheetProps) {
  const { t } = useTranslation("exercisePicker");
  const sheetRef = useRef<AppBottomSheetHandle>(null);
  const [draftSelected, setDraftSelected] = useState(selected);
  const [optionSearch, setOptionSearch] = useState("");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const border = useThemeColor({}, "border");

  useEffect(() => {
    if (!visible) return;
    setDraftSelected(selected);
    setOptionSearch("");
    onDraftChange(selected);
  }, [onDraftChange, selected, visible]);

  const updateDraft = useCallback(
    (nextSelection: string[]) => {
      setDraftSelected(nextSelection);
      onDraftChange(nextSelection);
    },
    [onDraftChange]
  );

  const toggleOption = useCallback(
    (value: string) => {
      setDraftSelected((current) => {
        const nextSelection = current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value];
        onDraftChange(nextSelection);
        return nextSelection;
      });
    },
    [onDraftChange]
  );

  const filteredOptions = useMemo(() => {
    const query = optionSearch.trim().toLocaleLowerCase();
    if (!query) return options;
    return options.filter((option) =>
      (displayLabels?.get(option) ?? option).toLocaleLowerCase().includes(query)
    );
  }, [displayLabels, optionSearch, options]);

  const showSearch =
    searchThreshold != null && options.length > searchThreshold;

  const handleApply = useCallback(() => {
    const nextSelection = draftSelected;
    sheetRef.current?.dismiss(() => onApply(nextSelection));
  }, [draftSelected, onApply]);

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      const isSelected = draftSelected.includes(item);
      const label = displayLabels?.get(item) ?? item;
      return (
        <Pressable
          onPress={() => toggleOption(item)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          accessibilityLabel={label}
          style={[
            styles.option,
            {
              backgroundColor: isSelected ? primarySurface : "transparent",
            },
          ]}
        >
          <Text
            style={[
              isSelected ? Typography.bodyMedium : Typography.body,
              styles.optionLabel,
              { color: isSelected ? primary : textColor },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          <View
            style={[
              styles.checkbox,
              isSelected
                ? { backgroundColor: primary, borderColor: primary }
                : { borderColor: border },
            ]}
          >
            {isSelected && (
              <IconSymbol name="checkmark" size={12} color="#FFFFFF" />
            )}
          </View>
        </Pressable>
      );
    },
    [
      border,
      displayLabels,
      draftSelected,
      primary,
      primarySurface,
      textColor,
      toggleOption,
    ]
  );

  const keyExtractor = useCallback((item: string) => item, []);

  return (
    <AppBottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={onClose}
      closeAccessibilityLabel={t("filters.closeSheet")}
      height="72%"
      testID="filter-sheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[Typography.titleMd, { color: textColor }]}>
              {title}
            </Text>
            <Text style={[Typography.caption, { color: textMuted }]}>
              {t("filters.selectedCount", { count: draftSelected.length })}
            </Text>
          </View>
          <Pressable
            onPress={() => updateDraft([])}
            disabled={isLoading || isError || draftSelected.length === 0}
            accessibilityRole="button"
            accessibilityLabel={t("filters.reset")}
            accessibilityState={{
              disabled: isLoading || isError || draftSelected.length === 0,
            }}
            style={styles.resetButton}
          >
            <Text
              style={[
                Typography.bodyMedium,
                {
                  color:
                    draftSelected.length > 0 && !isLoading && !isError
                      ? primary
                      : textMuted,
                },
              ]}
            >
              {t("filters.reset")}
            </Text>
          </Pressable>
        </View>

        {showSearch && !isLoading && !isError ? (
          <View style={styles.searchContainer}>
            <SearchBar
              value={optionSearch}
              onChangeText={setOptionSearch}
              onClear={() => setOptionSearch("")}
              placeholder={t("filters.optionSearchPlaceholder")}
              clearAccessibilityLabel={t("filters.clearOptionSearch")}
              autoFocus={false}
            />
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={primary} />
            <Text
              style={[Typography.body, styles.stateText, { color: textMuted }]}
            >
              {t("filters.loadingOptions")}
            </Text>
          </View>
        ) : isError ? (
          <View style={styles.stateContainer}>
            <Text
              style={[Typography.body, styles.stateText, { color: textMuted }]}
            >
              {t("filters.loadError")}
            </Text>
            <Button
              label={t("filters.retry")}
              variant="secondary"
              onPress={onRetry}
              style={styles.retryButton}
            />
          </View>
        ) : (
          <FlatList
            data={filteredOptions}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            bounces={false}
            style={styles.list}
            ListEmptyComponent={
              <Text
                style={[
                  Typography.body,
                  styles.emptyText,
                  { color: textMuted },
                ]}
              >
                {optionSearch
                  ? t("filters.noMatchingOptions")
                  : t("filters.emptyOptions")}
              </Text>
            }
          />
        )}

        <View style={[styles.actions, { borderTopColor: border }]}>
          <Button
            label={
              resultCount == null
                ? t("filters.showResultsLoading")
                : t("filters.showResults", { count: resultCount })
            }
            disabled={isLoading || isError}
            onPress={handleApply}
          />
        </View>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs / 2,
  },
  resetButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingLeft: Spacing.md,
  },
  searchContainer: {
    paddingBottom: Spacing.md,
  },
  list: {
    flex: 1,
  },
  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing["3xl"],
  },
  stateText: {
    textAlign: "center",
  },
  retryButton: {
    alignSelf: "stretch",
  },
  emptyText: {
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing["3xl"],
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    minHeight: 48,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs / 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
  },
  optionLabel: {
    flexShrink: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
});
