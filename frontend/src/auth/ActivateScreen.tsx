import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { activateLicense } from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";
import { getDeviceId, getDeviceName } from "@/src/device";
import { makeStyles } from "@/src/theme";

export function ActivateScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { logout, refresh, profile } = useAuth();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const deviceId = await getDeviceId();
      await activateLicense(key.trim().toUpperCase(), deviceId, getDeviceName());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="activate-screen" style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Activate License</Text>
        <Text style={styles.subtitle}>
          Signed in as {profile?.email}. Enter the license key from your seller to unlock
          PINKEY on this device.
        </Text>

        <Text style={styles.label}>License Key</Text>
        <TextInput
          testID="activate-key-input"
          style={styles.input}
          value={key}
          onChangeText={setKey}
          placeholder="PINK-XXXX-XXXX-XXXX"
          placeholderTextColor={styles.colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {!!error && (
          <Text testID="activate-error" style={styles.error}>
            {error}
          </Text>
        )}
        <Pressable
          testID="activate-submit-button"
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={styles.colors.onBrandPrimary} />
          ) : (
            <Text style={styles.buttonLabel}>Activate</Text>
          )}
        </Pressable>

        <Text style={styles.note}>
          Each license works on one device only. To move devices, ask your seller to reset it.
        </Text>

        <Pressable testID="activate-logout-button" onPress={logout} style={styles.logout}>
          <Text style={styles.logoutLabel}>Sign out</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  colors,
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 },
  title: { fontSize: 28, fontWeight: "800", color: colors.brandPrimary },
  subtitle: { fontSize: 14, color: colors.onSurfaceSecondary, marginTop: 12, lineHeight: 20 },
  label: { fontSize: 13, color: colors.muted, marginTop: 28, marginLeft: 2 },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.onSurface,
    marginTop: 6,
  },
  error: { color: colors.error, fontSize: 13, marginTop: 12 },
  button: {
    marginTop: 24,
    backgroundColor: colors.brandPrimary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonLabel: { fontSize: 17, fontWeight: "700", color: colors.onBrandPrimary },
  note: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 20, lineHeight: 18 },
  logout: { marginTop: 28, alignItems: "center" },
  logoutLabel: { fontSize: 14, color: colors.muted, textDecorationLine: "underline" },
}));
