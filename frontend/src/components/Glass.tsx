// Real translucent system material — Liquid Glass on iOS (the same native
// material the actual Home Screen dock uses), a genuine blur on Android, and
// a flat translucent fallback everywhere else. Matches design_guidelines.json's
// platform_libraries.glass mapping.
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";

// expo-glass-effect wraps a brand-new (iOS 26) native API. If the native
// module isn't linked in this build — an older Expo Go, a device on an
// earlier iOS — rendering <GlassView> can throw at the native layer instead
// of failing gracefully, so this check (and the try/catch around it) has to
// happen before we ever mount it, not inside it.
let iosGlassAvailable = false;
if (Platform.OS === "ios") {
  try {
    iosGlassAvailable = isGlassEffectAPIAvailable();
  } catch {
    iosGlassAvailable = false;
  }
}

export function Glass({ style, children, ...rest }: ViewProps) {
  if (Platform.OS === "ios" && iosGlassAvailable) {
    return (
      <GlassView glassEffectStyle="regular" style={style} {...rest}>
        {children}
      </GlassView>
    );
  }
  if (Platform.OS === "android") {
    // "systemChromeMaterialDark" is an iOS-only material name — expo-blur
    // silently falls back to a flat near-black tint for it on Android,
    // which is why the dock/search pill read as a dark box instead of
    // frosted glass. "dark" is Android's actual supported tint, at a higher
    // intensity plus a faint light wash so the wallpaper still reads
    // through instead of going flat/opaque. `style` (radius, margins,
    // overflow:hidden) stays on this outer view only — putting it on the
    // blur layer too would double every margin.
    return (
      <View style={style} {...rest}>
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.androidGlassWash]} />
        {children}
      </View>
    );
  }
  return (
    <View style={[style, { backgroundColor: "rgba(28,28,30,0.55)" }]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  androidGlassWash: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});
