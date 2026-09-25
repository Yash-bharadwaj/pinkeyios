import { Pressable, Text, View } from "react-native";

import { useTheme } from "@/src/theme";

// A selectable chip with an optional subtitle — used for mode/length pickers.
export function Chip({
  title,
  subtitle,
  active,
  onPress,
  testID,
  grow = true,
}: {
  title: string;
  subtitle?: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
  grow?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        flexBasis: grow ? "47%" : undefined,
        flexGrow: grow ? 1 : 0,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? colors.brandPrimary : colors.border,
        paddingVertical: 13,
        paddingHorizontal: 14,
        backgroundColor: active ? colors.brandPrimary : colors.surfaceTertiary,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "600", color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>
        {title}
      </Text>
      {!!subtitle && (
        <Text
          style={{
            fontSize: 12,
            marginTop: 2,
            color: active ? colors.onBrandPrimary : colors.muted,
            opacity: active ? 0.75 : 1,
          }}
        >
          {subtitle}
        </Text>
      )}
    </Pressable>
  );
}

// A small pill chip, no subtitle — used for step "kind" selection.
export function PillChip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: active ? colors.brandPrimary : colors.border,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}
