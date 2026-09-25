import { Pressable, Text, View } from "react-native";

import { useTheme } from "@/src/theme";

export function Stepper({
  value,
  onDecrement,
  onIncrement,
  size = "md",
  testIDBase,
}: {
  value: number | string;
  onDecrement: () => void;
  onIncrement: () => void;
  size?: "md" | "sm";
  testIDBase?: string;
}) {
  const { colors } = useTheme();
  const btn = size === "sm" ? 34 : 44;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size === "sm" ? 12 : 14 }}>
      <Pressable
        testID={testIDBase ? `${testIDBase}-minus` : undefined}
        onPress={onDecrement}
        hitSlop={8}
        style={{
          width: btn,
          height: btn,
          borderRadius: btn / 2,
          backgroundColor: colors.surfaceTertiary,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: size === "sm" ? 18 : 22, color: colors.onSurfaceSecondary, lineHeight: size === "sm" ? 20 : 26 }}>
          −
        </Text>
      </Pressable>
      <Text
        testID={testIDBase ? `${testIDBase}-count` : undefined}
        style={{
          fontSize: size === "sm" ? 17 : 18,
          fontWeight: "700",
          color: colors.brandPrimary,
          minWidth: size === "sm" ? 18 : 20,
          textAlign: "center",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Pressable
        testID={testIDBase ? `${testIDBase}-plus` : undefined}
        onPress={onIncrement}
        hitSlop={8}
        style={{
          width: btn,
          height: btn,
          borderRadius: btn / 2,
          backgroundColor: colors.surfaceTertiary,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: size === "sm" ? 18 : 22, color: colors.onSurfaceSecondary, lineHeight: size === "sm" ? 20 : 26 }}>
          +
        </Text>
      </Pressable>
    </View>
  );
}
