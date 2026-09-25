import { Pressable, View } from "react-native";

import { useTheme } from "@/src/theme";

export function Toggle({
  value,
  onValueChange,
  testID,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={{
        width: 46,
        height: 28,
        borderRadius: 14,
        padding: 3,
        backgroundColor: value ? colors.brandPrimary : colors.surfaceTertiary,
        borderWidth: 1,
        borderColor: value ? colors.brandPrimary : colors.border,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          // The thumb sits ON the track color, so it needs the "on <color>"
          // text/icon token for that track, not `onSurface` (text-on-canvas) —
          // that token is near-black in the light theme, same as brandPrimary
          // itself, so an "on" switch became an invisible black-on-black thumb.
          backgroundColor: value ? colors.onBrandPrimary : colors.onSurface,
          alignSelf: value ? "flex-end" : "flex-start",
        }}
      />
    </Pressable>
  );
}
