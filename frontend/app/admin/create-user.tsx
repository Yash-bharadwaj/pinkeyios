import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

import { adminCreateUser } from "@/src/api";
import { Button, IconButton } from "@/src/components/ui/Button";
import { Card, SectionLabel } from "@/src/components/ui/Card";
import { DurationPicker } from "@/src/components/ui/DurationPicker";
import { Input } from "@/src/components/ui/Input";
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { Toggle } from "@/src/components/ui/Toggle";
import { Symbol } from "@/src/components/Symbol";
import { ThemeScheme, useTheme } from "@/src/theme";
import { withAlpha } from "@/src/utils/color";
import { generatePassword } from "@/src/utils/password";
import { buildAccessMessage } from "@/src/utils/shareMessage";

const CURRENCIES = ["USD", "INR"];

export default function CreateUserScreen() {
  return (
    <ThemeScheme scheme="light">
      <StatusBar style="dark" />
      <CreateUserScreenInner />
    </ThemeScheme>
  );
}

function CreateUserScreenInner() {
  const { colors } = useTheme();
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
  const [durationDays, setDurationDays] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ email: string; license_key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);

  const regeneratePassword = () => setPassword(generatePassword(name, email));

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
      duration_days: durationDays,
    });
  };

  const copyKey = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.license_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const accessMessage = result
    ? buildAccessMessage({ name, email: result.email, password, licenseKey: result.license_key })
    : "";

  const copyMessage = async () => {
    await Clipboard.setStringAsync(accessMessage);
    setMessageCopied(true);
    setTimeout(() => setMessageCopied(false), 1500);
  };

  const shareMessage = async () => {
    try {
      await Share.share({ message: accessMessage });
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  };

  if (result) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 16 }}>
        <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 28, paddingTop: 40, gap: 8 }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: withAlpha(colors.success, 0.12),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Symbol name="checkmark.seal.fill" fallback="✓" size={40} color={colors.success} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.onSurface, marginTop: 12 }}>
            Magician Created
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted }}>{result.email}</Text>

          <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 1, color: colors.muted, marginTop: 28, textTransform: "uppercase" }}>
            License Key
          </Text>
          <Pressable
            testID="copy-license-key"
            onPress={copyKey}
            style={({ pressed }) => [{ alignSelf: "stretch", marginTop: 8 }, pressed && { opacity: 0.8 }]}
          >
            <Card
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderColor: colors.brandTertiary,
                paddingVertical: 18,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: 2, color: colors.brandPrimary }}>
                {result.license_key}
              </Text>
              <Symbol name="doc.on.doc" fallback="⧉" size={18} color={colors.brandPrimary} />
            </Card>
          </Pressable>
          {copied && <Text style={{ color: colors.success, fontSize: 13, marginTop: 6 }}>Copied!</Text>}
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 20, lineHeight: 20 }}>
            This license works on one device only. Send the message below so they have everything
            they need to get started.
          </Text>

          <View style={{ alignSelf: "stretch", marginTop: 20, flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                testID="copy-access-message"
                variant="secondary"
                label={messageCopied ? "Copied" : "Copy Message"}
                icon={<Symbol name="doc.on.doc" fallback="⧉" size={16} color={colors.onSurface} />}
                onPress={copyMessage}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                testID="share-access-message"
                label="Share"
                icon={<Symbol name="square.and.arrow.up" fallback="↗" size={16} color={colors.onBrandPrimary} />}
                onPress={shareMessage}
              />
            </View>
          </View>

          <View style={{ alignSelf: "stretch", marginTop: 12 }}>
            <Button testID="create-done-button" label="Done" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <ScreenHeader
        title="New Magician"
        left={
          <IconButton testID="create-back-button" onPress={() => router.back()}>
            <Symbol name="chevron.left" fallback="‹" size={24} color={colors.onSurface} />
          </IconButton>
        }
      />

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 14 }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Input
          testID="create-email-input"
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="magician@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          testID="create-name-input"
          label="Name (optional)"
          value={name}
          onChangeText={setName}
          placeholder="Stage name"
        />
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginLeft: 2 }}>
              Temporary Password
            </Text>
            <Pressable
              testID="generate-password-button"
              onPress={regeneratePassword}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Symbol name="arrow.clockwise" fallback="↻" size={12} color={colors.brandPrimary} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.brandPrimary }}>
                {password ? "Regenerate" : "Generate"}
              </Text>
            </Pressable>
          </View>
          <Input
            testID="create-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="min 6 characters, or tap Generate"
            autoCapitalize="none"
          />
        </View>

        <Card
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 12,
          }}
        >
          <Text style={{ fontSize: 15, color: colors.onSurface }}>Give for free</Text>
          <Toggle testID="create-free-toggle" value={isFree} onValueChange={setIsFree} />
        </Card>

        {!isFree && (
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginLeft: 2 }}>
              Sale Price
            </Text>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {CURRENCIES.map((c) => {
                  const active = currency === c;
                  return (
                    <Pressable
                      key={c}
                      testID={`currency-${c}`}
                      onPress={() => setCurrency(c)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 13,
                        borderRadius: 10,
                        backgroundColor: active ? colors.brandPrimary : colors.surfaceTertiary,
                        borderWidth: 1,
                        borderColor: active ? colors.brandPrimary : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary,
                        }}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  testID="create-price-input"
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
        )}

        <Input
          testID="create-note-input"
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Internal note about this sale"
          multiline
          style={{ height: 72, textAlignVertical: "top" }}
        />

        <View>
          <SectionLabel>License Duration</SectionLabel>
          <DurationPicker testIDPrefix="create-duration" value={durationDays} onChange={setDurationDays} />
        </View>

        {!!error && (
          <Text testID="create-error" style={{ color: colors.error, fontSize: 13 }}>
            {error}
          </Text>
        )}

        <View style={{ marginTop: 8 }}>
          <Button
            testID="create-submit-button"
            label="Create & Issue License"
            size="lg"
            loading={mutation.isPending}
            onPress={submit}
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
