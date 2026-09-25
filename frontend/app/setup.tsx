// Performer Setup — premium command center (performer-only).
// Configure mode, entry length, attempts, offsets, wallpaper, and feedback.

import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Symbol } from "@/src/components/Symbol";
import { Accordion, AccordionItem } from "@/src/components/ui/Accordion";
import { Button, IconButton } from "@/src/components/ui/Button";
import { Chip, PillChip } from "@/src/components/ui/Chip";
import { Input } from "@/src/components/ui/Input";
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { Stepper } from "@/src/components/ui/Stepper";
import { Toggle } from "@/src/components/ui/Toggle";
import { WallpaperPicker } from "@/src/components/ui/WallpaperPicker";
import { useAuth } from "@/src/auth/AuthContext";
import { WALLPAPER_PRESETS } from "@/src/components/wallpapers";
import {
  MAX_CUSTOM_WALLPAPERS,
  loadCustomWallpapers,
  saveCustomWallpapers,
} from "@/src/engine/customWallpapers";
import { buildAttempts, buildDefaultConfig } from "@/src/engine/defaults";
import { createSession, transformValue } from "@/src/engine/engine";
import { loadConfig, saveConfig, setCurrentSession } from "@/src/engine/sessionStore";
import type { EntryLength, Mode, PerformanceConfig, ScriptStep, StepKind } from "@/src/engine/types";
import { ThemeScheme, useTheme } from "@/src/theme";

const MODE_ORDER: Mode[] = ["BASIC", "TRANSFORM", "SCRAMBLE", "HYBRID"];

const MODE_TITLES: Record<Mode, string> = {
  BASIC: "Basic",
  TRANSFORM: "Transform",
  SCRAMBLE: "Scramble Peek",
  HYBRID: "Hybrid",
};

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  BASIC:
    "A pre-planned sequence of attempts. Each attempt quietly captures one piece of information — their PIN, a birth date, a phone number — and you choose which attempt finally unlocks the phone. Once it starts, you never touch the screen; you just speak each instruction in order.",
  TRANSFORM:
    "The spectator never says their real PIN out loud. They add a preset offset to each digit and enter the result instead, creating the illusion you're altering their code with mental math. The moment it unlocks, PinKey reverses the math to reconstruct the original PIN.",
  SCRAMBLE:
    "Breaks the natural left-to-right order. Jump between digit positions, plant a deliberate delete as misdirection, and drop in meaningless filler digits — PinKey tracks every real entry regardless of order and reconstructs the full PIN.",
  HYBRID:
    "Combines every technique in one continuous routine — direct entries, offset math, decoy deletions, and fillers — for a single multi-layered reveal that uses all of it at once.",
};

const MODE_ICONS: Record<Mode, string> = {
  BASIC: "list.number",
  TRANSFORM: "arrow.left.arrow.right",
  SCRAMBLE: "shuffle",
  HYBRID: "square.stack.3d.up.fill",
};

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
  return (
    <ThemeScheme scheme="light">
      <StatusBar style="dark" />
      <SetupScreenInner />
    </ThemeScheme>
  );
}

function SetupScreenInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();

  const [config, setConfig] = useState<PerformanceConfig | null>(null);
  const [offsetsText, setOffsetsText] = useState("");
  const [offsetsError, setOffsetsError] = useState("");
  const [wallpaperError, setWallpaperError] = useState("");
  const [customWallpapers, setCustomWallpapers] = useState<string[]>([]);

  useEffect(() => {
    loadConfig().then((loaded) => {
      setConfig(loaded);
      setOffsetsText(loaded.offsets.join(","));
    });
    loadCustomWallpapers().then(setCustomWallpapers);
  }, []);

  if (!config) {
    return <View testID="setup-screen" style={{ flex: 1, backgroundColor: colors.surface }} />;
  }

  const switchMode = (mode: Mode) => {
    const fresh = buildDefaultConfig(mode, config.entryLength);
    setConfig({
      ...fresh,
      haptics: config.haptics,
      sounds: config.sounds,
      wallpaper: config.wallpaper,
      lockWallpaper: config.lockWallpaper,
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
      lockWallpaper: config.lockWallpaper,
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

  const pickWallpaperPhoto = async (target: "wallpaper" | "lockWallpaper") => {
    setWallpaperError("");
    if (customWallpapers.length >= MAX_CUSTOM_WALLPAPERS) {
      setWallpaperError(`You can add up to ${MAX_CUSTOM_WALLPAPERS} photos. Delete one to add another.`);
      return;
    }
    // Contextual permission flow: check → ask once (clear intent: performer
    // tapped "Add Photo") → if blocked, offer Settings.
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
      const uri = result.assets[0].uri;
      const next = [...customWallpapers, uri];
      setCustomWallpapers(next);
      await saveCustomWallpapers(next);
      setConfig({ ...config, [target]: uri });
    }
  };

  const deleteCustomWallpaper = async (uri: string) => {
    const next = customWallpapers.filter((w) => w !== uri);
    setCustomWallpapers(next);
    await saveCustomWallpapers(next);
    setConfig({
      ...config,
      wallpaper: config.wallpaper === uri ? WALLPAPER_PRESETS[0].id : config.wallpaper,
      lockWallpaper: config.lockWallpaper === uri ? WALLPAPER_PRESETS[0].id : config.lockWallpaper,
    });
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

  const scriptEditor = (
    <View>
      {config.script.map((step, i) => (
        <View
          key={i}
          testID={`script-step-${i}`}
          style={{
            backgroundColor: colors.surfaceTertiary,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted, letterSpacing: 0.5 }}>
              Step {i + 1}
            </Text>
            <IconButton testID={`script-remove-${i}`} onPress={() => removeStep(i)}>
              <Symbol name="trash" fallback="🗑" size={18} color={colors.error} />
            </IconButton>
          </View>

          {/* Kind chips */}
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {STEP_KINDS.map((k) => (
              <PillChip
                key={k.key}
                testID={`script-${i}-kind-${k.key}`}
                label={k.label}
                active={step.kind === k.key}
                onPress={() => updateStep(i, { kind: k.key })}
              />
            ))}
          </View>

          {/* Position + offset controls */}
          <View style={{ flexDirection: "row", gap: 20, marginTop: 12, alignItems: "center" }}>
            {step.kind !== "filler" && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, color: colors.muted }}>Position</Text>
                <Stepper
                  testIDBase={`script-${i}-pos`}
                  size="sm"
                  value={step.position}
                  onDecrement={() => updateStep(i, { position: Math.max(1, step.position - 1) })}
                  onIncrement={() =>
                    updateStep(i, { position: Math.min(config.entryLength, step.position + 1) })
                  }
                />
              </View>
            )}
            {step.kind === "transform" && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, color: colors.muted }}>Offset +</Text>
                <Stepper
                  testIDBase={`script-${i}-off`}
                  size="sm"
                  value={step.offset}
                  onDecrement={() => updateStep(i, { offset: Math.max(0, step.offset - 1) })}
                  onIncrement={() => updateStep(i, { offset: Math.min(9, step.offset + 1) })}
                />
              </View>
            )}
            {step.kind === "filler" && (
              <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>
                Ignored in reconstruction
              </Text>
            )}
          </View>
        </View>
      ))}

      <Pressable
        testID="script-add-step"
        onPress={addStep}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: colors.brandTertiary,
        }}
      >
        <Symbol name="plus" fallback="+" size={16} color={colors.brandPrimary} />
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.brandPrimary }}>Add step</Text>
      </Pressable>

      {coverage.ok ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 12 }}>
          <Symbol name="checkmark.circle.fill" fallback="✓" size={14} color={colors.success} />
          <Text testID="script-coverage-ok" style={{ flex: 1, fontSize: 12, color: colors.success, lineHeight: 18 }}>
            All {config.entryLength} positions mapped once — reconstruction is complete.
          </Text>
        </View>
      ) : (
        <Text testID="script-coverage-warn" style={{ fontSize: 12, color: colors.warning, marginTop: 12, lineHeight: 18 }}>
          {coverage.missing.length > 0 && `Positions ${coverage.missing.join(", ")} not yet mapped. `}
          {coverage.dupes.length > 0 && `Positions ${coverage.dupes.join(", ")} mapped twice. `}
          The Peek will show a dot for unmapped slots.
        </Text>
      )}
    </View>
  );

  return (
    <View testID="setup-screen" style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <ScreenHeader
        title="Performer Setup"
        right={
          <IconButton testID="setup-close-button" onPress={() => router.back()}>
            <Symbol name="xmark.circle.fill" fallback="✕" size={24} color={colors.muted} />
          </IconButton>
        }
      />

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Accordion>
          {MODE_ORDER.map((m) => {
            const active = config.mode === m;
            return (
              <AccordionItem
                key={m}
                testID={`accordion-mode-${m.toLowerCase()}`}
                title={MODE_TITLES[m]}
                description={MODE_DESCRIPTIONS[m]}
                active={active}
                icon={
                  <Symbol
                    name={MODE_ICONS[m]}
                    fallback=""
                    size={18}
                    color={active ? colors.brandPrimary : colors.muted}
                  />
                }
              >
                {!active ? (
                  <Button
                    testID={`select-mode-${m.toLowerCase()}`}
                    label="Use This Mode"
                    variant="secondary"
                    onPress={() => switchMode(m)}
                  />
                ) : m === "BASIC" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontSize: 16, color: colors.onSurfaceSecondary }}>Attempts</Text>
                      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                        {config.attempts.map((a) => a.label).join(" → ")}
                      </Text>
                    </View>
                    <Stepper
                      testIDBase="attempts"
                      value={config.attempts.length}
                      onDecrement={() => setAttemptCount(-1)}
                      onIncrement={() => setAttemptCount(1)}
                    />
                  </View>
                ) : m === "TRANSFORM" ? (
                  <View>
                    <Input
                      testID="offsets-input"
                      value={offsetsText}
                      onChangeText={onChangeOffsets}
                      placeholder="4,1,3,2"
                      keyboardType="numbers-and-punctuation"
                      autoCorrect={false}
                      autoCapitalize="none"
                      style={{ fontSize: 17, fontVariant: ["tabular-nums"] }}
                      error={offsetsError || undefined}
                    />
                    {!!offsetsPreview && !offsetsError && (
                      <Text testID="offsets-preview" style={{ fontSize: 12, color: colors.muted, marginTop: 10 }}>
                        Preview: {config.entryLength === 4 ? "2749" : "274999"} → {offsetsPreview}
                      </Text>
                    )}
                  </View>
                ) : (
                  scriptEditor
                )}
              </AccordionItem>
            );
          })}

          <AccordionItem
            testID="accordion-length"
            title="Entry Length"
            description="How many digits the spectator enters — a 4-digit PIN or a 6-digit birth date."
            icon={<Symbol name="number" fallback="#" size={18} color={colors.brandPrimary} />}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {LENGTHS.map((l) => (
                <Chip
                  key={l.key}
                  testID={`length-chip-${l.key}`}
                  title={l.title}
                  subtitle={l.subtitle}
                  active={config.entryLength === l.key}
                  onPress={() => switchLength(l.key)}
                />
              ))}
            </View>
          </AccordionItem>

          <AccordionItem
            testID="accordion-lock-wallpaper"
            title="Lock Screen Wallpaper"
            description="What the spectator sees behind the passcode screen — same photo gallery as the home screen, picked independently."
            icon={<Symbol name="lock.slash" fallback="" size={18} color={colors.brandPrimary} />}
          >
            <WallpaperPicker
              testIDPrefix="lock-wallpaper"
              value={config.lockWallpaper}
              onChange={(v) => {
                setWallpaperError("");
                setConfig({ ...config, lockWallpaper: v });
              }}
              customWallpapers={customWallpapers}
              onAddPhoto={() => pickWallpaperPhoto("lockWallpaper")}
              onDeletePhoto={deleteCustomWallpaper}
              error={wallpaperError}
            />
          </AccordionItem>

          <AccordionItem
            testID="accordion-wallpaper"
            title="Home Screen Wallpaper"
            description="What appears right after it 'unlocks'. Upload a screenshot of your own real home screen for a perfect match — real photos show full-screen with no simulated icons. Presets fall back to a simulated icon grid."
            icon={<Symbol name="photo" fallback="" size={18} color={colors.brandPrimary} />}
          >
            <WallpaperPicker
              testIDPrefix="wallpaper"
              value={config.wallpaper}
              onChange={(v) => {
                setWallpaperError("");
                setConfig({ ...config, wallpaper: v });
              }}
              customWallpapers={customWallpapers}
              onAddPhoto={() => pickWallpaperPhoto("wallpaper")}
              onDeletePhoto={deleteCustomWallpaper}
              error={wallpaperError}
            />
          </AccordionItem>

          <AccordionItem
            testID="accordion-feedback"
            title="Feedback"
            description="Turn key taps and haptic buzzes on or off during the performance."
            last
            icon={<Symbol name="hand.tap" fallback="〰" size={18} color={colors.brandPrimary} />}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
              <Text style={{ fontSize: 16, color: colors.onSurfaceSecondary }}>Haptics</Text>
              <Toggle testID="toggle-haptics" value={config.haptics} onValueChange={(v) => setConfig({ ...config, haptics: v })} />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 4,
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 16, color: colors.onSurfaceSecondary }}>Key sounds</Text>
              <Toggle testID="toggle-sounds" value={config.sounds} onValueChange={(v) => setConfig({ ...config, sounds: v })} />
            </View>
          </AccordionItem>
        </Accordion>

        <View style={{ marginTop: 24 }}>
          <Button testID="start-performance-button" label="Start Performance" size="lg" onPress={start} />
        </View>

        <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 16, lineHeight: 18 }}>
          During a performance: long-press “Emergency” to return here. After the unlock,
          long-press the screen for 2 seconds to open Peek.
        </Text>

        <Button
          testID="setup-signout-button"
          variant="ghost"
          label="Sign out"
          onPress={logout}
          fullWidth={false}
          size="sm"
          style={{ alignSelf: "center", marginTop: 4 }}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}
