// Default routines per the PINKEY build brief's reference flows.
import type { AttemptConfig, EntryLength, Mode, PerformanceConfig, ScriptStep } from "./types";

const BASIC_LABELS = ["code", "date", "associated"];

export function buildAttempts(count: number): AttemptConfig[] {
  const attempts: AttemptConfig[] = [];
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const label = isLast ? "key" : BASIC_LABELS[i] ?? `step${i + 1}`;
    attempts.push({ label, capture: true, unlock: isLast });
  }
  return attempts;
}

function defaultOffsets(entryLength: EntryLength): number[] {
  // Brief reference: +4,+1,+3,+2 turns 2749 into 6871 (mod-10 per position).
  return entryLength === 4 ? [4, 1, 3, 2] : [4, 1, 3, 2, 5, 1];
}

function defaultScript(mode: Mode, entryLength: EntryLength): ScriptStep[] {
  if (mode === "SCRAMBLE") {
    // Brief reference: pos2 direct, pos4 delete, pos3 direct, filler,
    // pos1 transform (offset 2) → reconstructs 2749 for the example digits.
    return entryLength === 4
      ? [
          { position: 2, kind: "direct", offset: 0 },
          { position: 4, kind: "delete", offset: 0 },
          { position: 3, kind: "direct", offset: 0 },
          { position: 0, kind: "filler", offset: 0 },
          { position: 1, kind: "transform", offset: 2 },
        ]
      : [
          { position: 2, kind: "direct", offset: 0 },
          { position: 5, kind: "direct", offset: 0 },
          { position: 4, kind: "delete", offset: 0 },
          { position: 0, kind: "filler", offset: 0 },
          { position: 3, kind: "direct", offset: 0 },
          { position: 6, kind: "direct", offset: 0 },
          { position: 1, kind: "transform", offset: 2 },
        ];
  }
  // HYBRID — chronological mix of direct + delete + transform (brief example).
  return entryLength === 4
    ? [
        { position: 2, kind: "direct", offset: 0 },
        { position: 4, kind: "delete", offset: 0 },
        { position: 3, kind: "direct", offset: 0 },
        { position: 1, kind: "transform", offset: 2 },
      ]
    : [
        { position: 3, kind: "direct", offset: 0 },
        { position: 6, kind: "delete", offset: 0 },
        { position: 2, kind: "direct", offset: 0 },
        { position: 0, kind: "filler", offset: 0 },
        { position: 5, kind: "direct", offset: 0 },
        { position: 4, kind: "direct", offset: 0 },
        { position: 1, kind: "transform", offset: 2 },
      ];
}

export function buildDefaultConfig(mode: Mode, entryLength: EntryLength): PerformanceConfig {
  return {
    entryLength,
    mode,
    attempts: buildAttempts(4),
    offsets: defaultOffsets(entryLength),
    script: defaultScript(mode, entryLength),
    haptics: true,
    sounds: true,
    wallpaper: "midnight",
    lockWallpaper: "midnight",
  };
}

export const DEFAULT_CONFIG: PerformanceConfig = buildDefaultConfig("BASIC", 4);
