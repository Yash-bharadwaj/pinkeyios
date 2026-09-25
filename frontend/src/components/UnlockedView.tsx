// Simulated "home" screen shown after the unlock moment — resembles a real
// phone opening: wallpaper (configurable), icon grid with labels, a real
// Liquid Glass dock, page indicator dots, home indicator. Icons stagger in
// like a real unlock. The whole surface is a 2-second long-press trigger for
// the hidden Peek view.
//
// No custom-drawn status bar here — the device's own real status bar (real
// time, real signal, real battery) already renders above this screen, so a
// hand-drawn one would just be a second, slightly-wrong copy of it. Content
// is inset from the top by the safe area instead, letting the real one show.
//
// App icons are built from SF Symbols (licensed for use in apps on Apple
// platforms) on tiles colored to match each real app's brand color — not
// Apple's actual icon artwork, which is copyrighted/trademarked and not ours
// to redistribute. This reads as "real" at a glance without that risk.

import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass } from "./Glass";
import { Symbol } from "./Symbol";
import { resolveWallpaper } from "./wallpapers";
import { useTheme } from "@/src/theme";

interface UnlockedViewProps {
  onPeek: () => void;
  wallpaper: string;
}

interface AppMeta {
  label: string;
  sf: string;
  bg: string | [string, string];
  fg?: string;
}

const GRID_APPS: AppMeta[] = [
  { label: "Messages", sf: "message.fill", bg: "#32D74B" },
  { label: "Photos", sf: "photo.fill", bg: ["#FFD60A", "#BF5AF2"] },
  { label: "Camera", sf: "camera.fill", bg: "#1C1C1E" },
  { label: "Weather", sf: "cloud.sun.fill", bg: ["#0A84FF", "#64D2FF"] },
  { label: "Notes", sf: "note.text", bg: "#FFD60A", fg: "#4A3B00" },
  { label: "Music", sf: "music.note", bg: ["#FA2E4C", "#FF6482"] },
  { label: "Mail", sf: "envelope.fill", bg: "#0A84FF" },
  { label: "Maps", sf: "map.fill", bg: "#8FBF75" },
  { label: "Calendar", sf: "calendar", bg: "#FFFFFF", fg: "#FF3B30" },
  { label: "Clock", sf: "clock.fill", bg: "#1C1C1E" },
  { label: "FaceTime", sf: "video.fill", bg: "#30D158" },
  { label: "Settings", sf: "gearshape.fill", bg: "#8E8E93" },
];

const DOCK_APPS: AppMeta[] = [
  { label: "Phone", sf: "phone.fill", bg: "#30D158" },
  { label: "Safari", sf: "safari", bg: ["#0A84FF", "#5AC8FA"] },
  { label: "Messages", sf: "message.fill", bg: "#32D74B" },
  { label: "Music", sf: "music.note", bg: ["#FA2E4C", "#FF6482"] },
];

function AppTile({ sf, bg, fg = "#FFFFFF", label }: { sf: string; bg: string | [string, string]; fg?: string; label: string }) {
  return (
    <View style={styles.appTile}>
      {Array.isArray(bg) ? (
        <LinearGradient
          colors={bg}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
      )}
      <Symbol name={sf} fallback={label[0]?.toUpperCase() ?? ""} size={26} color={fg} />
    </View>
  );
}

function AppIcon({ app, index }: { app: AppMeta; index: number }) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(140 + index * 45)} style={styles.appSlot}>
      <AppTile sf={app.sf} bg={app.bg} fg={app.fg} label={app.label} />
      <Text style={styles.appLabel} numberOfLines={1}>
        {app.label}
      </Text>
    </Animated.View>
  );
}

export function UnlockedView({ onPeek, wallpaper }: UnlockedViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      testID="unlocked-screen"
      style={styles.flex}
      delayLongPress={2000}
      onLongPress={onPeek}
    >
      <View style={styles.flex}>
        <Image
          testID="wallpaper-image"
          source={resolveWallpaper(wallpaper)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <LinearGradient
          colors={["rgba(5,5,8,0.05)", "rgba(5,5,8,0.5)"]}
          style={StyleSheet.absoluteFill}
        />

        {/* App grid — staggers in like a real unlock; inset by the real status bar */}
        <View style={[styles.grid, { paddingTop: insets.top + 16 }]}>
          {GRID_APPS.map((app, i) => (
            <AppIcon key={`${app.label}-${i}`} app={app} index={i} />
          ))}
        </View>

        {/* Page indicator dots */}
        <View style={styles.pageDots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>

        <View style={styles.spacer} />

        {/* Dock — real Liquid Glass on iOS */}
        <Animated.View entering={FadeInDown.duration(420).delay(520)}>
          <Glass style={[styles.dock, { marginBottom: insets.bottom + 18 }]}>
            {DOCK_APPS.map((app, i) => (
              <AppTile key={`dock-${app.label}-${i}`} sf={app.sf} bg={app.bg} fg={app.fg} label={app.label} />
            ))}
          </Glass>
        </Animated.View>

        <View style={[styles.homeIndicator, { backgroundColor: colors.onSurface }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    paddingHorizontal: 28,
    rowGap: 26,
  },
  appSlot: {
    width: "25%",
    alignItems: "center",
  },
  appTile: {
    width: 58,
    height: 58,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  appLabel: {
    fontSize: 11,
    marginTop: 5,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pageDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  dotActive: {
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  spacer: { flex: 1 },
  dock: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginHorizontal: 18,
    borderRadius: 26,
    paddingVertical: 12,
    overflow: "hidden",
  },
  homeIndicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
    opacity: 0.4,
    alignSelf: "center",
    marginBottom: 8,
  },
});
