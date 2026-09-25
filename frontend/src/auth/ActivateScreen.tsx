import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, activateLicense, requestDeviceChange } from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Symbol } from "@/src/components/Symbol";
import { getDeviceId, getDeviceName } from "@/src/device";
import { ThemeScheme, useTheme } from "@/src/theme";

export function ActivateScreen() {
  return (
    <ThemeScheme scheme="light">
      <StatusBar style="dark" />
      <ActivateScreenInner />
    </ThemeScheme>
  );
}

function ActivateScreenInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { logout, refresh, profile } = useAuth();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deviceConflict, setDeviceConflict] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    setError("");
    setDeviceConflict(false);
    setBusy(true);
    try {
      const deviceId = await getDeviceId();
      await activateLicense(key.trim().toUpperCase(), deviceId, getDeviceName());
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDeviceConflict(true);
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Activation failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const sendDeviceChangeRequest = async () => {
    setRequestBusy(true);
    try {
      const deviceId = await getDeviceId();
      await requestDeviceChange(deviceId, getDeviceName());
      setRequestSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the request");
    } finally {
      setRequestBusy(false);
    }
  };

  const checkAgain = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  return (
    <View testID="activate-screen" style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 26, fontWeight: "800", color: colors.brandPrimary }}>Activate License</Text>
        <Text style={{ fontSize: 14, color: colors.onSurfaceSecondary, marginTop: 10, lineHeight: 20 }}>
          Signed in as {profile?.email}. Enter the license key from your seller to unlock PINKEY
          on this device.
        </Text>

        <View style={{ marginTop: 28 }}>
          <Input
            testID="activate-key-input"
            label="License Key"
            value={key}
            onChangeText={setKey}
            placeholder="PINK-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            error={!deviceConflict && error ? error : undefined}
            style={{ fontSize: 17, letterSpacing: 2 }}
          />
        </View>

        <View style={{ marginTop: 22 }}>
          <Button testID="activate-submit-button" label="Activate" size="lg" loading={busy} onPress={submit} />
        </View>

        {deviceConflict && (
          <View
            testID="device-conflict-panel"
            style={{
              marginTop: 18,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Symbol name="exclamationmark.triangle.fill" fallback="⚠" size={16} color={colors.warning} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onSurface }}>Already on another device</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 18 }}>
              {error}
            </Text>

            {requestSent ? (
              <View style={{ marginTop: 14, gap: 10 }}>
                <Text testID="device-request-sent" style={{ fontSize: 13, color: colors.success }}>
                  Request sent. Once your seller approves it, this device will be activated
                  automatically.
                </Text>
                <Button
                  testID="activate-check-again"
                  variant="secondary"
                  label="Check again"
                  size="sm"
                  loading={checking}
                  onPress={checkAgain}
                />
              </View>
            ) : (
              <View style={{ marginTop: 14 }}>
                <Button
                  testID="request-device-change-button"
                  variant="secondary"
                  label="Request device change"
                  loading={requestBusy}
                  onPress={sendDeviceChangeRequest}
                />
              </View>
            )}
          </View>
        )}

        <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 20, lineHeight: 18 }}>
          Each license works on one device only. To move devices, ask your seller to reset it.
        </Text>

        <Button
          testID="activate-logout-button"
          variant="ghost"
          label="Sign out"
          onPress={logout}
          fullWidth={false}
          size="sm"
          style={{ alignSelf: "center", marginTop: 20 }}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}
