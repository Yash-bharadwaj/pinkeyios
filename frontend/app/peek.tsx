// Hidden Peek view — performer-only. Opened by a 2s long-press on the
// unlocked screen. Shows the reconstructed session at a single glance.

import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createSession, getPeek } from "@/src/engine/engine";
import { getCurrentSession, setCurrentSession } from "@/src/engine/sessionStore";
import type { PeekData } from "@/src/engine/types";
import { makeStyles } from "@/src/theme";

export default function PeekScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [session] = useState(() => getCurrentSession());
  const peek: PeekData | null = session && session.complete ? getPeek(session) : null;

  const newSession = () => {
    if (session) setCurrentSession(createSession(session.config));
    router.back();
  };

  return (
    <View
      testID="peek-screen"
      style={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Peek</Text>
        <Text style={styles.modeTag}>
          {session ? `${session.config.mode} · ${session.config.entryLength} digits` : ""}
        </Text>
      </View>

      {!peek ? (
        <View style={styles.emptyState}>
          <Text testID="peek-empty" style={styles.emptyText}>
            No completed session yet.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>RECONSTRUCTED VALUE</Text>
          <View style={styles.heroCard}>
            <Text testID="peek-reconstructed-value" style={styles.heroValue}>
              {peek.reconstructedValue}
            </Text>
          </View>

          <View style={styles.duoRow}>
            <View style={styles.duoCard}>
              <Text style={styles.duoLabel}>MOCK DATE</Text>
              <Text testID="peek-mock-date" style={styles.duoValue}>
                {peek.mockDateValue}
              </Text>
            </View>
            <View style={styles.duoCard}>
              <Text style={styles.duoLabel}>ASSOCIATED</Text>
              <Text testID="peek-associated-number" style={styles.duoValue}>
                {peek.associatedNumber}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>SOURCE EVENTS</Text>
          <View style={styles.card}>
            {peek.rows.map((row, i) => (
              <View
                key={row.eventId || i}
                testID={`peek-row-${i}`}
                style={[styles.row, i > 0 && styles.rowBorder]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowEvent}>{row.eventId}</Text>
                </View>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <View style={styles.actions}>
        <Pressable testID="new-session-button" style={styles.primaryButton} onPress={newSession}>
          <Text style={styles.primaryLabel}>New Session</Text>
        </Pressable>
        <Pressable
          testID="peek-close-button"
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryLabel}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  modeTag: {
    fontSize: 12,
    color: colors.muted,
    letterSpacing: 0.8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 15,
    color: colors.muted,
  },
  scroll: {
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.muted,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  heroCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.brandTertiary,
    paddingVertical: 28,
    alignItems: "center",
  },
  heroValue: {
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: 6,
    color: colors.brandPrimary,
    fontVariant: ["tabular-nums"],
  },
  duoRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  duoCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  duoLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
  },
  duoValue: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.onSurfaceSecondary,
  },
  rowEvent: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.brandSecondary,
    fontVariant: ["tabular-nums"],
  },
  actions: {
    gap: 10,
    paddingTop: 8,
  },
  primaryButton: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.onBrandPrimary,
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryLabel: {
    fontSize: 15,
    color: colors.onSurfaceSecondary,
  },
}));
