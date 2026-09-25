// Performer Setup — premium command center (performer-only; brand gold allowed).
// Configure mode, entry length, attempts, offsets, wallpaper, and feedback.

import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Symbol } from "@/src/components/Symbol";
import { useAuth } from "@/src/auth/AuthContext";
import { WALLPAPER_PRESETS, isCustomWallpaper } from "@/src/components/wallpapers";
import { buildAttempts, buildDefaultConfig } from "@/src/engine/defaults";
import { createSession, transformValue } from "@/src/engine/engine";
import { loadConfig, saveConfig, setCurrentSession } from "@/src/engine/sessionStore";
import type { EntryLength, Mode, PerformanceConfig, ScriptStep, StepKind } from "@/src/engine/types";
import { makeStyles } from "@/src/theme";

const MODES: { key: Mode; title: string; subtitle: string }[] = [
  { key: "BASIC", title: "Basic", subtitle: "Sequence of attempts" },
  { key: "TRANSFORM", title: "Transform", subtitle: "Offset arithmetic" },
  { key: "SCRAMBLE", title: "Scramble Peek", subtitle: "Non-linear positions" },
  { key: "HYBRID", title: "Hybrid", subtitle: "Mixed routine" },
];

const STEP_KINDS: { key: StepKind; label: string }[] = [
  { key: "direct", label: "Direct" },
  { key: "transform", label: "Transform" },
  { key: "delete", label: "Delete" },
  { key: "filler", label: "Filler" },
];

const LENGTHS: { key: EntryLength; title: string; subtitle: string }[] = [
  { key: 4, title: "4 digits", subtitle: "MMYY" },
  { key: 6, title: "6 digits", subtitle: "MMDDYY" },
];

function parseOffsets(text: string): number[] | null {
  const trimmed = text.trim();
  if (!/^\d+(\s*,\s*\d+)*$/.test(trimmed)) return null;
  return trimmed.split(",").map((p) => Number(p.trim()) % 10);
}

export default function SetupScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();

  const [config, setConfig] = useState<PerformanceConfig | null>(null);
  const [offsetsText, setOffsetsText] = useState("");
  const [offsetsError, setOffsetsError] = useState("");
  const [wallpaperError, setWallpaperError] = useState("");

  useEffect(() => {
    loadConfig().then((loaded) => {
      setConfig(loaded);
      setOffsetsText(loaded.offsets.join(","));
    });
  }, []);

  if (!config) {
    return <View testID="setup-screen" style={styles.container} />;
  }

  const switchMode = (mode: Mode) => {
    const fresh = buildDefaultConfig(mode, config.entryLength);
    setConfig({
      ...fresh,
      haptics: config.haptics,
      sounds: config.sounds,
      wallpaper: config.wallpaper,
    });
    setOffsetsText(fresh.offsets.join(","));
    setOffsetsError("");
  };

  const switchLength = (entryLength: EntryLength) => {
    const fresh = buildDefaultConfig(config.mode, entryLength);
    setConfig({
      ...fresh,
      haptics: config.haptics,
      sounds: config.sounds,
      wallpaper: config.wallpaper,
    });
    setOffsetsText(fresh.offsets.join(","));
    setOffsetsError("");
  };

  const setAttemptCount = (delta: number) => {
    const count = Math.min(6, Math.max(2, config.attempts.length + delta));
    if (count !== config.attempts.length)
      setConfig({ ...config, attempts: buildAttempts(count) });
  };

  const onChangeOffsets = (text: string) => {
    setOffsetsText(text);
    const parsed = parseOffsets(text);
    if (!parsed || parsed.length !== config.entryLength) {
      setOffsetsError(
        `Enter ${config.entryLength} single-digit offsets, comma separated (e.g. 4,1,3,2)`,
      );
      return;
    }
    setOffsetsError("");
    setConfig({ ...config, offsets: parsed });
  };

  const updateStep = (index: number, patch: Partial<ScriptStep>) => {
    const script = config.script.map((s, i) => {
      if (i !== index) return s;
      const next = { ...s, ...patch };
      if (next.kind === "filler") next.position = 0;
      else if (s.kind === "filler" && next.position === 0) next.position = 1;
      return next;
    });
    setConfig({ ...config, script });
  };

  const removeStep = (index: number) => {
    setConfig({ ...config, script: config.script.filter((_, i) => i !== index) });
  };

  const addStep = () => {
    setConfig({
      ...config,
      script: [...config.script, { position: 1, kind: "direct", offset: 0 }],
    });
  };

  // Which target positions are covered exactly once (fillers excluded)?
  const coverage = (() => {
    const counts: Record<number, number> = {};
    for (const s of config.script) {
      if (s.kind === "filler") continue;
      counts[s.position] = (counts[s.position] ?? 0) + 1;
    }
    const missing: number[] = [];
    const dupes: number[] = [];
    for (let p = 1; p <= config.entryLength; p++) {
      if (!counts[p]) missing.push(p);
      else if (counts[p] > 1) dupes.push(p);
    }
    return { missing, dupes, ok: missing.length === 0 && dupes.length === 0 };
  })();

  const pickWallpaperPhoto = async () => {
    setWallpaperError("");
    // Contextual permission flow: check → ask once (clear intent: performer
    // tapped "Your Photo") → if blocked, offer Settings.
    let status = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!status.granted && status.canAskAgain) {
      status = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (!status.granted) {
      setWallpaperError(
        "Photo access is off. Enable it in Settings to use your own wallpaper.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setConfig({ ...config, wallpaper: result.assets[0].uri });
    }
  };

  const start = async () => {
    await saveConfig(config);
    setCurrentSession(createSession(config));
    router.back();
  };

  const offsetsPreview =
    config.mode === "TRANSFORM" && !offsetsError
      ? transformValue(
          "2749".padEnd(config.entryLength, "9").slice(0, config.entryLength),
          config.offsets,
        )
      : null;

  return (
    <View testID="setup-screen" style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Performer Setup</Text>
        <Pressable testID="setup-close-button" onPress={() => router.back()} hitSlop={12}>
          <Symbol name="xmark.circle.fill" fallback="✕" size={26} color={styles.colors.muted} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        {/* MODE */}
        <Text style={styles.sectionLabel}>ROUTINE MODE</Text>
        <View style={styles.card}>
          <View style={styles.chipGrid}>
            {MODES.map((m) => {
              const active = config.mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  testID={`mode-chip-${m.key.toLowerCase()}`}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => switchMode(m.key)}
                >
                  <Text style={[styles.chipTitle, active && styles.chipTitleActive]}>
                    {m.title}
                  </Text>
                  <Text style={[styles.chipSubtitle, active && styles.chipSubtitleActive]}>
                    {m.subtitle}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ENTRY LENGTH */}
        <Text style={styles.sectionLabel}>ENTRY LENGTH</Text>
        <View style={styles.card}>
          <View style={styles.chipGrid}>
            {LENGTHS.map((l) => {
              const active = config.entryLength === l.key;
              return (
                <Pressable
                  key={l.key}
                  testID={`length-chip-${l.key}`}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => switchLength(l.key)}
                >
                  <Text style={[styles.chipTitle, active && styles.chipTitleActive]}>
                    {l.title}
                  </Text>
                  <Text style={[styles.chipSubtitle, active && styles.chipSubtitleActive]}>
                    {l.subtitle}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* MODE-SPECIFIC */}
        {config.mode === "BASIC" && (
          <>
            <Text style={styles.sectionLabel}>ATTEMPTS BEFORE UNLOCK</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Attempts</Text>
                  <Text style={styles.rowSubtitle}>
                    {config.attempts.map((a) => a.label).join(" → ")}
                  </Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    testID="attempts-minus"
                    style={styles.stepperButton}
                    onPress={() => setAttemptCount(-1)}
                    hitSlop={8}
                  >
                    <Text style={styles.stepperLabel}>−</Text>
                  </Pressable>
                  <Text testID="attempts-count" style={styles.stepperCount}>
                    {config.attempts.length}
                  </Text>
                  <Pressable
                    testID="attempts-plus"
                    style={styles.stepperButton}
                    onPress={() => setAttemptCount(1)}
                    hitSlop={8}
                  >
                    <Text style={styles.stepperLabel}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </>
        )}

        {config.mode === "TRANSFORM" && (
          <>
            <Text style={styles.sectionLabel}>POSITION OFFSETS</Text>
            <View style={styles.card}>
              <TextInput
                testID="offsets-input"
                style={styles.input}
                value={offsetsText}
                onChangeText={onChangeOffsets}
                placeholder="4,1,3,2"
                placeholderTextColor={styles.colors.muted}
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {!!offsetsError && (
                <Text testID="offsets-error" style={styles.errorText}>
                  {offsetsError}
                </Text>
              )}
              {!!offsetsPreview && (
                <Text testID="offsets-preview" style={styles.hintText}>
                  Preview: {config.entryLength === 4 ? "2749" : "274999"} → {offsetsPreview}
                </Text>
              )}
            </View>
          </>
        )}

        {(config.mode === "SCRAMBLE" || config.mode === "HYBRID") && (
          <>
            <Text style={styles.sectionLabel}>ROUTINE SCRIPT</Text>
            <View style={styles.card}>
              {config.script.map((step, i) => (
                <View key={i} style={styles.stepCard} testID={`script-step-${i}`}>
                  <View style={styles.stepHeader}>
                    <Text style={styles.stepNumber}>Step {i + 1}</Text>
                    <Pressable
                      testID={`script-remove-${i}`}
                      onPress={() => removeStep(i)}
                      hitSlop={10}
                    >
                      <Symbol name="trash" fallback="🗑" size={18} color={styles.colors.error} />
                    </Pressable>
                  </View>

                  {/* Kind chips */}
                  <View style={styles.kindRow}>
                    {STEP_KINDS.map((k) => {
                      const active = step.kind === k.key;
                      return (
                        <Pressable
                          key={k.key}
                          testID={`script-${i}-kind-${k.key}`}
                          style={[styles.kindChip, active && styles.kindChipActive]}
                          onPress={() => updateStep(i, { kind: k.key })}
                        >
                          <Text style={[styles.kindText, active && styles.kindTextActive]}>
                            {k.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Position + offset controls */}
                  <View style={styles.stepControls}>
                    {step.kind !== "filler" && (
                      <View style={styles.miniControl}>
                        <Text style={styles.miniLabel}>Position</Text>
                        <View style={styles.miniStepper}>
                          <Pressable
                            testID={`script-${i}-pos-minus`}
                            style={styles.miniButton}
                            onPress={() =>
                              updateStep(i, {
                                position: Math.max(1, step.position - 1),
                              })
                            }
                            hitSlop={6}
                          >
                            <Text style={styles.miniButtonLabel}>−</Text>
                          </Pressable>
                          <Text style={styles.miniValue}>{step.position}</Text>
                          <Pressable
                            testID={`script-${i}-pos-plus`}
                            style={styles.miniButton}
                            onPress={() =>
                              updateStep(i, {
                                position: Math.min(config.entryLength, step.position + 1),
                              })
                            }
                            hitSlop={6}
                          >
                            <Text style={styles.miniButtonLabel}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                    {step.kind === "transform" && (
                      <View style={styles.miniControl}>
                        <Text style={styles.miniLabel}>Offset +</Text>
                        <View style={styles.miniStepper}>
                          <Pressable
                            testID={`script-${i}-off-minus`}
                            style={styles.miniButton}
                            onPress={() => updateStep(i, { offset: Math.max(0, step.offset - 1) })}
                            hitSlop={6}
                          >
                            <Text style={styles.miniButtonLabel}>−</Text>
                          </Pressable>
                          <Text style={styles.miniValue}>{step.offset}</Text>
                          <Pressable
                            testID={`script-${i}-off-plus`}
                            style={styles.miniButton}
                            onPress={() => updateStep(i, { offset: Math.min(9, step.offset + 1) })}
                            hitSlop={6}
                          >
                            <Text style={styles.miniButtonLabel}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                    {step.kind === "filler" && (
                      <Text style={styles.fillerHint}>Ignored in reconstruction</Text>
                    )}
                  </View>
                </View>
              ))}

              <Pressable testID="script-add-step" style={styles.addStepButton} onPress={addStep}>
                <Symbol name="plus" fallback="+" size={16} color={styles.colors.brandPrimary} />
                <Text style={styles.addStepLabel}>Add step</Text>
              </Pressable>

              {coverage.ok ? (
                <Text testID="script-coverage-ok" style={styles.coverageOk}>
                  ✓ All {config.entryLength} positions mapped once — reconstruction is complete.
                </Text>
              ) : (
                <Text testID="script-coverage-warn" style={styles.coverageWarn}>
                  {coverage.missing.length > 0 &&
                    `Positions ${coverage.missing.join(", ")} not yet mapped. `}
                  {coverage.dupes.length > 0 && `Positions ${coverage.dupes.join(", ")} mapped twice. `}
                  The Peek will show • for unmapped slots.
                </Text>
              )}
            </View>
          </>
        )}

        {/* WALLPAPER */}
        <Text style={styles.sectionLabel}>HOME SCREEN WALLPAPER</Text>
        <View style={styles.card}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.wallpaperRow}
          >
            {WALLPAPER_PRESETS.map((preset) => {
              const active = config.wallpaper === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  testID={`wallpaper-${preset.id}`}
                  style={styles.wallpaperSlot}
                  onPress={() => {
                    setWallpaperError("");
                    setConfig({ ...config, wallpaper: preset.id });
                  }}
                >
                  <Image
                    source={preset.source}
                    style={[styles.wallpaperThumb, active && styles.wallpaperThumbActive]}
                    contentFit="cover"
                  />
                  <Text
                    style={[styles.wallpaperName, active && styles.wallpaperNameActive]}
                  >
                    {preset.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              testID="wallpaper-custom"
              style={styles.wallpaperSlot}
              onPress={pickWallpaperPhoto}
            >
              {isCustomWallpaper(config.wallpaper) ? (
                <Image
                  source={{ uri: config.wallpaper }}
                  style={[styles.wallpaperThumb, styles.wallpaperThumbActive]}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.wallpaperThumb, styles.wallpaperCustom]}>
                  <Symbol name="plus" fallback="+" size={24} color={styles.colors.muted} />
                </View>
              )}
              <Text
                style={[
                  styles.wallpaperName,
                  isCustomWallpaper(config.wallpaper) && styles.wallpaperNameActive,
                ]}
              >
                Your Photo
              </Text>
            </Pressable>
          </ScrollView>
          {!!wallpaperError && (
            <View>
              <Text testID="wallpaper-error" style={styles.errorText}>
                {wallpaperError}
              </Text>
              <Pressable
                testID="wallpaper-open-settings"
                onPress={() => Linking.openSettings()}
                hitSlop={8}
              >
                <Text style={styles.settingsLink}>Open Settings</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* FEEDBACK */}
        <Text style={styles.sectionLabel}>FEEDBACK</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Haptics</Text>
            <Switch
              testID="toggle-haptics"
              value={config.haptics}
              onValueChange={(v) => setConfig({ ...config, haptics: v })}
              trackColor={{
                false: styles.colors.surfaceTertiary,
                true: styles.colors.brandPrimary,
              }}
              thumbColor={styles.colors.onSurface}
            />
          </View>
          <View style={[styles.row, styles.scriptRowBorder]}>
            <Text style={styles.rowTitle}>Key sounds</Text>
            <Switch
              testID="toggle-sounds"
              value={config.sounds}
              onValueChange={(v) => setConfig({ ...config, sounds: v })}
              trackColor={{
                false: styles.colors.surfaceTertiary,
                true: styles.colors.brandPrimary,
              }}
              thumbColor={styles.colors.onSurface}
            />
          </View>
        </View>

        <Pressable testID="start-performance-button" style={styles.startButton} onPress={start}>
          <Text style={styles.startLabel}>Start Performance</Text>
        </Pressable>

        <Text style={styles.footnote}>
          During a performance: long-press “Emergency” to return here. After the unlock,
          long-press the screen for 2 seconds to open Peek.
        </Text>

        <Pressable testID="setup-signout-button" style={styles.signOut} onPress={logout}>
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  colors,
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.muted,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  chip: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceTertiary,
  },
  chipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  chipTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
  },
  chipTitleActive: {
    color: colors.onBrandPrimary,
  },
  chipSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  chipSubtitleActive: {
    color: colors.onBrandPrimary,
    opacity: 0.75,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    color: colors.onSurfaceSecondary,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperLabel: {
    fontSize: 22,
    color: colors.onSurfaceSecondary,
    lineHeight: 26,
  },
  stepperCount: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.brandPrimary,
    minWidth: 20,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: colors.onSurfaceSecondary,
    fontVariant: ["tabular-nums"],
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 8,
  },
  hintText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 10,
  },
  scriptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  scriptRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepCard: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  stepNumber: { fontSize: 13, fontWeight: "700", color: colors.muted, letterSpacing: 0.5 },
  kindRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexShrink: 0,
  },
  kindChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  kindText: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceSecondary },
  kindTextActive: { color: colors.onBrandPrimary },
  stepControls: { flexDirection: "row", gap: 20, marginTop: 12, alignItems: "center" },
  miniControl: { gap: 6 },
  miniLabel: { fontSize: 11, color: colors.muted },
  miniStepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  miniButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  miniButtonLabel: { fontSize: 18, color: colors.onSurfaceSecondary, lineHeight: 20 },
  miniValue: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.brandPrimary,
    minWidth: 18,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  fillerHint: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  addStepButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.brandTertiary,
    marginTop: 2,
  },
  addStepLabel: { fontSize: 14, fontWeight: "600", color: colors.brandPrimary },
  coverageOk: { fontSize: 12, color: colors.success, marginTop: 12, lineHeight: 18 },
  coverageWarn: { fontSize: 12, color: colors.warning, marginTop: 12, lineHeight: 18 },
  scriptStep: {
    fontSize: 14,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
  },
  scriptDetail: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.onSurfaceSecondary,
  },
  wallpaperRow: {
    gap: 12,
    paddingVertical: 2,
  },
  wallpaperSlot: {
    alignItems: "center",
    width: 64,
  },
  wallpaperThumb: {
    width: 56,
    height: 84,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  wallpaperThumbActive: {
    borderColor: colors.brandPrimary,
  },
  wallpaperCustom: {
    backgroundColor: colors.surfaceTertiary,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  wallpaperName: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },
  wallpaperNameActive: {
    color: colors.brandPrimary,
  },
  settingsLink: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brandPrimary,
    marginTop: 6,
  },
  startButton: {
    marginTop: 28,
    backgroundColor: colors.brandPrimary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  startLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.onBrandPrimary,
  },
  footnote: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
  signOut: { alignItems: "center", paddingVertical: 16, marginTop: 4 },
  signOutLabel: { fontSize: 14, color: colors.muted, textDecorationLine: "underline" },
}));
