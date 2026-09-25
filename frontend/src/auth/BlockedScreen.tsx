import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { Symbol } from "@/src/components/Symbol";
import { makeStyles } from "@/src/theme";

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
  offline: {
    title: "Can't Verify License",
    body: "We couldn't reach the server to verify your license. Connect to the internet and try again.",
  },
};

export function BlockedScreen({ reason }: { reason: string }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { logout, refresh } = useAuth();
  const msg = MESSAGES[reason] ?? MESSAGES.revoked;

  return (
    <View
      testID="blocked-screen"
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.center}>
        <Symbol name="lock.slash" fallback="⚠" size={56} color={styles.colors.error} />
        <Text testID="blocked-title" style={styles.title}>
          {msg.title}
        </Text>
        <Text style={styles.body}>{msg.body}</Text>
        <Pressable testID="blocked-retry-button" style={styles.button} onPress={refresh}>
          <Text style={styles.buttonLabel}>Try Again</Text>
        </Pressable>
      </View>
      <Pressable testID="blocked-logout-button" onPress={logout} style={styles.logout}>
        <Text style={styles.logoutLabel}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  colors,
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 28 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface, marginTop: 8 },
  body: { fontSize: 15, color: colors.onSurfaceSecondary, textAlign: "center", lineHeight: 22 },
  button: {
    marginTop: 16,
    backgroundColor: colors.brandPrimary,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  buttonLabel: { fontSize: 16, fontWeight: "700", color: colors.onBrandPrimary },
  logout: { alignItems: "center", paddingVertical: 12 },
  logoutLabel: { fontSize: 14, color: colors.muted, textDecorationLine: "underline" },
}));
