import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Radii } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { ExerciseImageData } from "@/lib/exercise-media";

type ExerciseImageSize = "thumbnail" | "card" | "hero";

interface ExerciseImageProps {
  image?: ExerciseImageData;
  exerciseName: string;
  size: ExerciseImageSize;
  accessibilityLabel?: string;
}

const SIZE_STYLES: Record<ExerciseImageSize, object> = {
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: Radii.sm,
  },
  card: {
    width: 56,
    height: 56,
    borderRadius: Radii.sm,
  },
  hero: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: Radii.md,
  },
};

export function ExerciseImage({
  image,
  exerciseName,
  size,
  accessibilityLabel,
}: ExerciseImageProps) {
  const { t } = useTranslation("common");
  const inputFill = useThemeColor({}, "inputFill");
  const textMuted = useThemeColor({}, "textMuted");
  const uri =
    size === "hero" ? image?.url : (image?.thumbnail_url ?? image?.url);
  const label =
    accessibilityLabel ??
    image?.alt_text ??
    t("media.exerciseIllustration", { exerciseName });

  return (
    <View
      style={[
        styles.container,
        SIZE_STYLES[size],
        { backgroundColor: inputFill },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
          cachePolicy="disk"
          accessibilityLabel={label}
        />
      ) : (
        <IconSymbol
          name="figure.strengthtraining.traditional"
          size={size === "hero" ? 40 : 20}
          color={textMuted}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
});
