import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

import { adminCreateUser } from "@/src/api";
import { Symbol } from "@/src/components/Symbol";
import { makeStyles } from "@/src/theme";

const CURRENCIES = ["USD", "INR"];

export default function CreateUserScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ email: string; license_key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: adminCreateUser,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "summary"] });
      setResult({ email: d.email, license_key: d.license_key });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to create user"),
  });

  const submit = () => {
    setError("");
    if (!email.includes("@")) return setError("Enter a valid email.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (!isFree && (!price || Number(price) < 0)) return setError("Enter a valid price or mark as free.");
    mutation.mutate({
      email: email.trim().toLowerCase(),
      password,
      name: name.trim(),
      price: isFree ? 0 : Number(price),
      currency,
      is_free: isFree,
      note: note.trim(),
    });
  };

  const copyKey = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.license_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (result) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.successWrap}>
          <Symbol name="checkmark.seal.fill" fallback="✓" size={56} color={styles.colors.success} />
          <Text style={styles.successTitle}>Magician Created</Text>
          <Text style={styles.successSub}>{result.email}</Text>

          <Text style={styles.keyLabel}>LICENSE KEY</Text>
          <Pressable testID="copy-license-key" style={styles.keyBox} onPress={copyKey}>
            <Text style={styles.keyText}>{result.license_key}</Text>
            <Symbol name="doc.on.doc" fallback="⧉" size={18} color={styles.colors.brandPrimary} />
          </Pressable>
          {copied && <Text style={styles.copied}>Copied!</Text>}
          <Text style={styles.successNote}>
            Share the email, password, and this license key with the magician. It works on one
            device only.
          </Text>

          <Pressable testID="create-done-button" style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryLabel}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable testID="create-back-button" onPress={() => router.back()} hitSlop={12}>
          <Symbol name="chevron.left" fallback="‹" size={26} color={styles.colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>New Magician</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Email" styles={styles}>
          <TextInput
            testID="create-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="magician@example.com"
            placeholderTextColor={styles.colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>
        <Field label="Name (optional)" styles={styles}>
          <TextInput
            testID="create-name-input"
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Stage name"
            placeholderTextColor={styles.colors.muted}
          />
        </Field>
        <Field label="Temporary Password" styles={styles}>
          <TextInput
            testID="create-password-input"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="min 6 characters"
            placeholderTextColor={styles.colors.muted}
            autoCapitalize="none"
          />
        </Field>

        <View style={styles.freeRow}>
          <Text style={styles.freeLabel}>Give for free</Text>
          <Switch
            testID="create-free-toggle"
            value={isFree}
            onValueChange={setIsFree}
            trackColor={{ false: styles.colors.surfaceTertiary, true: styles.colors.brandPrimary }}
            thumbColor={styles.colors.onSurface}
          />
        </View>

        {!isFree && (
          <Field label="Sale Price" styles={styles}>
            <View style={styles.priceRow}>
              <View style={styles.currencyToggle}>
                {CURRENCIES.map((c) => (
                  <Pressable
                    key={c}
                    testID={`currency-${c}`}
                    style={[styles.currencyChip, currency === c && styles.currencyChipActive]}
                    onPress={() => setCurrency(c)}
                  >
                    <Text
                      style={[styles.currencyText, currency === c && styles.currencyTextActive]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                testID="create-price-input"
                style={[styles.input, { flex: 1 }]}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={styles.colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
          </Field>
        )}

        <Field label="Note (optional)" styles={styles}>
          <TextInput
            testID="create-note-input"
            style={[styles.input, { height: 72, textAlignVertical: "top" }]}
            value={note}
            onChangeText={setNote}
            placeholder="Internal note about this sale"
            placeholderTextColor={styles.colors.muted}
            multiline
          />
        </Field>

        {!!error && (
          <Text testID="create-error" style={styles.error}>
            {error}
          </Text>
        )}

        <Pressable
          testID="create-submit-button"
          style={[styles.primaryButton, mutation.isPending && { opacity: 0.6 }]}
          onPress={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={styles.colors.onBrandPrimary} />
          ) : (
            <Text style={styles.primaryLabel}>Create & Issue License</Text>
          )}
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({ label, children, styles }: { label: string; children: React.ReactNode; styles: any }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  colors,
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  fieldLabel: { fontSize: 13, color: colors.muted, marginBottom: 6, marginLeft: 2 },
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
  freeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  freeLabel: { fontSize: 16, color: colors.onSurface },
  priceRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  currencyToggle: { flexDirection: "row", gap: 6 },
  currencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  currencyChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  currencyText: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceSecondary },
  currencyTextActive: { color: colors.onBrandPrimary },
  error: { color: colors.error, fontSize: 13, marginTop: 14 },
  primaryButton: {
    marginTop: 28,
    backgroundColor: colors.brandPrimary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryLabel: { fontSize: 17, fontWeight: "700", color: colors.onBrandPrimary },
  successWrap: { flex: 1, alignItems: "center", paddingHorizontal: 28, paddingTop: 40, gap: 8 },
  successTitle: { fontSize: 24, fontWeight: "800", color: colors.onSurface, marginTop: 8 },
  successSub: { fontSize: 14, color: colors.muted },
  keyLabel: { fontSize: 12, letterSpacing: 1.2, color: colors.muted, marginTop: 32 },
  keyBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brandTertiary,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginTop: 8,
    alignSelf: "stretch",
  },
  keyText: { fontSize: 22, fontWeight: "700", letterSpacing: 2, color: colors.brandPrimary },
  copied: { color: colors.success, fontSize: 13, marginTop: 6 },
  successNote: { fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 20, lineHeight: 20 },
}));
