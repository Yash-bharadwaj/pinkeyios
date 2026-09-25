// A clean, collapsible settings list — replaces a stack of separate boxes
// with one grouped card whose rows expand to reveal their controls, each
// with a one-line explanation of what the feature does.
import { useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Symbol } from "@/src/components/Symbol";
import { useTheme } from "@/src/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function Accordion({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surfaceSecondary,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

export function AccordionItem({
  title,
  description,
  icon,
  defaultOpen,
  last,
  active,
  testID,
  children,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  last?: boolean;
  active?: boolean;
  testID?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(!!defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));
    setOpen((o) => !o);
  };

  return (
    <View
      style={
        // The accordion's own paddingHorizontal moved down into the row
        // content below (see Pressable/body), so every item — active or
        // not — is naturally full-width here. That means an ordinary,
        // plain border already reads as "spans the whole card" with no
        // bleed/negative-margin trick needed, which is what made the
        // border unreliable across platforms before.
        active
          ? { borderWidth: 1, borderColor: colors.success }
          : { borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }
      }
    >
      {active && (
        // A whisper of green from the top, fading to nothing by mid-card —
        // just enough to read as "premium," not a flat tint.
        <LinearGradient
          testID="accordion-active-gradient"
          colors={["rgba(52,199,89,0.14)", "rgba(52,199,89,0.03)", "rgba(52,199,89,0)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Pressable
        testID={testID}
        onPress={toggle}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, paddingHorizontal: 16 }}
      >
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.onSurface }}>{title}</Text>
          {!open && (
            <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              {description}
            </Text>
          )}
        </View>
        <Symbol
          name={open ? "chevron.up" : "chevron.down"}
          fallback={open ? "▲" : "▼"}
          size={13}
          color={colors.muted}
        />
      </Pressable>
      {open && (
        <View style={{ paddingBottom: 18, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 14 }}>
            {description}
          </Text>
          {children}
        </View>
      )}
    </View>
  );
}
