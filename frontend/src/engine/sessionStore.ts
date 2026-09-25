// Holds the ACTIVE performance session in memory only (never persisted —
// per the brief, session state is temporary and wiped on reset).
// Only the performer CONFIG is persisted locally (no performance data).

import { storage } from "@/src/utils/storage";

import { buildDefaultConfig } from "./defaults";
import type { PerformanceConfig, Session } from "./types";

const CONFIG_KEY = "pinkey.config";

let currentSession: Session | null = null;

export function setCurrentSession(session: Session | null) {
  currentSession = session;
}

export function getCurrentSession(): Session | null {
  return currentSession;
}

export async function loadConfig(): Promise<PerformanceConfig> {
  const raw = await storage.getItem(CONFIG_KEY, "");
  if (!raw) return buildDefaultConfig("BASIC", 4);
  try {
    const parsed = JSON.parse(raw) as PerformanceConfig;
    if (!parsed || !parsed.mode || !parsed.entryLength) return buildDefaultConfig("BASIC", 4);
    // Merge over defaults so configs saved by older app versions gain new fields.
    return { ...buildDefaultConfig(parsed.mode, parsed.entryLength), ...parsed };
  } catch {
    return buildDefaultConfig("BASIC", 4);
  }
}

export async function saveConfig(config: PerformanceConfig): Promise<void> {
  await storage.setItem(CONFIG_KEY, JSON.stringify(config));
}
