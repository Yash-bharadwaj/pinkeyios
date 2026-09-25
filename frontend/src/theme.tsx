// Design tokens for PINKEY. The performer-facing app (spectator lock screen,
// unlocked view, peek, setup) is dark-only by design — a theatrical, cinematic
// tool where brand gold is reserved for performer UI and spectator screens stay
// strictly monochrome. The admin/business side (login, admin dashboard, create
// user) uses a separate light, neutral "shadcn-style" theme instead, applied
// explicitly via <ThemeScheme scheme="light"> — never via the device's system
// appearance, so a performer's own OS dark/light setting can never flip the
// illusion screens.

import { createContext, useContext, useMemo } from "react";
import { Appearance, StyleSheet } from "react-native";

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

// Light, neutral "shadcn-style" theme — zinc scale + near-black primary.
// Used only by the admin/business screens (login, dashboard, create user).
const light: typeof dark = {
  surface: "#FAFAFA", // page canvas — zinc-50
  onSurface: "#09090B", // primary text — zinc-950
  surfaceSecondary: "#FFFFFF", // cards, sheets, list rows — pop off the page
  onSurfaceSecondary: "#18181B", // zinc-900
  surfaceTertiary: "#F4F4F5", // input backgrounds, chips — zinc-100
  onSurfaceTertiary: "#3F3F46", // zinc-700
  surfaceInverse: "#18181B", // toasts — zinc-900
  onSurfaceInverse: "#FAFAFA",
  muted: "#71717A", // zinc-500

  // Brand: near-black — the default shadcn "primary" is monochrome, not a hue.
  brand: "#18181B",
  onBrand: "#FAFAFA",
  brandPrimary: "#18181B", // zinc-900
  onBrandPrimary: "#FAFAFA",
  brandSecondary: "#3F3F46", // zinc-700 — secondary accents
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#D4D4D8", // zinc-300 — subtle chip/tag fills
  onBrandTertiary: "#18181B",

  // Status: standard Tailwind-ish semantic scale.
  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#2563EB",
  onInfo: "#FFFFFF",

  border: "#E4E4E7", // zinc-200
  borderStrong: "#D4D4D8", // zinc-300
  divider: "#E4E4E7",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { dark: ThemeColors; light: ThemeColors } = { dark, light };

// Static accessor for non-component contexts (e.g. navigator options). Always
// dark — the app's native chrome (status bar, splash) matches the spectator
// illusion, which is the default experience.
export const colors: ThemeColors = dark;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Keep native surfaces dark by default; only admin screens opt into light.
setColorScheme?.("dark");

// Explicit scheme override — set by a screen, never inferred from the device's
// system appearance. Nesting is not meaningful; the nearest provider wins.
const SchemeOverrideContext = createContext<ColorScheme | null>(null);

export function ThemeScheme({ scheme, children }: { scheme: ColorScheme; children: React.ReactNode }) {
  return <SchemeOverrideContext.Provider value={scheme}>{children}</SchemeOverrideContext.Provider>;
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const override = useContext(SchemeOverrideContext);
  const scheme: ColorScheme = override ?? defaultScheme;
  return { scheme, colors: themes[scheme] };
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
