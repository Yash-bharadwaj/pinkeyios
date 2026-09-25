// Bottom sheet — used for the admin user action menu. Backdrop + drag handle
// + rounded top, closer to shadcn's Sheet than a raw absolute-positioned View.
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme";

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable
        testID="sheet-backdrop"
        onPress={onClose}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }}
      />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.surfaceSecondary,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderColor: colors.border,
          paddingBottom: insets.bottom + 16,
          maxHeight: "80%",
        }}
      >
        <View style={{ alignItems: "center", paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>

        {(title || subtitle) && (
          <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
            {!!title && <Text style={{ fontSize: 16, fontWeight: "700", color: colors.onSurface }}>{title}</Text>}
            {!!subtitle && <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{subtitle}</Text>}
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8 }}>{children}</ScrollView>

        <Pressable
          testID="sheet-close"
          onPress={onClose}
          style={{ alignItems: "center", paddingVertical: 14, marginTop: 4 }}
        >
          <Text style={{ fontSize: 14, color: colors.muted, fontWeight: "500" }}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SheetItem({
  label,
  icon,
  onPress,
  tone,
  testID,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  tone?: "error" | "success";
  testID?: string;
}) {
  const { colors } = useTheme();
  const color = tone === "error" ? colors.error : tone === "success" ? colors.success : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 13,
          paddingHorizontal: 8,
          borderRadius: 10,
        },
        pressed && { backgroundColor: colors.surfaceTertiary },
      ]}
    >
      {icon}
      <Text style={{ fontSize: 15, fontWeight: "500", color }}>{label}</Text>
    </Pressable>
  );
}
