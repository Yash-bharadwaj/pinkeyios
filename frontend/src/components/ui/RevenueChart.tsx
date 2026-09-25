// Monthly revenue bar chart — one shared amount axis, a fixed categorical hue
// per currency (validated per-scheme for CVD safety against the dashboard's
// actual card surface), and a tap-to-inspect detail row standing in for hover
// (this is a touch surface, not a mouse one).
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { MonthlyBucket } from "@/src/api";
import { CURRENCY_SYMBOL, currencyColor } from "@/src/constants/currency";
import { useTheme } from "@/src/theme";

const CHART_HEIGHT = 100;
const BAR_WIDTH = 10;

export function RevenueChart({ monthly }: { monthly: MonthlyBucket[] }) {
  const { colors, scheme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    monthly.forEach((m) => Object.keys(m.by_currency).forEach((c) => set.add(c)));
    return Array.from(set);
  }, [monthly]);

  const max = useMemo(() => {
    let m = 0;
    monthly.forEach((bucket) =>
      Object.values(bucket.by_currency).forEach((v) => {
        if (v.total > m) m = v.total;
      }),
    );
    return m || 1;
  }, [monthly]);

  const lastWithData = [...monthly].reverse().find((m) => Object.keys(m.by_currency).length > 0);
  const activeMonth = selected ?? lastWithData?.month ?? monthly[monthly.length - 1]?.month;
  const activeBucket = monthly.find((m) => m.month === activeMonth) ?? monthly[monthly.length - 1];

  if (!monthly.length) return null;

  return (
    <View>
      {currencies.length > 1 && (
        <View style={{ flexDirection: "row", gap: 14, marginBottom: 12 }}>
          {currencies.map((c) => (
            <View key={c} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: currencyColor(c, scheme) }} />
              <Text style={{ fontSize: 12, color: colors.muted }}>{c}</Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: CHART_HEIGHT, gap: 12, paddingHorizontal: 2 }}>
          {monthly.map((bucket) => {
            const isSelected = bucket.month === activeMonth;
            const seriesForBucket = currencies.length ? currencies : [];
            return (
              <Pressable
                key={bucket.month}
                testID={`revenue-bar-${bucket.month}`}
                onPress={() => setSelected(bucket.month)}
                style={{ alignItems: "center", width: 32 }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: CHART_HEIGHT - 20 }}>
                  {seriesForBucket.length === 0 ? (
                    <View style={{ width: BAR_WIDTH, height: 2, borderRadius: 1, backgroundColor: colors.border }} />
                  ) : (
                    seriesForBucket.map((c) => {
                      const v = bucket.by_currency[c]?.total ?? 0;
                      const h = v > 0 ? Math.max(3, (v / max) * (CHART_HEIGHT - 20)) : 2;
                      return (
                        <View
                          key={c}
                          style={{
                            width: BAR_WIDTH,
                            height: h,
                            borderRadius: 3,
                            backgroundColor: v > 0 ? currencyColor(c, scheme) : colors.border,
                            opacity: isSelected || v === 0 ? 1 : 0.55,
                          }}
                        />
                      );
                    })
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 10,
                    color: isSelected ? colors.onSurface : colors.muted,
                    marginTop: 6,
                    fontWeight: isSelected ? "700" : "400",
                  }}
                >
                  {bucket.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
        <Text testID="revenue-detail-month" style={{ fontSize: 12, color: colors.muted }}>
          {activeBucket?.label ?? ""}
        </Text>
        {!activeBucket || Object.keys(activeBucket.by_currency).length === 0 ? (
          <Text style={{ fontSize: 15, color: colors.onSurface, marginTop: 2 }}>No sales</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 4 }}>
            {Object.entries(activeBucket.by_currency).map(([c, v]) => (
              <View key={c}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.onSurface }}>
                  {CURRENCY_SYMBOL[c] ?? ""}
                  {v.total.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
                  {c} · {v.count} sale{v.count === 1 ? "" : "s"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
