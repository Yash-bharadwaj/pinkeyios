// PINKEY performance engine — types.
// All values flowing through this engine are fictional "performance values".
// The engine NEVER touches real OS credentials, accounts, or private data.

export type Mode = "BASIC" | "TRANSFORM" | "SCRAMBLE" | "HYBRID";
export type EntryLength = 4 | 6;

export type EventType = "INPUT" | "DELETE" | "FILLER" | "TRANSFORM" | "BACKSPACE";
export type StepKind = "direct" | "delete" | "filler" | "transform";
export type SessionStatus = "LOCKED" | "UNLOCKED";

// Side-effect hints returned with state so the UI can animate/react.
export type EngineEffect =
  | "none"
  | "attempt-failed" // BASIC: intermediate attempt captured, stay locked
  | "flash-delete"   // scripted: digit appeared then vanished (retained internally)
  | "flash-filler"   // scripted: throwaway digit (excluded from reconstruction)
  | "unlock";        // simulated unlock transition

export interface AttemptConfig {
  label: string;    // e.g. "code" | "date" | "associated" | "key"
  capture: boolean; // record this attempt's value
  unlock: boolean;  // completing this attempt triggers simulated unlock
}

export interface ScriptStep {
  position: number; // 1-based target position; 0 = filler (no position)
  kind: StepKind;
  offset: number;   // used when kind === "transform"
}

export interface PerformanceConfig {
  entryLength: EntryLength;
  mode: Mode;
  attempts: AttemptConfig[]; // BASIC
  offsets: number[];         // TRANSFORM (one per position)
  script: ScriptStep[];      // SCRAMBLE | HYBRID
  haptics: boolean;
  sounds: boolean;
  wallpaper: string; // home screen wallpaper — preset id ("midnight"…) or a local image URI
  lockWallpaper: string; // lock screen wallpaper — same value space as `wallpaper`
}

export interface PerformanceEvent {
  id: string;
  seq: number;                  // chronological order, 1-based
  type: EventType;
  value: string;                // digit(s) entered for this event (mock value)
  targetPosition: number | null;
  offset: number | null;
  deleted: boolean;             // deleted from the visible entry
  includedInReconstruction: boolean;
  stepLabel: string | null;     // BASIC attempt label / scripted position label
  timestamp: number;
}

export interface Session {
  id: string;
  config: PerformanceConfig;
  status: SessionStatus;
  stepIndex: number;
  buffer: string;        // current visible entry (BASIC / TRANSFORM)
  visibleCount: number;  // number of passcode dots currently shown
  visibleEntry: string;  // last committed full visible entry (e.g. transformed value)
  events: PerformanceEvent[];
  complete: boolean;
  reconstructed: string | null;
  lastEffect: EngineEffect;
}

export interface PeekRow {
  label: string;
  value: string;
  eventId: string;
  kind: EventType;
}

export interface PeekData {
  sessionId: string;
  mode: Mode;
  entryLength: EntryLength;
  reconstructedValue: string;
  mockDateValue: string;
  associatedNumber: string;
  rows: PeekRow[];
}
