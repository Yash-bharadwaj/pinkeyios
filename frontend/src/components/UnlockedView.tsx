// "Home" screen shown after the unlock moment.
//
// Two modes, chosen by what the performer set as the Home Screen wallpaper:
//   - A real photo they uploaded (e.g. a screenshot of their actual home
//     screen) → shown edge-to-edge with NO overlay at all. It's already a
//     real home screen, so drawing a fake icon grid on top of it would only
//     make it look less real. This is the mode to use for the show.
//   - One of the bundled presets (plain backdrops, not screenshots) → falls
//     back to a simulated grid so the screen isn't just an empty wallpaper
//     before the performer has uploaded their own photo.
//
// Either way, the whole surface is a 2-second long-press trigger for the
// hidden Peek view — that's the only entry point to Peek, so it must stay
// on both modes.
//
// No custom-drawn status bar here — the device's own real status bar (real
// time, real signal, real battery) already renders above this screen, so a
// hand-drawn one would just be a second, slightly-wrong copy of it. Content
// is inset from the top by the safe area instead, letting the real one show.
//
// Simulated-mode app icons are built from SF Symbols (licensed for use in
// apps on Apple platforms) on tiles colored to match each real app's brand
// color — not Apple's actual icon artwork, which is copyrighted/trademarked
// and not ours to redistribute. This reads as "real" at a glance without
// that risk.

import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass } from "./Glass";
import { Symbol } from "./Symbol";
import { resolveWallpaper, WALLPAPER_PRESETS } from "./wallpapers";
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

// Second home-screen page — a real iPhone almost never has just one, so a
// static single page reads as fake. Swiping left reveals this one.
const GRID_APPS_PAGE_2: AppMeta[] = [
  { label: "App Store", sf: "app.badge", bg: ["#0A84FF", "#30D158"] },
  { label: "Files", sf: "folder.fill", bg: "#64D2FF" },
  { label: "Wallet", sf: "wallet.pass.fill", bg: "#1C1C1E" },
  { label: "Health", sf: "heart.fill", bg: "#FF6482" },
  { label: "Home", sf: "house.fill", bg: ["#FFD60A", "#FF9F0A"] },
  { label: "Find My", sf: "location.fill", bg: "#30D158" },
  { label: "Contacts", sf: "person.crop.circle.fill", bg: "#8E8E93" },
  { label: "Stocks", sf: "chart.line.uptrend.xyaxis", bg: "#1C1C1E" },
  { label: "TV", sf: "tv.fill", bg: "#1C1C1E" },
  { label: "Podcasts", sf: "mic.fill", bg: ["#BF5AF2", "#0A84FF"] },
  { label: "Shortcuts", sf: "bolt.fill", bg: ["#64D2FF", "#0A84FF"] },
  { label: "Reminders", sf: "checklist", bg: "#FFFFFF", fg: "#FF3B30" },
];

const GRID_PAGES: AppMeta[][] = [GRID_APPS, GRID_APPS_PAGE_2];

// A horizontal ScrollView needs an explicit height (it won't size itself to
// its paged children). This is only the FALLBACK used for the first frame,
// before the real page below measures itself via onLayout and takes over —
// so it's deliberately generous (padded well past the estimate) rather than
// exact: undersizing clips a row, oversizing just shows briefly before the
// real measurement settles it, which is the safe direction to be wrong in.
const GRID_TILE_SIZE = 58;
const GRID_COLUMNS = 4;
const GRID_ROW_GAP = 26;
const GRID_ROW_HEIGHT_ESTIMATE = GRID_TILE_SIZE + 5 /* label marginTop */ + 20 /* label line height + shadow */;
const GRID_ROWS = Math.max(...GRID_PAGES.map((p) => Math.ceil(p.length / GRID_COLUMNS)));
const GRID_PAGE_HEIGHT_FALLBACK =
  GRID_ROWS * GRID_ROW_HEIGHT_ESTIMATE + (GRID_ROWS - 1) * GRID_ROW_GAP + 32 /* safety buffer */;

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
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  // GRID_PAGE_HEIGHT is a rough estimate — real font metrics vary by device
  // and could clip the last row. Self-correct with a real measurement of the
  // first page as soon as it lays out, with a generous fallback until then
  // so nothing is ever clipped, even on the first frame.
  const [measuredPageHeight, setMeasuredPageHeight] = useState<number | null>(null);
  const onFirstPageLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    setMeasuredPageHeight(e.nativeEvent.layout.height);
  }, []);

  // Track the page from live scroll position, not just at scroll-end — on a
  // real iPhone the dots follow your finger as you drag, not just once you
  // release, and this reads noticeably more real than the alternative.
  const onGridScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / width);
      setPage((prev) => (prev === idx ? prev : idx));
    },
    [width],
  );

  // A preset is one of the bundled plain backdrops; anything else is a photo
  // the performer picked from their library — treated as a real screenshot.
  const isRealPhoto = !WALLPAPER_PRESETS.some((p) => p.id === wallpaper);

  if (isRealPhoto) {
    return (
      <Pressable
        testID="unlocked-screen"
        style={styles.flex}
        delayLongPress={2000}
        onLongPress={onPeek}
      >
        <Image
          testID="wallpaper-image"
          source={resolveWallpaper(wallpaper)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </Pressable>
    );
  }

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

        {/* App grid — staggers in like a real unlock; swipe left/right for
            more apps, same as a real home screen. */}
        <ScrollView
          testID="app-grid-pager"
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onGridScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: insets.top + 16, alignItems: "flex-start" }}
          style={{ height: (measuredPageHeight ?? GRID_PAGE_HEIGHT_FALLBACK) + insets.top + 16 }}
        >
          {GRID_PAGES.map((appsOnPage, pageIndex) => (
            <View
              key={pageIndex}
              style={[styles.grid, { width }]}
              onLayout={pageIndex === 0 ? onFirstPageLayout : undefined}
            >
              {appsOnPage.map((app, i) => (
                <AppIcon key={`${app.label}-${i}`} app={app} index={i} />
              ))}
            </View>
          ))}
        </ScrollView>

        {/* Page indicator dots */}
        <View style={styles.pageDots}>
          {GRID_PAGES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
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
