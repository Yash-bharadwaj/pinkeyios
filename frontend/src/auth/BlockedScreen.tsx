import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { Button } from "@/src/components/ui/Button";
import { Symbol } from "@/src/components/Symbol";
import { useTheme } from "@/src/theme";

const MESSAGES: Record<string, { title: string; body: string }> = {
  revoked: {
    title: "License Revoked",
    body: "This license has been revoked. Contact your seller to restore access.",
  },
  suspended: {
    title: "License Suspended",
    body: "This license is temporarily suspended. Please contact your seller.",
  },
  disabled: {
    title: "Account Disabled",
    body: "This account has been disabled. Please contact your seller.",
  },
  device_not_bound: {
    title: "Device Changed",
    body: "This license is active on another device. Ask your seller to move it here.",
  },
  expired: {
    title: "License Expired",
    body: "This time-limited license has expired. Contact your seller to renew it.",
  },
  offline: {
    title: "Can't Verify License",
    body: "We couldn't reach the server to verify your license. Connect to the internet and try again.",
  },
};

export function BlockedScreen({ reason }: { reason: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { logout, refresh } = useAuth();
  const msg = MESSAGES[reason] ?? MESSAGES.revoked;

  return (
    <View
      testID="blocked-screen"
      style={{ flex: 1, backgroundColor: colors.surface, paddingHorizontal: 28, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: "rgba(255,69,58,0.12)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Symbol name="lock.slash" fallback="⚠" size={32} color={colors.error} />
        </View>
        <Text testID="blocked-title" style={{ fontSize: 22, fontWeight: "800", color: colors.onSurface, marginTop: 4 }}>
          {msg.title}
        </Text>
        <Text style={{ fontSize: 15, color: colors.onSurfaceSecondary, textAlign: "center", lineHeight: 22 }}>
          {msg.body}
        </Text>
        <Button
          testID="blocked-retry-button"
          label="Try Again"
          onPress={refresh}
          fullWidth={false}
          style={{ paddingHorizontal: 32, marginTop: 6 }}
        />
      </View>
      <Button
        testID="blocked-logout-button"
        variant="ghost"
        label="Sign out"
        onPress={logout}
        fullWidth={false}
        size="sm"
        style={{ alignSelf: "center" }}
      />
    </View>
  );
}
