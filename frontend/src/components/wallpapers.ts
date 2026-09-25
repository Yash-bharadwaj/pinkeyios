// Wallpaper presets for the simulated home screen.
// All presets are bundled assets — the show works 100% offline.
// A preset id resolves to a bundled image; anything else is treated as a URI
// (a photo the performer picked from their library).

import type { ImageSource } from "expo-image";

export interface WallpaperPreset {
  id: string;
  name: string;
  source: ImageSource;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: "midnight", name: "Midnight", source: require("../../assets/images/wallpapers/midnight.png") },
  { id: "ocean", name: "Ocean", source: require("../../assets/images/wallpapers/ocean.png") },
  { id: "forest", name: "Forest", source: require("../../assets/images/wallpapers/forest.png") },
  { id: "sunset", name: "Sunset", source: require("../../assets/images/wallpapers/sunset.png") },
  { id: "graphite", name: "Graphite", source: require("../../assets/images/wallpapers/graphite.png") },
];

export function resolveWallpaper(idOrUri: string): ImageSource {
  const preset = WALLPAPER_PRESETS.find((p) => p.id === idOrUri);
  if (preset) return preset.source;
  return { uri: idOrUri };
}

export function isCustomWallpaper(idOrUri: string): boolean {
  return !WALLPAPER_PRESETS.some((p) => p.id === idOrUri);
}
