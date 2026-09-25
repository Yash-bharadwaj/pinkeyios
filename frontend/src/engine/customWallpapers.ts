// Performer-added wallpapers (photos picked from their library), stored
// separately from the active PerformanceConfig so the gallery persists
// across mode switches. Capped at 4 — a short, glanceable strip.
import { storage } from "@/src/utils/storage";

const CUSTOM_WALLPAPERS_KEY = "pinkey.custom_wallpapers";
export const MAX_CUSTOM_WALLPAPERS = 4;

export async function loadCustomWallpapers(): Promise<string[]> {
  const raw = await storage.getItem(CUSTOM_WALLPAPERS_KEY, "");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function saveCustomWallpapers(uris: string[]): Promise<void> {
  await storage.setItem(CUSTOM_WALLPAPERS_KEY, JSON.stringify(uris.slice(0, MAX_CUSTOM_WALLPAPERS)));
}
