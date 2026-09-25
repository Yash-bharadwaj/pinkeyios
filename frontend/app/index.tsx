// PINKEY Performance screen — the spectator-facing simulated lock screen.
// STRICTLY MONOCHROME: no brand colors here (design requirement).
// Performer entry points (invisible to spectators):
//   - long-press "Emergency" → Setup
//   - after unlock, long-press (2s) the screen → Peek
//
// Real iPhone flow: waking the screen shows a plain lock screen (clock, date,
// nothing else) — the passcode keypad only appears after a swipe up. This
// screen mirrors that: `revealed` gates the passcode UI behind a swipe-up
// gesture on the plain lock screen, and resets whenever a fresh session
// starts (first load, or "New Session" from Peek) so each new spectator sees
// the same real-feeling wake → swipe → passcode sequence.

import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Directions, Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  SlideInUp,
  SlideOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { Keypad } from "@/src/components/Keypad";
import { PasscodeDots } from "@/src/components/PasscodeDots";
import { Symbol } from "@/src/components/Symbol";
import { UnlockedView } from "@/src/components/UnlockedView";
import { resolveWallpaper } from "@/src/components/wallpapers";
import { backspace, createSession, inputDigit } from "@/src/engine/engine";
import {
  getCurrentSession,
  loadConfig,
  setCurrentSession,
} from "@/src/engine/sessionStore";
import type { Session } from "@/src/engine/types";
import { makeStyles, useTheme } from "@/src/theme";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function timeLabel(d: Date): string {
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dateLabel(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// Small bouncing chevron — the same "there's more above" affordance real
// lock screens use to hint at the swipe-up gesture.
function SwipeHint({ color }: { color: string }) {
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 550 }),
        withTiming(0, { duration: 550 }),
      ),
      -1,
      true,
    );
  }, [offset]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <Animated.View style={style}>
      <Symbol name="chevron.up" fallback="" size={22} color={color} />
    </Animated.View>
  );
}

export default function PerformanceScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [dots, setDots] = useState(0);
  const [shakeSignal, setShakeSignal] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [revealed, setRevealed] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applySession = useCallback((next: Session) => {
    sessionRef.current = next;
    setCurrentSession(next);
    setSession(next);
  }, []);

  // (Re)load on focus: first mount, returning from Setup (new config),
  // or returning from Peek after "New Session".
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const stored = getCurrentSession();
        if (stored) {
          if (active) {
            applySession(stored);
            setDots(stored.visibleCount);
          }
          return;
        }
        const config = await loadConfig();
        if (!active) return;
        applySession(createSession(config));
        setDots(0);
      })();
      return () => {
        active = false;
      };
    }, [applySession]),
  );

  // Live clock — heightens the lock-screen illusion.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Each fresh session (first load, or "New Session" from Peek) gets its own
  // new session id — re-arm the swipe-up gate so it plays out again.
  useEffect(() => {
    setRevealed(false);
  }, [session?.id]);

  const reveal = useCallback(() => {
    setRevealed(true);
    if (sessionRef.current?.config.haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const swipeUpGesture = useMemo(
    () =>
      Gesture.Fling()
        .direction(Directions.UP)
        .onEnd(() => {
          runOnJS(reveal)();
        }),
    [reveal],
  );

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    },
    [],
  );

  const handleDigit = useCallback(
    (digit: number) => {
      const current = sessionRef.current;
      if (!current) return;
      const next = inputDigit(current, digit);
      if (next === current) return;

      if (next.lastEffect === "attempt-failed") {
        // Fill → shake → clear (reads as a wrong passcode to the spectator).
        applySession(next);
        setDots(next.config.entryLength);
        setShakeSignal((k) => k + 1);
        if (next.config.haptics)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        flashTimer.current = setTimeout(() => setDots(0), 480);
      } else if (
        next.lastEffect === "flash-delete" ||
        next.lastEffect === "flash-filler"
      ) {
        // Digit appears briefly, then vanishes.
        applySession(next);
        setDots(next.visibleCount + 1);
        flashTimer.current = setTimeout(() => setDots(next.visibleCount), 300);
      } else if (next.lastEffect === "unlock") {
        // Let the final dot land for a beat, then the phone "opens":
        // lock screen slides up, home screen fades in with staggered icons.
        setDots(next.config.entryLength);
        if (next.config.haptics)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        unlockTimer.current = setTimeout(() => applySession(next), 380);
      } else {
        applySession(next);
        setDots(next.visibleCount);
      }
    },
    [applySession],
  );

  const handleDelete = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    const next = backspace(current);
    if (next === current) return;
    applySession(next);
    setDots(next.visibleCount);
  }, [applySession]);

  if (!session) {
    // No spinner — a spinner would kill the lock-screen illusion.
    return <View testID="performance-screen" style={styles.container} />;
  }

  // Admin (owner) goes to the dashboard, not the performance surface.
  if (profile?.role === "admin") {
    return <Redirect href="/admin" />;
  }

  const unlocked = session.status === "UNLOCKED";

  return (
    <View testID="performance-screen" style={styles.container}>
      {/* Real device status bar, not a hand-drawn one — just make it light so
          it reads clearly over the dark wallpaper scrim. */}
      <StatusBar style="light" />
      {unlocked && (
        <Animated.View key="home" entering={FadeIn.duration(380)} style={styles.flex}>
          <UnlockedView
            wallpaper={session.config.wallpaper}
            onPeek={() => {
              if (session.config.haptics)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/peek");
            }}
          />
        </Animated.View>
      )}
      {!revealed && (
        <GestureDetector gesture={swipeUpGesture}>
          <Animated.View
            key="prelock"
            entering={FadeIn.duration(300)}
            exiting={SlideOutUp.duration(380).easing(Easing.in(Easing.cubic))}
            style={[
              StyleSheet.absoluteFill,
              styles.container,
              styles.preLockLayout,
              { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
            ]}
          >
            <Image
              testID="lock-wallpaper"
              source={resolveWallpaper(session.config.lockWallpaper)}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <LinearGradient
              colors={["rgba(5,5,8,0.25)", "rgba(5,5,8,0.15)", "rgba(5,5,8,0.55)"]}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.preLockTop}>
              <Text testID="lock-clock" style={styles.clock}>
                {timeLabel(now)}
              </Text>
              <Text testID="lock-date" style={styles.date}>
                {dateLabel(now)}
              </Text>
            </View>
            <View style={styles.preLockHint}>
              <SwipeHint color={colors.onSurface} />
              <Text style={styles.hintText}>Swipe up to open</Text>
            </View>
          </Animated.View>
        </GestureDetector>
      )}
      {revealed && !unlocked && (
        <Animated.View
          key="lock"
          entering={SlideInUp.duration(420).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutUp.duration(420)}
          style={[
            StyleSheet.absoluteFill,
            styles.container,
            { paddingTop: insets.top, paddingBottom: insets.bottom + 8 },
          ]}
        >
          <Image
            testID="lock-wallpaper"
            source={resolveWallpaper(session.config.lockWallpaper)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(5,5,8,0.3)", "rgba(5,5,8,0.35)", "rgba(5,5,8,0.7)"]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.top}>
            <Text testID="lock-clock" style={styles.clock}>
              {timeLabel(now)}
            </Text>
            <Text testID="lock-date" style={styles.date}>
              {dateLabel(now)}
            </Text>
            <View style={styles.promptBlock}>
              <Text testID="passcode-prompt" style={styles.prompt}>
                Enter Passcode
              </Text>
              <PasscodeDots
                length={session.config.entryLength}
                filled={dots}
                shakeSignal={shakeSignal}
              />
            </View>
          </View>
          <View style={styles.bottom}>
            <Keypad
              onDigit={handleDigit}
              onDelete={handleDelete}
              canDelete={session.buffer.length > 0}
              onCancel={() => setRevealed(false)}
              onSecretSetup={() => router.push("/setup")}
              hapticsEnabled={session.config.haptics}
              soundsEnabled={session.config.sounds}
            />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  top: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 40,
  },
  clock: {
    fontSize: 72,
    fontWeight: "200",
    color: colors.onSurface,
    fontVariant: ["tabular-nums"],
  },
  date: {
    fontSize: 16,
    color: colors.muted,
    marginTop: 2,
  },
  promptBlock: {
    alignItems: "center",
    marginTop: 48,
    gap: 20,
  },
  prompt: {
    fontSize: 15,
    color: colors.onSurface,
    letterSpacing: 0.3,
  },
  bottom: {
    flex: 1.35,
    justifyContent: "flex-start",
  },
  preLockLayout: {
    justifyContent: "space-between",
  },
  preLockTop: {
    alignItems: "center",
    paddingTop: 28,
  },
  preLockHint: {
    alignItems: "center",
    gap: 6,
  },
  hintText: {
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.8,
    letterSpacing: 0.2,
  },
}));
