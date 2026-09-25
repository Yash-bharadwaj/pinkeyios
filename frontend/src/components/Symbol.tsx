// Cross-platform symbol. iOS renders a true SF Symbol; other platforms get a
// typographic fallback so the UI never breaks in preview.
import { SymbolView } from "expo-symbols";
import { Platform, Text } from "react-native";

interface SymbolProps {
  name: string; // SF Symbol name (iOS)
  fallback: string; // text glyph fallback
  size?: number;
  color: string;
  testID?: string;
}

export function Symbol({ name, fallback, size = 22, color, testID }: SymbolProps) {
  if (Platform.OS === "ios") {
    return <SymbolView name={name as never} size={size} tintColor={color} testID={testID} />;
  }
  return <Text testID={testID} style={{ fontSize: size, color, lineHeight: size + 4 }}>{fallback}</Text>;
}
