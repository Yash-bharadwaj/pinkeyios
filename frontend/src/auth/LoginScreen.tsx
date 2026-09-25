import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { Symbol } from "@/src/components/Symbol";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { ThemeScheme, useTheme } from "@/src/theme";

const PINKEY_PINK = "#FF2D9C";

export function LoginScreen() {
  return (
    <ThemeScheme scheme="light">
      <StatusBar style="dark" />
      <LoginScreenInner />
    </ThemeScheme>
  );
}

function LoginScreenInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(mapError(e instanceof Error ? e.message : "Login failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="login-screen" style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: 48 }}>
          <View style={{ width: 96, height: 96, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            {/* Soft glow backdrop — two falling-off translucent discs, since RN
                has no true blur-behind-a-view without a native blur layer. */}
            <View
              style={{
                position: "absolute",
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: PINKEY_PINK,
                opacity: 0.16,
              }}
            />
            <View
              style={{
                position: "absolute",
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: PINKEY_PINK,
                opacity: 0.22,
              }}
            />
            <Symbol
              name="key"
              fallback=""
              size={44}
              color={PINKEY_PINK}
              style={{ transform: [{ scaleX: -1 }] }}
            />
          </View>
          <Text
            style={{
              fontSize: 36,
              fontWeight: "800",
              letterSpacing: 6,
              color: PINKEY_PINK,
              textShadowColor: PINKEY_PINK,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 18,
            }}
          >
            PINKEY
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 8, letterSpacing: 1.5 }}>
            PERFORMER ACCESS
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          <Input
            testID="login-email-input"
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
          <Input
            testID="login-password-input"
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            isPassword
            autoCapitalize="none"
            error={error || undefined}
          />

          <View style={{ marginTop: 10 }}>
            <Button
              testID="login-submit-button"
              label="Sign In"
              size="lg"
              loading={busy}
              onPress={submit}
            />
          </View>

          <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 16, lineHeight: 18 }}>
            Accounts are issued by PINKEY. Contact your seller for access.
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function mapError(msg: string): string {
  if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("INVALID_LOGIN"))
    return "Incorrect email or password.";
  if (msg.includes("user-not-found")) return "No account found for that email.";
  if (msg.includes("too-many-requests")) return "Too many attempts. Try again shortly.";
  if (msg.includes("network")) return "Network error. Check your connection.";
  return msg;
}
