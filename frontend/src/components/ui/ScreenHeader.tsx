import { Text, View } from "react-native";

import { useTheme } from "@/src/theme";

export function ScreenHeader({
  title,
  subtitle,
  left,
  right,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingBottom: 14,
      }}
    >
      <View style={{ minWidth: 28 }}>{left}</View>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.onSurface }}>{title}</Text>
        {!!subtitle && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>{subtitle}</Text>}
      </View>
      <View style={{ minWidth: 28, flexDirection: "row", alignItems: "center", gap: 16, justifyContent: "flex-end" }}>
        {right}
      </View>
    </View>
  );
}
