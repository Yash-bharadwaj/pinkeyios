import { Text, View } from "react-native";

import { useTheme } from "@/src/theme";
import { withAlpha } from "@/src/utils/color";

export type BadgeTone = "neutral" | "success" | "warning" | "error" | "brand";

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const { colors } = useTheme();
  const tones: Record<BadgeTone, { bg: string; text: string; border: string }> = {
    neutral: { bg: colors.surfaceTertiary, text: colors.onSurfaceTertiary, border: colors.border },
    success: { bg: withAlpha(colors.success, 0.14), text: colors.success, border: withAlpha(colors.success, 0.25) },
    warning: { bg: withAlpha(colors.warning, 0.14), text: colors.warning, border: withAlpha(colors.warning, 0.25) },
    error: { bg: withAlpha(colors.error, 0.14), text: colors.error, border: withAlpha(colors.error, 0.25) },
    brand: { bg: withAlpha(colors.brandPrimary, 0.1), text: colors.brandPrimary, border: withAlpha(colors.brandPrimary, 0.25) },
  };
  const t = tones[tone];
  return (
    <View
      style={{
        backgroundColor: t.bg,
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color: t.text, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}
