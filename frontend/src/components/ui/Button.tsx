// Shared button component — shadcn-style variants over PINKEY's dark/gold theme.
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/src/theme";
import { withAlpha } from "@/src/utils/color";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "md" | "lg" | "sm";

type Props = Omit<PressableProps, "style"> & {
  label?: string;
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  children,
  variant = "primary",
  size = "md",
  loading,
  icon,
  fullWidth = true,
  disabled,
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();

  const paddingVertical = size === "lg" ? 15 : size === "sm" ? 9 : 12;
  const fontSize = size === "lg" ? 16 : size === "sm" ? 13 : 15;

  const base = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    borderRadius: 12,
    paddingVertical,
    paddingHorizontal: 18,
    alignSelf: fullWidth ? ("stretch" as const) : ("flex-start" as const),
    borderWidth: 1,
    borderColor: "transparent",
  };

  const variants: Record<ButtonVariant, { bg: string; border: string; text: string }> = {
    primary: { bg: colors.brandPrimary, border: colors.brandPrimary, text: colors.onBrandPrimary },
    secondary: { bg: colors.surfaceTertiary, border: colors.border, text: colors.onSurface },
    outline: { bg: "transparent", border: colors.border, text: colors.onSurface },
    ghost: { bg: "transparent", border: "transparent", text: colors.onSurface },
    destructive: { bg: withAlpha(colors.error, 0.12), border: withAlpha(colors.error, 0.35), text: colors.error },
  };
  const v = variants[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        base,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && !isDisabled && { opacity: 0.82 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <>
          {icon}
          {(label || children) && (
            <Text style={{ fontSize, fontWeight: "600", color: v.text }}>{label ?? children}</Text>
          )}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  onPress,
  children,
  hitSlop = 12,
  testID,
  disabled,
}: {
  onPress: () => void;
  children: React.ReactNode;
  hitSlop?: number;
  testID?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={hitSlop}
      disabled={disabled}
      style={({ pressed }) => [{ opacity: pressed && !disabled ? 0.6 : disabled ? 0.5 : 1 }]}
    >
      <View>{children}</View>
    </Pressable>
  );
}
