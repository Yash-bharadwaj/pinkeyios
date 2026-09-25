// Real translucent system material — Liquid Glass on iOS (the same native
// material the actual Home Screen dock uses), a genuine blur on Android, and
// a flat translucent fallback everywhere else. Matches design_guidelines.json's
// platform_libraries.glass mapping.
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { Platform, View, type ViewProps } from "react-native";

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
    return (
      <BlurView intensity={50} tint="systemChromeMaterialDark" style={style} {...rest}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[style, { backgroundColor: "rgba(28,28,30,0.55)" }]} {...rest}>
      {children}
    </View>
  );
}
