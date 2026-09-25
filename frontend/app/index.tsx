// PINKEY Performance screen — the spectator-facing simulated lock screen.
// STRICTLY MONOCHROME: no brand colors here (design requirement).
// Performer entry points (invisible to spectators):
//   - long-press "Emergency" → Setup
//   - after unlock, long-press (2s) the screen → Peek

import { Redirect, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { Keypad } from "@/src/components/Keypad";
import { PasscodeDots } from "@/src/components/PasscodeDots";
import { UnlockedView } from "@/src/components/UnlockedView";
import { backspace, createSession, inputDigit } from "@/src/engine/engine";
import {
  getCurrentSession,
  loadConfig,
  setCurrentSession,
} from "@/src/engine/sessionStore";
import type { Session } from "@/src/engine/types";
import { makeStyles } from "@/src/theme";

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

export default function PerformanceScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [dots, setDots] = useState(0);
  const [shakeSignal, setShakeSignal] = useState(0);
  const [now, setNow] = useState(() => new Date());
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
      {unlocked && (
        <Animated.View key="home" entering={FadeIn.duration(380)} style={styles.flex}>
          <UnlockedView
            timeLabel={timeLabel(now)}
            wallpaper={session.config.wallpaper}
            onPeek={() => {
              if (session.config.haptics)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/peek");
            }}
          />
        </Animated.View>
      )}
      {!unlocked && (
        <Animated.View
          key="lock"
          exiting={SlideOutUp.duration(420)}
          style={[
            StyleSheet.absoluteFill,
            styles.container,
            { paddingTop: insets.top, paddingBottom: insets.bottom + 8 },
          ]}
        >
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
}));
