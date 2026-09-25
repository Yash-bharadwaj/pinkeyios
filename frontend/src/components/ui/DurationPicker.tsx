import { View } from "react-native";

import { PillChip } from "@/src/components/ui/Chip";

export const DURATION_PRESETS: { label: string; days: number | null }[] = [
  { label: "Lifetime access", days: null },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
];

export function DurationPicker({
  value,
  onChange,
  testIDPrefix = "duration",
}: {
  value: number | null;
  onChange: (days: number | null) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {DURATION_PRESETS.map((p) => (
        <PillChip
          key={p.label}
          testID={`${testIDPrefix}-${p.days ?? "perpetual"}`}
          label={p.label}
          active={value === p.days}
          onPress={() => onChange(p.days)}
        />
      ))}
    </View>
  );
}
