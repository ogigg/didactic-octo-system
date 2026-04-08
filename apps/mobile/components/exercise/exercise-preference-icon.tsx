import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { ExercisePreferenceValue } from "@/lib/api/exercise-preferences";

interface ExercisePreferenceIconProps {
  preference: ExercisePreferenceValue | null | undefined;
  size?: number;
}

export function ExercisePreferenceIcon({
  preference,
  size = 22,
}: ExercisePreferenceIconProps) {
  const primary = useThemeColor({}, "primary");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const error = useThemeColor({}, "error");

  switch (preference ?? null) {
    case "preferred":
      return <IconSymbol name="heart.fill" size={size} color={primary} />;
    case "soft_dislike":
      return (
        <IconSymbol name="hand.thumbsdown" size={size} color={textSecondary} />
      );
    case "hard_dislike":
      return <IconSymbol name="nosign" size={size} color={error} />;
    default:
      return <IconSymbol name="heart" size={size} color={textMuted} />;
  }
}
