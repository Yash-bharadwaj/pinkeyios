// Simulated "home" screen shown after the unlock moment — resembles a real
// phone opening: wallpaper (configurable), status bar, icon grid with labels,
// dock, home indicator. Icons stagger in like a real unlock.
// The whole surface is a 2-second long-press trigger for the hidden Peek view.

import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Symbol } from "./Symbol";
import { resolveWallpaper } from "./wallpapers";
import { useTheme } from "@/src/theme";

interface UnlockedViewProps {
  onPeek: () => void;
  timeLabel: string;
  wallpaper: string;
}

const GRID_APPS = [
  { label: "Messages", sf: "message.fill" },
  { label: "Photos", sf: "photo.on.rectangle" },
  { label: "Camera", sf: "camera.fill" },
  { label: "Weather", sf: "cloud.sun.fill" },
  { label: "Notes", sf: "note.text" },
  { label: "Music", sf: "music.note" },
  { label: "Mail", sf: "envelope.fill" },
  { label: "Maps", sf: "map.fill" },
];

const DOCK_APPS = [
  { label: "Phone", sf: "phone.fill" },
  { label: "Safari", sf: "safari" },
  { label: "Messages", sf: "message.fill" },
  { label: "Music", sf: "music.note" },
];

function AppIcon({
  label,
  sf,
  index,
  onSurface,
  surfaceSecondary,
}: {
  label: string;
  sf: string;
  index: number;
  onSurface: string;
  surfaceSecondary: string;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(380).delay(140 + index * 45)}
      style={styles.appSlot}
    >
      <View style={[styles.appTile, { backgroundColor: surfaceSecondary }]}>
        <Symbol name={sf} fallback={label[0]} size={26} color={onSurface} />
      </View>
      <Text style={[styles.appLabel, { color: onSurface }]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

export function UnlockedView({ onPeek, timeLabel, wallpaper }: UnlockedViewProps) {
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

        {/* Status bar — resembles the real thing */}
        <View style={[styles.statusBar, { paddingTop: insets.top + 6 }]}>
          <Text style={[styles.statusTime, { color: colors.onSurface }]}>{timeLabel}</Text>
          <View style={styles.statusIcons}>
            <Symbol name="cellularbars" fallback="▂" size={15} color={colors.onSurface} />
            <Symbol name="wifi" fallback="⌁" size={15} color={colors.onSurface} />
            <Symbol name="battery.100" fallback="▮" size={17} color={colors.onSurface} />
          </View>
        </View>

        {/* App grid — staggers in like a real unlock */}
        <View style={styles.grid}>
          {GRID_APPS.map((app, i) => (
            <AppIcon
              key={`${app.label}-${i}`}
              label={app.label}
              sf={app.sf}
              index={i}
              onSurface={colors.onSurface}
              surfaceSecondary={colors.surfaceSecondary}
            />
          ))}
        </View>

        <View style={styles.spacer} />

        {/* Dock */}
        <Animated.View
          entering={FadeInDown.duration(420).delay(520)}
          style={[
            styles.dock,
            { backgroundColor: "rgba(34,34,37,0.55)", marginBottom: insets.bottom + 18 },
          ]}
        >
          {DOCK_APPS.map((app, i) => (
            <View
              key={`dock-${app.label}-${i}`}
              style={[styles.appTile, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Symbol name={app.sf} fallback={app.label[0]} size={26} color={colors.onSurface} />
            </View>
          ))}
        </Animated.View>

        <View style={[styles.homeIndicator, { backgroundColor: colors.onSurface }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 26,
  },
  statusTime: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  statusIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    paddingHorizontal: 28,
    marginTop: 40,
    rowGap: 26,
  },
  appSlot: {
    width: "25%",
    alignItems: "center",
  },
  appTile: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  appLabel: {
    fontSize: 11,
    marginTop: 5,
  },
  spacer: { flex: 1 },
  dock: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginHorizontal: 18,
    borderRadius: 26,
    paddingVertical: 12,
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
