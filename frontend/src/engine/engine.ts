// PINKEY performance engine — pure, offline, deterministic.
// No React Native imports, no storage, no network. 100% mock values only.

import type {
  EngineEffect,
  EntryLength,
  EventType,
  PerformanceConfig,
  PerformanceEvent,
  PeekData,
  PeekRow,
  Session,
} from "./types";

let counter = 0;
const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36)}${Math.floor(
    Math.random() * 1296,
  ).toString(36)}`;

// Mod-10 single-digit arithmetic (wraps both directions).
export const mod10 = (n: number) => ((n % 10) + 10) % 10;

export function createSession(config: PerformanceConfig): Session {
  return {
    id: uid("sess"),
    config,
    status: "LOCKED",
    stepIndex: 0,
    buffer: "",
    visibleCount: 0,
    visibleEntry: "",
    events: [],
    complete: false,
    reconstructed: null,
    lastEffect: "none",
  };
}

export function resetSession(session: Session): Session {
  return createSession(session.config);
}

// Forward: apply per-position offsets (visible = original + offset, mod 10).
export function transformValue(original: string, offsets: number[]): string {
  return original
    .split("")
    .map((c, i) => String(mod10(Number(c) + (offsets[i % offsets.length] ?? 0))))
    .join("");
}

// Reverse: original = visible - offset, mod 10.
export function reverseTransformValue(visible: string, offsets: number[]): string {
  return visible
    .split("")
    .map((c, i) => String(mod10(Number(c) - (offsets[i % offsets.length] ?? 0))))
    .join("");
}

function appendEvent(
  events: PerformanceEvent[],
  partial: Omit<PerformanceEvent, "id" | "seq" | "timestamp">,
): PerformanceEvent[] {
  return [
    ...events,
    { ...partial, id: uid("ev"), seq: events.length + 1, timestamp: Date.now() },
  ];
}

export function inputDigit(session: Session, digit: number): Session {
  if (session.status === "UNLOCKED" || session.complete) return session;
  const d = Math.floor(digit);
  if (Number.isNaN(d) || d < 0 || d > 9) return session;
  const base: Session = { ...session, lastEffect: "none" };
  switch (session.config.mode) {
    case "BASIC":
      return basicInput(base, d);
    case "TRANSFORM":
      return transformInput(base, d);
    default:
      return scriptedInput(base, d);
  }
}

export function backspace(session: Session): Session {
  if (session.status === "UNLOCKED" || session.complete) return session;
  if (session.config.mode === "BASIC" || session.config.mode === "TRANSFORM") {
    if (session.buffer.length === 0) return session;
    const removed = session.buffer.slice(-1);
    const events = appendEvent(session.events, {
      type: "BACKSPACE",
      value: removed,
      targetPosition: null,
      offset: null,
      deleted: true,
      includedInReconstruction: false,
      stepLabel: "correction",
    });
    return {
      ...session,
      buffer: session.buffer.slice(0, -1),
      visibleCount: session.buffer.length - 1,
      events,
      lastEffect: "none",
    };
  }
  // Scripted modes are routine-driven; spectator backspace is not part of the script.
  return session;
}

// ---------------------------------------------------------------------------
// BASIC — configurable sequence of attempts; final attempt unlocks.
// ---------------------------------------------------------------------------
function basicInput(session: Session, digit: number): Session {
  const { attempts, entryLength } = session.config;
  if (session.buffer.length >= entryLength) return session;
  const attempt = attempts[Math.min(session.stepIndex, attempts.length - 1)];
  const buffer = session.buffer + String(digit);
  const next: Session = { ...session, buffer, visibleCount: buffer.length };
  if (buffer.length < entryLength) return next;

  const events = appendEvent(next.events, {
    type: "INPUT",
    value: buffer,
    targetPosition: null,
    offset: null,
    deleted: false,
    includedInReconstruction: attempt.capture,
    stepLabel: attempt.label,
  });
  const isLast = session.stepIndex >= attempts.length - 1;
  const shouldUnlock = attempt.unlock || isLast;
  if (shouldUnlock) {
    return {
      ...next,
      events,
      buffer: "",
      visibleCount: 0,
      visibleEntry: buffer,
      status: "UNLOCKED",
      complete: true,
      reconstructed: buffer,
      lastEffect: "unlock",
    };
  }
  return {
    ...next,
    events,
    buffer: "",
    visibleCount: 0,
    stepIndex: session.stepIndex + 1,
    lastEffect: "attempt-failed",
  };
}

// ---------------------------------------------------------------------------
// TRANSFORM — spectator enters the visible transformed value; the engine
// records one TRANSFORM event per position and reverses offsets to reconstruct.
// ---------------------------------------------------------------------------
function transformInput(session: Session, digit: number): Session {
  const { entryLength, offsets } = session.config;
  if (session.buffer.length >= entryLength) return session;
  const buffer = session.buffer + String(digit);
  let next: Session = { ...session, buffer, visibleCount: buffer.length };
  if (buffer.length < entryLength) return next;

  let events = next.events;
  buffer.split("").forEach((c, i) => {
    events = appendEvent(events, {
      type: "TRANSFORM",
      value: c,
      targetPosition: i + 1,
      offset: offsets[i % offsets.length] ?? 0,
      deleted: false,
      includedInReconstruction: true,
      stepLabel: `pos-${i + 1}`,
    });
  });
  return {
    ...next,
    events,
    buffer: "",
    visibleCount: 0,
    visibleEntry: buffer,
    status: "UNLOCKED",
    complete: true,
    reconstructed: reverseTransformValue(buffer, offsets),
    lastEffect: "unlock",
  };
}

// ---------------------------------------------------------------------------
// SCRAMBLE / HYBRID — scripted, non-linear positions with delete/filler/
// transform events processed chronologically.
// ---------------------------------------------------------------------------
function scriptedInput(session: Session, digit: number): Session {
  const step = session.config.script[session.stepIndex];
  if (!step) return session;
  const d = String(digit);
  let events = session.events;
  let visibleCount = session.visibleCount;
  let effect: EngineEffect = "none";

  if (step.kind === "direct") {
    events = appendEvent(events, {
      type: "INPUT",
      value: d,
      targetPosition: step.position,
      offset: null,
      deleted: false,
      includedInReconstruction: true,
      stepLabel: `pos-${step.position}`,
    });
    visibleCount += 1;
  } else if (step.kind === "transform") {
    events = appendEvent(events, {
      type: "TRANSFORM",
      value: d,
      targetPosition: step.position,
      offset: step.offset,
      deleted: false,
      includedInReconstruction: true,
      stepLabel: `pos-${step.position}`,
    });
    visibleCount += 1;
  } else if (step.kind === "delete") {
    // Digit flashes on screen then vanishes — but is RETAINED in session
    // history and still contributes its captured value to reconstruction.
    events = appendEvent(events, {
      type: "DELETE",
      value: d,
      targetPosition: step.position,
      offset: null,
      deleted: true,
      includedInReconstruction: true,
      stepLabel: `pos-${step.position}`,
    });
    effect = "flash-delete";
  } else {
    // FILLER — throwaway digit, excluded from reconstruction.
    events = appendEvent(events, {
      type: "FILLER",
      value: d,
      targetPosition: null,
      offset: null,
      deleted: false,
      includedInReconstruction: false,
      stepLabel: "filler",
    });
    effect = "flash-filler";
  }

  const stepIndex = session.stepIndex + 1;
  const done = stepIndex >= session.config.script.length;
  return {
    ...session,
    events,
    visibleCount,
    stepIndex,
    status: done ? "UNLOCKED" : "LOCKED",
    complete: done,
    reconstructed: done
      ? reconstructScripted(events, session.config.entryLength)
      : session.reconstructed,
    lastEffect: done ? "unlock" : effect,
  };
}

function reconstructScripted(events: PerformanceEvent[], entryLength: EntryLength): string {
  const positions: (string | null)[] = Array(entryLength).fill(null);
  for (const e of events) {
    if (!e.includedInReconstruction || e.targetPosition == null) continue;
    const d = Number(e.value);
    positions[e.targetPosition - 1] = String(
      e.type === "TRANSFORM" ? mod10(d - (e.offset ?? 0)) : d,
    );
  }
  return positions.map((p) => p ?? "•").join("");
}

// ---------------------------------------------------------------------------
// Peek
// ---------------------------------------------------------------------------
export function formatMockDate(value: string, entryLength: EntryLength): string {
  if (!/^\d+$/.test(value)) return "—";
  if (entryLength === 4 && value.length === 4) return `${value.slice(0, 2)}/${value.slice(2)}`;
  if (entryLength === 6 && value.length === 6)
    return `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
  return "—";
}

const ATTEMPT_LABELS: Record<string, string> = {
  code: "Mock code",
  date: "Mock date entry",
  associated: "Associated number",
  key: "Performance key",
};

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function getPeek(session: Session): PeekData {
  const { config } = session;
  const reconstructed = session.reconstructed ?? "";
  const mockDateValue = formatMockDate(reconstructed, config.entryLength);
  let associatedNumber = "—";
  const rows: PeekRow[] = [];

  if (config.mode === "BASIC") {
    for (const e of session.events) {
      if (e.type !== "INPUT" || !e.includedInReconstruction) continue;
      rows.push({
        label: ATTEMPT_LABELS[e.stepLabel ?? ""] ?? `Step ${e.stepLabel}`,
        value: e.value,
        eventId: e.id,
        kind: e.type,
      });
    }
    associatedNumber =
      session.events.find((e) => e.stepLabel === "associated")?.value ?? "—";
  } else if (config.mode === "TRANSFORM") {
    const visible = session.visibleEntry;
    associatedNumber = visible || "—";
    rows.push({
      label: "Visible entry",
      value: visible,
      eventId: `visible_${session.events[0]?.id ?? "none"}`,
      kind: "TRANSFORM",
    });
    for (const e of session.events) {
      if (e.type !== "TRANSFORM") continue;
      rows.push({
        label: `Position ${e.targetPosition} (offset ${signed(e.offset ?? 0)})`,
        value: `${e.value} → ${mod10(Number(e.value) - (e.offset ?? 0))}`,
        eventId: e.id,
        kind: e.type,
      });
    }
  } else {
    const deleted = session.events
      .filter((e) => e.type === "DELETE")
      .map((e) => e.value)
      .join("");
    const filler = session.events
      .filter((e) => e.type === "FILLER")
      .map((e) => e.value)
      .join("");
    associatedNumber =
      [deleted && `deleted ${deleted}`, filler && `filler ${filler}`]
        .filter(Boolean)
        .join("  ·  ") || "—";
    for (const e of session.events) {
      if (e.includedInReconstruction && e.targetPosition != null) {
        const rec =
          e.type === "TRANSFORM" ? mod10(Number(e.value) - (e.offset ?? 0)) : Number(e.value);
        rows.push({
          label: `Position ${e.targetPosition}${
            e.type === "DELETE" ? " (deleted)" : ""
          }${e.type === "TRANSFORM" ? ` (offset ${signed(e.offset ?? 0)})` : ""}`,
          value: String(rec),
          eventId: e.id,
          kind: e.type,
        });
      } else if (e.type === "FILLER") {
        rows.push({ label: "Filler (excluded)", value: e.value, eventId: e.id, kind: e.type });
      }
    }
  }

  return {
    sessionId: session.id,
    mode: config.mode,
    entryLength: config.entryLength,
    reconstructedValue: reconstructed,
    mockDateValue,
    associatedNumber,
    rows,
  };
}
