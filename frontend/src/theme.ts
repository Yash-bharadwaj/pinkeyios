// Design tokens for PINKEY. Dark theme only (per design guidelines — the app is
// a dark theatrical experience; spectator screens use ONLY surface/onSurface
// monochrome, brand gold is reserved for performer-facing screens).
// Keys match the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  // Surfaces: backgrounds, from the screen down to small fills.
  surface: "#050508", // primary canvas — near-black
  onSurface: "#F5F5F5", // text and icons on the canvas
  surfaceSecondary: "#141417", // cards, sheets, list rows
  onSurfaceSecondary: "#EAEAEA", // text and icons on cards, sheets, rows
  surfaceTertiary: "#222225", // input backgrounds, chips, deepest nesting
  onSurfaceTertiary: "#D0D0D0", // text on inputs and chips; also muted text
  surfaceInverse: "#EAEAEA", // tooltips, snackbars
  onSurfaceInverse: "#050508", // text on the inverse surface
  muted: "#7A7A80", // subdued text: captions, timestamps, placeholders

  // Brand: Antique Gold — performer-facing ONLY (never on spectator screens).
  brand: "#C5A059",
  onBrand: "#050508",
  brandPrimary: "#C5A059", // primary CTA, selected states (performer UI)
  onBrandPrimary: "#050508",
  brandSecondary: "#E4C787", // secondary accents
  onBrandSecondary: "#050508",
  brandTertiary: "#8A6D3B", // chips, tags, subtle brand moments
  onBrandTertiary: "#FFFFFF",

  // Status: semantic only.
  success: "#34C759",
  onSuccess: "#000000",
  warning: "#FF9F0A",
  onWarning: "#000000",
  error: "#FF453A",
  onError: "#FFFFFF",
  info: "#C5A059",
  onInfo: "#050508",

  // Lines
  border: "#2A2A2E", // hairline outline
  borderStrong: "#3A3A40", // focus rings, selected outlines
  divider: "#2A2A2E",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { dark: ThemeColors; light?: ThemeColors } = { dark };

// Static accessor for non-component contexts (e.g. navigator options).
export const colors: ThemeColors = dark;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Keep native surfaces dark; this app ships dark only.
setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system as ColorScheme] ? (system as ColorScheme) : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.dark };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
