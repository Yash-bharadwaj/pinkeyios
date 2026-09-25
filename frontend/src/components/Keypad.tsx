// PINKEY custom numeric keypad — spectator-facing.
// STRICTLY MONOCHROME (surface/onSurface only): never brand colors here.

import * as Haptics from "expo-haptics";
import { createAudioPlayer } from "expo-audio";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { makeStyles, type ThemeColors } from "@/src/theme";

import { Symbol } from "./Symbol";

const KEY_SIZE = 76;
const ROW_GAP = 18;
const COL_GAP = 22;

// Small pool of preloaded click players for lag-free, overlapping key sounds.
// Lazily created on first press (audio requires a user gesture on some platforms).
let clickPlayers: ReturnType<typeof createAudioPlayer>[] | null = null;
let poolIndex = 0;

function playClick() {
  try {
    if (!clickPlayers) {
      clickPlayers = [0, 1, 2].map(() =>
        createAudioPlayer(require("../../assets/sounds/click.wav")),
      );
    }
    const player = clickPlayers[poolIndex++ % clickPlayers.length];
    player.seekTo(0);
    player.play();
  } catch {
    // Sound is best-effort; never let audio break a performance.
  }
}

interface KeypadProps {
  onDigit: (digit: number) => void;
  onDelete: () => void;
  canDelete: boolean;
  onSecretSetup: () => void;
  hapticsEnabled: boolean;
  soundsEnabled: boolean;
}

function Key({
  label,
  onPress,
  colors,
  styles,
  testID,
}: {
  label: string;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof useStyles>;
  testID: string;
}) {
  const scale = useSharedValue(1);
  const fill = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    // interpolateColor (not a hand-built rgba template string) is the safe
    // way to animate a color in a worklet — a manually interpolated string
    // can hand Reanimated's native color parser a value it rejects
    // ("Invalid color value") once the alpha channel isn't a clean decimal.
    backgroundColor: interpolateColor(fill.value, [0, 1], ["rgba(245,245,245,0)", "rgba(245,245,245,0.16)"]),
  }));
  return (
    <Pressable
      testID={testID}
      hitSlop={10}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.9, { duration: 60 });
        fill.value = withTiming(1, { duration: 60 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 140 });
        fill.value = withTiming(0, { duration: 180 });
      }}
    >
      <Animated.View style={[styles.key, animatedStyle]}>
        <Text style={styles.keyLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function Keypad({
  onDigit,
  onDelete,
  canDelete,
  onSecretSetup,
  hapticsEnabled,
  soundsEnabled,
}: KeypadProps) {
  const styles = useStyles();

  const pressDigit = useCallback(
    (digit: number) => {
      if (hapticsEnabled) Haptics.selectionAsync();
      if (soundsEnabled) playClick();
      onDigit(digit);
    },
    [hapticsEnabled, soundsEnabled, onDigit],
  );

  const pressDelete = useCallback(() => {
    if (hapticsEnabled) Haptics.selectionAsync();
    if (soundsEnabled) playClick();
    onDelete();
  }, [hapticsEnabled, soundsEnabled, onDelete]);

  const rows = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];

  return (
    <View testID="keypad" style={styles.keypad}>
      {rows.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((digit) => (
            <Key
              key={digit}
              label={String(digit)}
              testID={`keypad-digit-${digit}`}
              onPress={() => pressDigit(digit)}
              colors={styles.colors}
              styles={styles}
            />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.sideSlot}>
          {/* Discreet performer entry: long-press "Emergency" opens setup. */}
          <Pressable
            testID="keypad-emergency"
            delayLongPress={1200}
            onLongPress={onSecretSetup}
            hitSlop={12}
          >
            <Text style={styles.sideLabel}>Emergency</Text>
          </Pressable>
        </View>
        <Key
          label="0"
          testID="keypad-digit-0"
          onPress={() => pressDigit(0)}
          colors={styles.colors}
          styles={styles}
        />
        <View style={styles.sideSlot}>
          {canDelete ? (
            <Pressable testID="keypad-delete" onPress={pressDelete} hitSlop={12}>
              <Symbol name="delete.left" fallback="⌫" size={26} color={styles.colors.onSurface} />
            </Pressable>
          ) : (
            <Text style={styles.sideLabel}>Cancel</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  colors, // passed through to Key for the delete symbol tint
  keypad: {
    alignItems: "center",
    gap: ROW_GAP,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: COL_GAP,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  keyLabel: {
    fontSize: 30,
    color: colors.onSurface,
    fontVariant: ["tabular-nums"],
  },
  sideSlot: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  sideLabel: {
    fontSize: 15,
    color: colors.onSurface,
  },
}));
