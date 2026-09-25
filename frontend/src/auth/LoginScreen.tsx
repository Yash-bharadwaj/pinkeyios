import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { makeStyles } from "@/src/theme";

export function LoginScreen() {
  const styles = useStyles();
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
    <View testID="login-screen" style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandBlock}>
          <Text style={styles.brandMark}>PINKEY</Text>
          <Text style={styles.tagline}>Performer Access</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={styles.colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="login-password-input"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={styles.colors.muted}
            secureTextEntry
            autoCapitalize="none"
          />
          {!!error && (
            <Text testID="login-error" style={styles.error}>
              {error}
            </Text>
          )}
          <Pressable
            testID="login-submit-button"
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={styles.colors.onBrandPrimary} />
            ) : (
              <Text style={styles.buttonLabel}>Sign In</Text>
            )}
          </Pressable>
          <Text style={styles.hint}>
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

const useStyles = makeStyles((colors) => ({
  colors,
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 },
  brandBlock: { alignItems: "center", marginBottom: 44 },
  brandMark: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 8,
    color: colors.brandPrimary,
  },
  tagline: { fontSize: 13, color: colors.muted, marginTop: 8, letterSpacing: 2 },
  form: { gap: 8 },
  label: { fontSize: 13, color: colors.muted, marginTop: 12, marginLeft: 2 },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.onSurface,
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
  hint: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 20, lineHeight: 18 },
}));
