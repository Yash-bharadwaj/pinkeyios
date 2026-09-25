import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { ActivateScreen } from "@/src/auth/ActivateScreen";
import { useAuth } from "@/src/auth/AuthContext";
import { BlockedScreen } from "@/src/auth/BlockedScreen";
import { LoginScreen } from "@/src/auth/LoginScreen";
import { useTheme } from "@/src/theme";

export function Gate() {
  const { gate, blockReason } = useAuth();
  const { colors } = useTheme();

  if (gate === "loading") {
    return (
      <View
        testID="gate-loading"
        style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (gate === "signed-out") return <LoginScreen />;
  if (gate === "needs-activation") return <ActivateScreen />;
  if (gate === "blocked") return <BlockedScreen reason={blockReason} />;

  // open-admin / open-performer → mount the router stack.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
