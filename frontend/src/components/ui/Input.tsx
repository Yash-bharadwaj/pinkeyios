// Shared text input — label, hint/error text, a focus ring, and an optional
// eye toggle for password fields, shadcn-style.
import { useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

import { Symbol } from "@/src/components/Symbol";
import { useTheme } from "@/src/theme";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  testID?: string;
  // When true, renders as a password field with a tappable eye icon that
  // toggles visibility — starts hidden. Overrides `secureTextEntry`.
  isPassword?: boolean;
};

export function Input({
  label,
  error,
  hint,
  style,
  onFocus,
  onBlur,
  testID,
  isPassword,
  secureTextEntry,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      {!!label && (
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginLeft: 2 }}>
          {label}
        </Text>
      )}
      <View style={{ justifyContent: "center" }}>
        <TextInput
          testID={testID}
          placeholderTextColor={colors.muted}
          secureTextEntry={isPassword ? !revealed : secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: 10,
              borderWidth: focused ? 1.5 : 1,
              borderColor: error ? colors.error : focused ? colors.brandPrimary : colors.border,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: colors.onSurface,
            },
            isPassword && { paddingRight: 44 },
            style,
          ]}
          {...rest}
        />
        {isPassword && (
          <Pressable
            testID={testID ? `${testID}-toggle` : undefined}
            onPress={() => setRevealed((r) => !r)}
            hitSlop={10}
            style={{ position: "absolute", right: 12 }}
          >
            <Symbol
              name={revealed ? "eye.slash" : "eye"}
              fallback={revealed ? "🙈" : "👁"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
        )}
      </View>
      {!!error && <Text style={{ fontSize: 12, color: colors.error }}>{error}</Text>}
      {!error && !!hint && <Text style={{ fontSize: 12, color: colors.muted }}>{hint}</Text>}
    </View>
  );
}
