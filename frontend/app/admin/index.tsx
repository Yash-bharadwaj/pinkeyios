import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  adminDeleteUser,
  adminListUsers,
  adminResetPassword,
  adminSalesSummary,
  adminSetLicense,
  adminSetUserStatus,
  adminUnbindDevices,
  type AdminUser,
} from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";
import { Symbol } from "@/src/components/Symbol";
import { makeStyles } from "@/src/theme";

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", INR: "₹", EUR: "€" };

export default function AdminDashboard() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, profile } = useAuth();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState("");
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");

  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: adminListUsers });
  const summaryQuery = useQuery({ queryKey: ["admin", "summary"], queryFn: adminSalesSummary });

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "summary"] });
  };

  const licenseMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" | "revoked" }) =>
      adminSetLicense(id, status),
    onSuccess: (_d, v) => {
      invalidate();
      flash(v.status === "active" ? "License reactivated" : `License ${v.status}`);
      setSelected(null);
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ uid, disabled }: { uid: string; disabled: boolean }) =>
      adminSetUserStatus(uid, disabled),
    onSuccess: (_d, v) => {
      invalidate();
      flash(v.disabled ? "Account disabled" : "Account enabled");
      setSelected(null);
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const unbindMutation = useMutation({
    mutationFn: (licenseId: string) => adminUnbindDevices(licenseId),
    onSuccess: (d) => {
      invalidate();
      flash(`Unbound ${d.removed} device(s)`);
      setSelected(null);
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (uid: string) => adminDeleteUser(uid),
    onSuccess: () => {
      invalidate();
      flash("User deleted");
      setSelected(null);
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const resetPwMutation = useMutation({
    mutationFn: ({ uid, password }: { uid: string; password: string }) =>
      adminResetPassword(uid, password),
    onSuccess: () => {
      flash("Password reset");
      setResetPwOpen(false);
      setNewPw("");
      setSelected(null);
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const summary = summaryQuery.data;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>PINKEY Admin</Text>
          <Text style={styles.subtitle}>{profile?.email}</Text>
        </View>
        <Pressable testID="admin-logout-button" onPress={logout} hitSlop={10}>
          <Symbol name="rectangle.portrait.and.arrow.right" fallback="⎋" size={22} color={styles.colors.muted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Revenue summary */}
        <Text style={styles.sectionLabel}>REVENUE</Text>
        <View style={styles.summaryGrid}>
          {summary &&
            Object.entries(summary.by_currency).map(([cur, v]) => (
              <View key={cur} style={styles.summaryCard} testID={`summary-${cur}`}>
                <Text style={styles.summaryValue}>
                  {CURRENCY_SYMBOL[cur] ?? ""}
                  {v.total.toLocaleString()}
                </Text>
                <Text style={styles.summaryCaption}>{cur} · {v.count} sales</Text>
              </View>
            ))}
          {summary && Object.keys(summary.by_currency).length === 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>—</Text>
              <Text style={styles.summaryCaption}>No paid sales yet</Text>
            </View>
          )}
        </View>
        {summary && (
          <View style={styles.statsRow}>
            <Stat label="Users" value={summary.total_users} styles={styles} />
            <Stat label="Active" value={summary.active_licenses} styles={styles} />
            <Stat label="Paid" value={summary.paid_count} styles={styles} />
            <Stat label="Free" value={summary.free_count} styles={styles} />
          </View>
        )}

        {/* Users */}
        <View style={styles.usersHeader}>
          <Text style={styles.sectionLabel}>MAGICIANS ({usersQuery.data?.count ?? 0})</Text>
          <Pressable
            testID="admin-create-user-button"
            style={styles.createButton}
            onPress={() => router.push("/admin/create-user")}
          >
            <Symbol name="plus" fallback="+" size={16} color={styles.colors.onBrandPrimary} />
            <Text style={styles.createLabel}>New</Text>
          </Pressable>
        </View>

        {usersQuery.isLoading && <ActivityIndicator color={styles.colors.brandPrimary} style={{ marginTop: 24 }} />}
        {usersQuery.data?.users.length === 0 && (
          <Text style={styles.emptyText}>No magicians yet. Tap “New” to create one.</Text>
        )}
        {usersQuery.data?.users.map((u) => (
          <Pressable
            key={u.id}
            testID={`user-card-${u.email}`}
            style={styles.userCard}
            onPress={() => setSelected(u)}
          >
            <View style={styles.userTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userEmail}>{u.email}</Text>
                {!!u.name && <Text style={styles.userName}>{u.name}</Text>}
              </View>
              <Badge
                text={u.status === "active" ? (u.license?.status ?? "—") : u.status}
                tone={
                  u.status !== "active"
                    ? "error"
                    : u.license?.status === "active"
                      ? "success"
                      : "warning"
                }
                styles={styles}
              />
            </View>
            <View style={styles.userMeta}>
              <Text style={styles.licenseKey}>{u.license?.key ?? "no license"}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>
                {u.devices.length > 0 ? "device bound" : "not activated"}
              </Text>
              {u.sale && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>
                    {u.sale.is_free
                      ? "FREE"
                      : `${CURRENCY_SYMBOL[u.sale.currency] ?? ""}${u.sale.amount}`}
                    {u.sale.refunded ? " (refunded)" : ""}
                  </Text>
                </>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Toast */}
      {!!toast && (
        <View style={[styles.toast, { bottom: insets.bottom + 24 }]} testID="admin-toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Action sheet */}
      {selected && (
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => {
              setSelected(null);
              setResetPwOpen(false);
            }}
            testID="action-sheet-backdrop"
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>{selected.email}</Text>
            <Text style={styles.sheetSub}>
              {selected.license?.key} · {selected.license?.status}
            </Text>

            {resetPwOpen ? (
              <View style={{ gap: 10, marginTop: 8 }}>
                <TextInput
                  testID="reset-password-input"
                  style={styles.pwInput}
                  value={newPw}
                  onChangeText={setNewPw}
                  placeholder="New password (min 6)"
                  placeholderTextColor={styles.colors.muted}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Pressable
                  testID="reset-password-confirm"
                  style={styles.actionPrimary}
                  onPress={() =>
                    newPw.length >= 6
                      ? resetPwMutation.mutate({ uid: selected.id, password: newPw })
                      : flash("Password too short")
                  }
                >
                  <Text style={styles.actionPrimaryLabel}>Set Password</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ marginTop: 8 }}>
                {selected.license?.status === "active" ? (
                  <SheetAction
                    testID="action-revoke"
                    label="Revoke license"
                    icon="xmark.shield"
                    tone="error"
                    styles={styles}
                    onPress={() => licenseMutation.mutate({ id: selected.license!.id, status: "revoked" })}
                  />
                ) : (
                  <SheetAction
                    testID="action-reactivate"
                    label="Reactivate license"
                    icon="checkmark.shield"
                    tone="success"
                    styles={styles}
                    onPress={() => licenseMutation.mutate({ id: selected.license!.id, status: "active" })}
                  />
                )}
                <SheetAction
                  testID="action-unbind"
                  label="Unbind device"
                  icon="iphone.slash"
                  styles={styles}
                  onPress={() => unbindMutation.mutate(selected.license!.id)}
                />
                <SheetAction
                  testID="action-toggle-status"
                  label={selected.status === "active" ? "Disable account" : "Enable account"}
                  icon="person.slash"
                  styles={styles}
                  onPress={() =>
                    statusMutation.mutate({ uid: selected.id, disabled: selected.status === "active" })
                  }
                />
                <SheetAction
                  testID="action-reset-password"
                  label="Reset password"
                  icon="key"
                  styles={styles}
                  onPress={() => setResetPwOpen(true)}
                />
                <SheetAction
                  testID="action-delete"
                  label="Delete user"
                  icon="trash"
                  tone="error"
                  styles={styles}
                  onPress={() => deleteMutation.mutate(selected.id)}
                />
              </View>
            )}

            <Pressable
              testID="action-close"
              style={styles.sheetClose}
              onPress={() => {
                setSelected(null);
                setResetPwOpen(false);
              }}
            >
              <Text style={styles.sheetCloseLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function Stat({ label, value, styles }: { label: string; value: number; styles: any }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Badge({ text, tone, styles }: { text: string; tone: string; styles: any }) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{text}</Text>
    </View>
  );
}

function SheetAction({
  label,
  icon,
  onPress,
  tone,
  styles,
  testID,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  tone?: string;
  styles: any;
  testID: string;
}) {
  const color = tone === "error" ? styles.colors.error : tone === "success" ? styles.colors.success : styles.colors.onSurface;
  return (
    <Pressable testID={testID} style={styles.sheetAction} onPress={onPress}>
      <Symbol name={icon} fallback="•" size={20} color={color} />
      <Text style={[styles.sheetActionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  colors,
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.brandPrimary },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  sectionLabel: { fontSize: 12, letterSpacing: 1.2, color: colors.muted, marginTop: 20, marginBottom: 10 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  summaryCard: {
    flexGrow: 1,
    minWidth: "45%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.brandTertiary,
    padding: 18,
  },
  summaryValue: { fontSize: 30, fontWeight: "800", color: colors.brandPrimary, fontVariant: ["tabular-nums"] },
  summaryCaption: { fontSize: 12, color: colors.muted, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.onSurface, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  usersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandPrimary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 10,
  },
  createLabel: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 14 },
  emptyText: { color: colors.muted, fontSize: 14, marginTop: 24, textAlign: "center" },
  userCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 12,
  },
  userTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  userEmail: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  userName: { fontSize: 13, color: colors.muted, marginTop: 2 },
  userMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" },
  licenseKey: { fontSize: 13, color: colors.brandSecondary, fontVariant: ["tabular-nums"] },
  metaDot: { color: colors.muted },
  metaText: { fontSize: 12, color: colors.muted },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badge_success: { backgroundColor: "rgba(52,199,89,0.15)" },
  badge_warning: { backgroundColor: "rgba(255,159,10,0.15)" },
  badge_error: { backgroundColor: "rgba(255,69,58,0.15)" },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  badgeText_success: { color: colors.success },
  badgeText_warning: { color: colors.warning },
  badgeText_error: { color: colors.error },
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.surfaceInverse,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  toastText: { color: colors.onSurfaceInverse, fontSize: 14, fontWeight: "600" },
  sheetOverlay: { ...StyleSheetAbsolute() },
  sheetBackdrop: { ...StyleSheetAbsolute(), backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  sheetSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  sheetAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetActionLabel: { fontSize: 16 },
  actionPrimary: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionPrimaryLabel: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
  pwInput: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.onSurface,
  },
  sheetClose: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  sheetCloseLabel: { fontSize: 15, color: colors.muted },
}));

// Small helper to avoid importing StyleSheet just for absoluteFill objects.
function StyleSheetAbsolute() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
