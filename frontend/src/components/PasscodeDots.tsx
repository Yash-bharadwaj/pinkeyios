// Passcode indicator dots — spectator-facing (strictly monochrome).
// Fills left-to-right like a native passcode field; shakes on wrong attempt.

import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { makeStyles } from "@/src/theme";

interface PasscodeDotsProps {
  length: number;
  filled: number;
  shakeSignal: number; // increment to trigger the wrong-attempt shake
}

export function PasscodeDots({ length, filled, shakeSignal }: PasscodeDotsProps) {
  const styles = useStyles();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (shakeSignal > 0) {
      offset.value = withSequence(
        withTiming(-12, { duration: 55 }),
        withTiming(12, { duration: 55 }),
        withTiming(-9, { duration: 55 }),
        withTiming(9, { duration: 55 }),
        withTiming(0, { duration: 55 }),
      );
    }
  }, [shakeSignal, offset]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <Animated.View testID="passcode-dots" style={[styles.row, shakeStyle]}>
      {Array.from({ length }, (_, i) => (
        <View
          key={i}
          testID={`passcode-dot-${i}`}
          style={[styles.dot, i < filled && styles.dotFilled]}
        />
      ))}
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: {
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.onSurface,
  },
  dotFilled: {
    backgroundColor: colors.onSurface,
  },
}));
