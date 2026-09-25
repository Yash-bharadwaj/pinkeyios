// A clean, collapsible settings list — replaces a stack of separate boxes
// with one grouped card whose rows expand to reveal their controls, each
// with a one-line explanation of what the feature does.
import { useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  UIManager,
  View,
} from "react-native";

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
        paddingHorizontal: 16,
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
  testID,
  children,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  last?: boolean;
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
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <Pressable
        testID={testID}
        onPress={toggle}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 }}
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
        <View style={{ paddingBottom: 18 }}>
          <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 14 }}>
            {description}
          </Text>
          {children}
        </View>
      )}
    </View>
  );
}
