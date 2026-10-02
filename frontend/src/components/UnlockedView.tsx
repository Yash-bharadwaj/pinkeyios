// "Home" screen shown after the unlock moment.
//
// The wallpaper (a bundled preset or a photo the performer uploaded from
// their gallery — see wallpapers.ts) is just the background image. The same
// horizontally-paged app menu, built from the performer's real, user-supplied
// app icons (src/data/realApps.ts), always renders on top of it regardless of
// which wallpaper is chosen — a phone with the apps an actual person has
// installed reads as more genuinely "used" than a clean set of stock system
// icons. Apps are NOT grouped by category (no section headers) — a real
// iPhone home screen doesn't group your apps by type either, it's whatever
// order you arranged them in. Pages are just fixed-size chunks of the full
// list, swiped between.
//
// Search is a tap-to-open overlay (matching real iOS, and matching the
// performer's own reference screenshot), not an always-visible text field —
// a persistent field pinned at the very bottom of the screen would sit
// directly under the keyboard the instant you started typing into it.
//
// The whole surface is a 2-second long-press trigger for the hidden Peek
// view — that's the only entry point to Peek, and it needs to keep working
// whether or not the search overlay is open.
//
// No custom-drawn status bar here — the device's own real status bar (real
// time, real signal, real battery) already renders above this screen, so a
// hand-drawn one would just be a second, slightly-wrong copy of it. Content
// is inset from the top by the safe area instead, letting the real one show.

import { Image, type ImageSource } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { runOnJS } from "react-native-worklets";

import { Glass } from "./Glass";
import { Symbol } from "./Symbol";
import { resolveWallpaper } from "./wallpapers";
import { REAL_APPS, type AppCategory, type RealApp } from "@/src/data/realApps";
import { useTheme } from "@/src/theme";

interface UnlockedViewProps {
  onPeek: () => void;
  wallpaper: string;
}

const COLUMNS = 4;
const ROWS_PER_PAGE = 6;
const PAGE_CAPACITY = COLUMNS * ROWS_PER_PAGE;
const GRID_H_PADDING = 20;

// Dock: Truecaller / Safari / WhatsApp / Camera. Originally requested as
// Phone/Safari/WhatsApp/Spotify, but there's no plain "Phone" dialer app in
// AppIcons/ (only "PhonePe", a payments app — using it as a phone-dialer icon
// would be actively wrong, not a fallback); Truecaller, a real caller-ID/
// dialer app, is the closest actual asset to that slot. Every id below was
// verified against src/data/realApps.ts before use.
const DOCK_APP_IDS = ["truecaller", "safari", "whatsapp", "applecamera"];
const DOCK_APP_ID_SET = new Set(DOCK_APP_IDS);
const DOCK_APPS: RealApp[] = DOCK_APP_IDS.map(
  (id) => REAL_APPS.find((app) => app.id === id)!,
);

// Apps a person would realistically want one tap away every day — never
// folded, regardless of what the random draw below would otherwise pick.
// Without this, folder selection was pure chance: it was just as likely to
// bury Gmail/Instagram in a folder while leaving Airbnb/Cleartrip/BookMyShow
// sitting standalone, which is backwards from how anyone actually uses a
// phone. This list is deliberately short — it's a "keep visible" override,
// not an attempt to rank all 103 apps by importance.
const ESSENTIAL_APP_IDS = new Set([
  "gmail", "instagram", "telegram", "googlemaps", "applephotos",
  "irctcrailconnect", "phonepe", "googlepay", "zomato", "swiggy",
  "youtube", "spotify", "amazon", "applenotes", "applecalendar", "zoom",
]);

// Every category is now an iOS-style folder — reusing the same category
// metadata that used to drive section headers, just for a different purpose
// now that headers/segregation were explicitly removed. Folder size varies
// (4-6 apps, picked at random from the category, excluding essentials and
// dock apps) rather than always maxing out at 6 — a real person's folders
// aren't uniformly sized either. Whatever doesn't fit goes back into the
// standalone list, so every app still appears exactly once, somewhere.
interface Folder {
  id: string;
  name: string;
  apps: RealApp[];
}
const FOLDER_CATEGORIES: { category: AppCategory; name: string }[] = [
  { category: "social", name: "Social" },
  { category: "entertainment", name: "Entertainment" },
  { category: "games", name: "Games" },
  { category: "travel", name: "Travel" },
  { category: "finance", name: "Finance" },
  { category: "shopping", name: "Shopping" },
  { category: "tools", name: "Tools" },
  { category: "productivity", name: "Productivity" },
  { category: "health", name: "Health" },
  { category: "education", name: "Education" },
];
const FOLDER_SIZE_MIN = 4;
const FOLDER_SIZE_MAX = 6;

// Deterministic-per-load shuffle (not re-randomized on every render — a real
// home screen doesn't rearrange itself every time you look at it) so folder
// contents and folder placement both vary without being unstable mid-session.
function shuffle<T>(items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randomFolderSize(): number {
  return FOLDER_SIZE_MIN + Math.floor(Math.random() * (FOLDER_SIZE_MAX - FOLDER_SIZE_MIN + 1));
}

const usedInFolders = new Set<string>();
const FOLDERS: Folder[] = FOLDER_CATEGORIES.map(({ category, name }) => {
  const candidates = shuffle(
    REAL_APPS.filter(
      (app) => app.category === category && !DOCK_APP_ID_SET.has(app.id) && !ESSENTIAL_APP_IDS.has(app.id),
    ),
  );
  const chosen = candidates.slice(0, randomFolderSize());
  chosen.forEach((app) => usedInFolders.add(app.id));
  return { id: `folder-${category}`, name, apps: chosen };
});

type GridItem = { kind: "app"; app: RealApp } | { kind: "folder"; folder: Folder };

const STANDALONE_APPS = REAL_APPS.filter(
  (app) => !usedInFolders.has(app.id) && !DOCK_APP_ID_SET.has(app.id),
);
const GRID_ITEMS: GridItem[] = shuffle([
  ...FOLDERS.map((folder): GridItem => ({ kind: "folder", folder })),
  ...STANDALONE_APPS.map((app): GridItem => ({ kind: "app", app })),
]);

// Flat, fixed-size chunks — no category grouping. Computed once at module
// scope since GRID_ITEMS is static data, not per-render state.
const PAGES: GridItem[][] = [];
for (let i = 0; i < GRID_ITEMS.length; i += PAGE_CAPACITY) {
  PAGES.push(GRID_ITEMS.slice(i, i + PAGE_CAPACITY));
}

// A phone with zero unread badges anywhere looks staged. A handful of
// plausible counts on commonly-used apps reads as genuinely lived-in without
// cluttering every icon — real phones don't have unread counts on
// everything either. IDs match src/data/realApps.ts.
const BADGE_COUNTS: Record<string, number> = {
  whatsapp: 3,
  instagram: 12,
  facebook: 1,
  messenger: 2,
  gmail: 47,
  telegram: 5,
  snapchat: 8,
  linkedin: 1,
  youtube: 9,
  spotify: 2,
  netflix: 1,
  disneyplus: 3,
  amazon: 2,
  flipkart: 5,
  swiggy: 1,
  zomato: 4,
  phonepe: 1,
  googlepay: 2,
  paytm: 6,
  discord: 14,
  reddit: 23,
  truecaller: 1,
  chatgpt: 2,
};

// Every size below is a range, not a fixed number — `usePageMetrics` picks a
// point in each range from the real, current screen height, so exactly
// ROWS_PER_PAGE rows always fit without clipping the last row or leaving a
// half-empty page, on anything from an iPhone SE to a Pro Max.
//
// LABEL_BLOCK_HEIGHT must match the label's REAL rendered height, not just
// one line of it: labels wrap to 2 lines (numberOfLines={2} below), so at
// marginTop 6 + lineHeight 13 × 2 lines, a label is actually ~32px tall. This
// was previously set to 18 (one line's worth) — on any page whose content
// needed the full 2 lines, the grid's actual height exceeded what the pager
// budgeted for it, and the excess got clipped by the pager's bounds. That's
// what "last row's text is cut off" was: not a rendering bug, a budgeting one.
const LABEL_BLOCK_HEIGHT = 33;
const TILE_RANGE = { min: 46, max: 62 };
const ROW_GAP_RANGE = { min: 10, max: 18 };
const GRID_TOP_GAP = 16;
const DOTS_BLOCK_HEIGHT = 26;
const SEARCH_PILL_MARGIN_TOP = 14;
const SEARCH_PILL_HEIGHT = 24;
const SEARCH_PILL_MARGIN_BOTTOM = 14;
const DOCK_VERTICAL_PADDING = 14; // top+bottom padding inside the dock, see styles.dock
const DOCK_MARGIN_BOTTOM = 14; // dock → home indicator / safe area
const HOME_INDICATOR_BLOCK = 5; // just the bar's own height — its bottom margin is insets.bottom, counted separately below
const LAYOUT_SAFETY_MARGIN = 12;
const OVERLAY_TOP_ROW_BLOCK = 56; // search-overlay's own top bar (input + Cancel)
// Both overlay grids (search results, folder contents) render through the
// same AppGrid as the main pager but never passed it a rowGap, so rows had
// no vertical breathing room at all — icons/labels from adjacent rows were
// effectively touching. The paged grid never had this bug since it always
// passed its own computed rowGap.
const OVERLAY_GRID_ROW_GAP = 18;

function gridContentHeight(tile: number, rowGap: number): number {
  return ROWS_PER_PAGE * (tile + LABEL_BLOCK_HEIGHT) + (ROWS_PER_PAGE - 1) * rowGap;
}

// Dock icons are the same size as home-screen icons (real iPhone behavior),
// so the dock's own height is `tileSize + DOCK_VERTICAL_PADDING*2` — not an
// independent number. That ties it into the same min/max scalable budget as
// the grid below, rather than reserving a separate fixed guess for it.
function usePageMetrics() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const fixedChrome =
      insets.top +
      GRID_TOP_GAP +
      DOTS_BLOCK_HEIGHT +
      SEARCH_PILL_MARGIN_TOP +
      SEARCH_PILL_HEIGHT +
      SEARCH_PILL_MARGIN_BOTTOM +
      DOCK_VERTICAL_PADDING * 2 +
      DOCK_MARGIN_BOTTOM +
      HOME_INDICATOR_BLOCK +
      insets.bottom;

    const available = height - fixedChrome - LAYOUT_SAFETY_MARGIN;
    const minScalable = gridContentHeight(TILE_RANGE.min, ROW_GAP_RANGE.min) + TILE_RANGE.min;
    const maxScalable = gridContentHeight(TILE_RANGE.max, ROW_GAP_RANGE.max) + TILE_RANGE.max;

    const rawScale = (available - minScalable) / (maxScalable - minScalable);
    const scale = Math.min(1, Math.max(0, rawScale));

    const lerp = (range: { min: number; max: number }) => range.min + scale * (range.max - range.min);

    return {
      tileSize: Math.round(lerp(TILE_RANGE)),
      rowGap: Math.round(lerp(ROW_GAP_RANGE)),
    };
  }, [height, insets.top, insets.bottom]);
}

// Search-overlay results aren't paged — a filtered list is short and
// unpredictable in length, which is exactly what a plain scrollable grid is
// for. Sized independently of the paged grid's fitted tileSize since there's
// no fixed row count to fit here.
function useSearchIconSize() {
  const { width } = useWindowDimensions();
  return useMemo(() => Math.round(((width - GRID_H_PADDING * 2) / COLUMNS) * 0.6), [width]);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Press feedback via Reanimated's spring (UI-thread-driven, the same
// mechanism as Reanimated's other entrance animations here) plus a light
// haptic — real iOS icons compress slightly and give tactile feedback on
// touch, even though tapping doesn't open anything in this build.
function PressableIcon({ source, size, badge }: { source: ImageSource; size: number; badge?: number }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const badgeOffset = -Math.round(size * 0.08);

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.88, { damping: 14, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 320 });
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    >
      <Animated.View style={animatedStyle}>
        <Image source={source} style={{ width: size, height: size }} contentFit="contain" />
        {badge != null && badge > 0 && (
          <View style={[styles.badge, { top: badgeOffset, right: badgeOffset }]}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function AppIconReal({ app, size, badge }: { app: RealApp; size: number; badge?: number }) {
  return (
    <View style={styles.appSlot}>
      <PressableIcon source={app.icon} size={size} badge={badge} />
      <Text style={styles.appLabel} numberOfLines={2}>
        {app.name}
      </Text>
    </View>
  );
}

function AppGrid({ apps, iconSize, rowGap }: { apps: RealApp[]; iconSize: number; rowGap?: number }) {
  return (
    <View style={[styles.grid, rowGap != null && { rowGap }]}>
      {apps.map((app) => (
        <AppIconReal key={app.id} app={app} size={iconSize} badge={BADGE_COUNTS[app.id]} />
      ))}
    </View>
  );
}

// A real iOS folder icon: a translucent rounded-square tile with small
// previews of its contents, same footprint as a normal app slot. The column
// count adapts to how many apps are actually in the folder (√count, rounded
// up) instead of always being 4 — a fixed 4 columns made 6 apps wrap as an
// unbalanced 4-then-2, whereas real iOS folder previews go roughly square:
// 4 apps → 2×2, 6 → 3×3 (with 3 empty), 9 → 3×3. Tapping it opens the folder
// rather than any single app.
const FOLDER_PREVIEW_MAX = 16;

function FolderIcon({ folder, size, onPress }: { folder: Folder; size: number; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const preview = folder.apps.slice(0, FOLDER_PREVIEW_MAX);
  const columns = Math.max(1, Math.ceil(Math.sqrt(preview.length)));
  const thumbGap = Math.max(2, Math.round(size * 0.06));
  const padding = Math.max(2, Math.round(size * 0.05));
  const thumbSize = Math.round((size - padding * 2 - thumbGap * (columns - 1)) / columns);

  return (
    <View style={styles.appSlot}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.92, { damping: 14, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 320 });
        }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        <Animated.View
          style={[
            styles.folderTile,
            {
              width: size,
              height: size,
              borderRadius: Math.round(size * 0.26),
              gap: thumbGap,
              padding,
            },
            animatedStyle,
          ]}
        >
          {preview.map((app) => (
            <Image
              key={app.id}
              source={app.icon}
              style={{ width: thumbSize, height: thumbSize, borderRadius: Math.round(thumbSize * 0.22) }}
              contentFit="contain"
            />
          ))}
        </Animated.View>
      </Pressable>
      <Text style={styles.appLabel} numberOfLines={2}>
        {folder.name}
      </Text>
    </View>
  );
}

// The main paged grid, unlike AppGrid (plain RealApp[], used for search
// results where folders don't apply — search surfaces the actual app, not
// the folder it lives in), renders a mix of standalone icons and folders.
function HomeAppGrid({
  items,
  iconSize,
  rowGap,
  onOpenFolder,
}: {
  items: GridItem[];
  iconSize: number;
  rowGap?: number;
  onOpenFolder: (folder: Folder) => void;
}) {
  return (
    <View style={[styles.grid, rowGap != null && { rowGap }]}>
      {items.map((item) =>
        item.kind === "folder" ? (
          <FolderIcon
            key={item.folder.id}
            folder={item.folder}
            size={iconSize}
            onPress={() => onOpenFolder(item.folder)}
          />
        ) : (
          <AppIconReal key={item.app.id} app={item.app} size={iconSize} badge={BADGE_COUNTS[item.app.id]} />
        ),
      )}
    </View>
  );
}

// Fixed across every page — a real iPhone dock doesn't move when you swipe
// between home-screen pages, so this renders as a sibling of the pager, not
// inside its scrollable content.
function Dock({ size }: { size: number }) {
  return (
    <Animated.View entering={FadeIn.duration(150)}>
      <Glass style={styles.dock}>
        {DOCK_APPS.map((app) => (
          <PressableIcon key={app.id} source={app.icon} size={size} badge={BADGE_COUNTS[app.id]} />
        ))}
      </Glass>
    </Animated.View>
  );
}

// Reads the pager's scroll position directly off a shared value (updated by
// useAnimatedScrollHandler, entirely on the UI thread) instead of a React
// `active` prop driven by JS-side onScroll + setState. That old path forced
// a full React re-render of the whole screen — including every off-screen
// page's icons — on every scroll frame during a drag, which is exactly the
// kind of per-frame JS work that makes a swipe feel janky instead of smooth.
// This way scrolling never touches React state at all.
function PageDot({ index, scrollX, pageWidth }: { index: number; scrollX: SharedValue<number>; pageWidth: number }) {
  const animatedStyle = useAnimatedStyle(() => {
    const active = Math.round(scrollX.value / pageWidth) === index;
    return {
      opacity: withTiming(active ? 1 : 0.35, { duration: 220 }),
      transform: [{ scale: withTiming(active ? 1.2 : 1, { duration: 220 }) }],
    };
  });
  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

// The at-rest affordance sitting above the dock — a tappable pill, not a
// live text field (see file header for why). Tapping it opens the full
// search overlay, matching how a real iPhone's Search actually behaves.
function SearchPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Glass style={styles.searchPill}>
        <Symbol name="magnifyingglass" fallback="" size={11} color="rgba(255,255,255,0.7)" />
        <Text style={styles.searchPillText}>Search</Text>
      </Glass>
    </Pressable>
  );
}

function SearchOverlay({
  query,
  onChangeText,
  onClose,
  results,
  iconSize,
  bottomPadding,
}: {
  query: string;
  onChangeText: (v: string) => void;
  onClose: () => void;
  results: RealApp[];
  iconSize: number;
  bottomPadding: number;
}) {
  const insets = useSafeAreaInsets();
  const searching = query.length > 0;

  return (
    <Animated.View
      testID="app-search-overlay"
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
      style={styles.overlay}
    >
      <View style={[styles.overlayTopRow, { marginTop: insets.top + 12 }]}>
        <Glass style={styles.overlayInputWrap}>
          <Symbol name="magnifyingglass" fallback="" size={16} color="rgba(255,255,255,0.6)" />
          <TextInput
            autoFocus
            value={query}
            onChangeText={onChangeText}
            placeholder="Search apps"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.overlayInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </Glass>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView
        testID="app-search-results"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: GRID_TOP_GAP, paddingBottom: bottomPadding }}
      >
        {searching && (results.length > 0 ? (
          <AppGrid apps={results} iconSize={iconSize} rowGap={OVERLAY_GRID_ROW_GAP} />
        ) : (
          <Text style={styles.noResults}>No apps found</Text>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

// Opening a folder reveals its full contents — same overlay shape as search
// (full-screen, dismiss button top-right), reusing AppGrid since a folder's
// contents are just a plain RealApp list once opened.
function FolderOverlay({
  folder,
  onClose,
  iconSize,
  bottomPadding,
}: {
  folder: Folder;
  onClose: () => void;
  iconSize: number;
  bottomPadding: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      testID="app-folder-overlay"
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
      style={styles.overlay}
    >
      <View style={[styles.overlayTopRow, { marginTop: insets.top + 12 }]}>
        <Text style={styles.folderOverlayTitle}>{folder.name}</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.cancelText}>Done</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: GRID_TOP_GAP, paddingBottom: bottomPadding }}>
        <AppGrid apps={folder.apps} iconSize={iconSize} rowGap={OVERLAY_GRID_ROW_GAP} />
      </ScrollView>
    </Animated.View>
  );
}

export function UnlockedView({ onPeek, wallpaper }: UnlockedViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { tileSize, rowGap } = usePageMetrics();
  const searchIconSize = useSearchIconSize();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [openFolder, setOpenFolder] = useState<Folder | null>(null);

  // Drives the page dots directly from the scroll position on the UI thread
  // — see the comment on PageDot for why this replaced a JS onScroll+setState
  // pair (that path re-rendered the whole screen on every scroll frame).
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
  }, []);

  // Root cause of "can't swipe/scroll" on Android found earlier: a plain
  // Pressable ancestor's long-press detection runs through RN's JS-driven
  // responder system, which can win the touch before a nested scrollable
  // child (the pager, or the search TextInput) ever gets it. Gesture.LongPress()
  // interoperates correctly instead — real finger movement or another
  // gesture claiming the touch fails the long-press, while a still finger
  // held for the full duration still triggers Peek.
  const peekLongPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(2000)
        .maxDistance(24)
        .onStart(() => {
          runOnJS(onPeek)();
        }),
    [onPeek],
  );

  const normalizedQuery = normalize(query);
  const filteredApps = normalizedQuery.length > 0
    ? REAL_APPS.filter((app) => normalize(app.name).includes(normalizedQuery))
    : [];

  return (
    <GestureDetector gesture={peekLongPress}>
      <View testID="unlocked-screen" style={styles.flex}>
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

        {/* Always mounted, even while the search overlay is open — that way
            reopening search doesn't lose your page position. */}
        <View style={[styles.flex, { paddingTop: insets.top + GRID_TOP_GAP }]}>
          <Animated.ScrollView
            testID="app-menu-pager"
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            style={styles.flex}
          >
            {PAGES.map((items, i) => (
              <View key={i} style={{ width }}>
                <HomeAppGrid items={items} iconSize={tileSize} rowGap={rowGap} onOpenFolder={setOpenFolder} />
              </View>
            ))}
          </Animated.ScrollView>

          <Animated.View
            entering={FadeIn.duration(150)}
            style={[styles.pageDots, { marginBottom: SEARCH_PILL_MARGIN_TOP }]}
          >
            {PAGES.map((_, i) => (
              <PageDot key={i} index={i} scrollX={scrollX} pageWidth={width} />
            ))}
          </Animated.View>

          <Animated.View
            entering={FadeIn.duration(150)}
            style={[styles.searchPillRow, { marginBottom: SEARCH_PILL_MARGIN_BOTTOM }]}
          >
            <SearchPill onPress={() => setSearchOpen(true)} />
          </Animated.View>

          <View style={{ marginBottom: DOCK_MARGIN_BOTTOM }}>
            <Dock size={tileSize} />
          </View>

          <Animated.View
            entering={FadeIn.duration(150)}
            style={[styles.homeIndicator, { backgroundColor: colors.onSurface, marginBottom: insets.bottom }]}
          />
        </View>

        {searchOpen && (
          <SearchOverlay
            query={query}
            onChangeText={setQuery}
            onClose={closeSearch}
            results={filteredApps}
            iconSize={searchIconSize}
            bottomPadding={insets.bottom + OVERLAY_TOP_ROW_BLOCK}
          />
        )}

        {openFolder && (
          <FolderOverlay
            folder={openFolder}
            onClose={() => setOpenFolder(null)}
            iconSize={searchIconSize}
            bottomPadding={insets.bottom + OVERLAY_TOP_ROW_BLOCK}
          />
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    paddingHorizontal: GRID_H_PADDING,
  },
  appSlot: {
    width: `${100 / COLUMNS}%`,
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    paddingHorizontal: 4,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    includeFontPadding: false,
  },
  appLabel: {
    fontSize: 11,
    lineHeight: 13,
    marginTop: 6,
    paddingHorizontal: 4,
    textAlign: "center",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  noResults: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  pageDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  searchPillRow: {
    alignItems: "center",
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: "hidden",
  },
  searchPillText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
  },
  dock: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginHorizontal: 18,
    borderRadius: 26,
    paddingVertical: DOCK_VERTICAL_PADDING,
    overflow: "hidden",
  },
  folderTile: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    overflow: "hidden",
  },
  homeIndicator: {
    width: 134,
    height: HOME_INDICATOR_BLOCK,
    borderRadius: 3,
    opacity: 0.4,
    alignSelf: "center",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(4,4,8,0.94)",
  },
  overlayTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: GRID_H_PADDING,
  },
  folderOverlayTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  overlayInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: "hidden",
  },
  overlayInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
    padding: 0,
  },
  cancelText: {
    fontSize: 15,
    color: "#0A84FF",
  },
});
