// Shared card container + section label — the basic grouping unit across
// admin, setup, and auth screens.
import { Text, View, type ViewProps } from "react-native";

import { useTheme } from "@/src/theme";

export function Card({ style, ...rest }: ViewProps) {
  const { scheme, colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceSecondary,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
        },
        // Flat dark cards read fine against a near-black page; a light white
        // card on a barely-lighter page needs a whisper of elevation to read
        // as a distinct surface, matching the shadcn "shadow-sm" card.
        scheme === "light" && {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
        style,
      ]}
      {...rest}
    />
  );
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { colors } = useTheme();
  const label = (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 1,
        color: colors.muted,
        marginLeft: 2,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );
  if (!right) {
    return <View style={{ marginTop: 20, marginBottom: 10 }}>{label}</View>;
  }
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 20,
        marginBottom: 10,
      }}
    >
      {label}
      {right}
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}
