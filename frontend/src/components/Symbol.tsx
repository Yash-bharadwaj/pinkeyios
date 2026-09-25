// Universal icon renderer. Renders via Ionicons (a bundled font, MIT-licensed,
// part of @expo/vector-icons) on every platform — no native per-OS symbol
// lookup, so there's nothing that can silently fail to link or render. Call
// sites keep using SF-Symbol-style names (this app's existing convention);
// SF_TO_IONICON below is the one place that maps them to a real Ionicons glyph.
import { Ionicons } from "@expo/vector-icons";
import type { StyleProp, TextStyle } from "react-native";

interface SymbolProps {
  name: string; // SF-Symbol-style name — looked up in SF_TO_IONICON below
  fallback: string; // unused now (kept so existing call sites don't need edits)
  size?: number;
  color: string;
  testID?: string;
  style?: StyleProp<TextStyle>;
}

const SF_TO_IONICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  "app.badge": "apps",
  "arrow.clockwise": "refresh",
  "bolt.fill": "flash",
  calendar: "calendar",
  "camera.fill": "camera",
  cellularbars: "cellular",
  circle: "ellipse-outline",
  checkmark: "checkmark",
  "checkmark.circle.fill": "checkmark-circle",
  "checkmark.seal.fill": "checkmark-circle",
  "checkmark.shield": "shield-checkmark",
  checklist: "checkbox",
  "chart.line.uptrend.xyaxis": "trending-up",
  "chevron.down": "chevron-down",
  "chevron.left": "chevron-back",
  "chevron.up": "chevron-up",
  "clock.fill": "time",
  "cloud.sun.fill": "partly-sunny",
  "delete.left": "backspace-outline",
  "doc.on.doc": "copy-outline",
  "envelope.fill": "mail",
  "line.3.horizontal.decrease.circle": "filter",
  "exclamationmark.triangle.fill": "warning",
  eye: "eye",
  "eye.slash": "eye-off",
  "folder.fill": "folder",
  "gearshape.fill": "settings",
  "hand.tap": "pulse",
  "heart.fill": "heart",
  "house.fill": "home",
  "iphone.slash": "phone-portrait-outline",
  key: "key",
  "list.number": "list",
  "location.fill": "location",
  "lock.slash": "lock-closed",
  "map.fill": "map",
  "message.fill": "chatbubble-ellipses",
  "mic.fill": "mic",
  "music.note": "musical-notes",
  "note.text": "document-text",
  number: "keypad",
  "person.crop.circle.fill": "person-circle",
  "person.slash": "person-remove",
  "phone.fill": "call",
  photo: "images",
  "photo.fill": "images",
  plus: "add",
  "rectangle.portrait.and.arrow.right": "log-out-outline",
  safari: "compass",
  "magnifyingglass": "search",
  "bell.fill": "notifications",
  shuffle: "shuffle",
  "square.and.arrow.up": "share-outline",
  "square.stack.3d.up.fill": "layers",
  "arrow.left.arrow.right": "swap-horizontal",
  trash: "trash",
  "tv.fill": "tv",
  "video.fill": "videocam",
  "wallet.pass.fill": "wallet",
  wifi: "wifi",
  xmark: "close",
  "xmark.circle.fill": "close-circle",
  "xmark.shield": "shield",
  "battery.100": "battery-full",
  "battery.75": "battery-full",
  "battery.50": "battery-half",
  "battery.25": "battery-dead",
  "battery.0": "battery-dead",
};

export function Symbol({ name, size = 22, color, testID, style }: SymbolProps) {
  const iconName = SF_TO_IONICON[name] ?? "help-circle-outline";
  return <Ionicons name={iconName} size={size} color={color} testID={testID} style={style} />;
}
