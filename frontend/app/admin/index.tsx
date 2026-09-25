import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

import {
  adminApproveDeviceRequest,
  adminDeleteUser,
  adminDenyDeviceRequest,
  adminListDeviceRequests,
  adminListUsers,
  adminResetPassword,
  adminSalesInsights,
  adminSalesSummary,
  adminSetExpiry,
  adminSetLicense,
  adminSetUserStatus,
  adminUnbindDevices,
  type AdminUser,
} from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";
import { Badge, type BadgeTone } from "@/src/components/ui/Badge";
import { Button, IconButton } from "@/src/components/ui/Button";
import { Card, SectionLabel } from "@/src/components/ui/Card";
import { DurationPicker } from "@/src/components/ui/DurationPicker";
import { Input } from "@/src/components/ui/Input";
import { RevenueChart } from "@/src/components/ui/RevenueChart";
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { Sheet, SheetItem } from "@/src/components/ui/Sheet";
import { Symbol } from "@/src/components/Symbol";
import { CURRENCY_SYMBOL } from "@/src/constants/currency";
import { ThemeScheme, useTheme } from "@/src/theme";
import { expiryInfo } from "@/src/utils/expiry";
import { generatePassword } from "@/src/utils/password";
import { buildAccessMessage } from "@/src/utils/shareMessage";

export default function AdminDashboard() {
  return (
    <ThemeScheme scheme="light">
      <StatusBar style="dark" />
      <AdminDashboardInner />
    </ThemeScheme>
  );
}

function AdminDashboardInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, profile } = useAuth();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState("");
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const copyField = async (fieldId: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField((c) => (c === fieldId ? null : c)), 1200);
  };

  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: adminListUsers });
  const summaryQuery = useQuery({ queryKey: ["admin", "summary"], queryFn: adminSalesSummary });
  const insightsQuery = useQuery({ queryKey: ["admin", "insights"], queryFn: adminSalesInsights });
  const requestsQuery = useQuery({ queryKey: ["admin", "device-requests"], queryFn: adminListDeviceRequests });

  const [refreshing, setRefreshing] = useState(false);

  const refetchAll = useCallback(
    () =>
      Promise.all([
        usersQuery.refetch(),
        summaryQuery.refetch(),
        insightsQuery.refetch(),
        requestsQuery.refetch(),
      ]),
    [usersQuery, summaryQuery, insightsQuery, requestsQuery],
  );

  // Data can change from elsewhere (another device, a background action) —
  // always pull fresh numbers when this screen comes back into view, not
  // just right after a mutation made from this screen.
  useFocusEffect(
    useCallback(() => {
      refetchAll();
    }, [refetchAll]),
  );

  const manualRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  };

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // Native confirmation for anything that immediately disrupts a performer's
  // access — the real OS alert, not a custom in-app dialog.
  const confirmAction = (title: string, message: string, confirmLabel: string, onConfirm: () => void) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: confirmLabel, style: "destructive", onPress: onConfirm },
    ]);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "summary"] });
    qc.invalidateQueries({ queryKey: ["admin", "insights"] });
  };

  const closeSheet = () => {
    setSelected(null);
    setResetPwOpen(false);
    setExpiryOpen(false);
    setNewPw("");
    setShareOpen(false);
  };

  const licenseMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" | "revoked" }) =>
      adminSetLicense(id, status),
    onSuccess: (_d, v) => {
      invalidate();
      flash(v.status === "active" ? "License reactivated" : `License ${v.status}`);
      closeSheet();
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ uid, disabled }: { uid: string; disabled: boolean }) =>
      adminSetUserStatus(uid, disabled),
    onSuccess: (_d, v) => {
      invalidate();
      flash(v.disabled ? "Account disabled" : "Account enabled");
      closeSheet();
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const unbindMutation = useMutation({
    mutationFn: (licenseId: string) => adminUnbindDevices(licenseId),
    onSuccess: (d) => {
      invalidate();
      flash(`Unbound ${d.removed} device(s)`);
      closeSheet();
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (uid: string) => adminDeleteUser(uid),
    onSuccess: () => {
      invalidate();
      flash("User deleted");
      closeSheet();
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const resetPwMutation = useMutation({
    mutationFn: ({ uid, password }: { uid: string; password: string }) =>
      adminResetPassword(uid, password),
    onSuccess: () => {
      invalidate();
      flash("Password reset");
      closeSheet();
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  // Their password is already known — set once at creation and kept in sync
  // on every reset (see server.py) — so this needs no extra step at all.
  const accessMessage = selected
    ? buildAccessMessage({
        name: selected.name,
        email: selected.email,
        password: selected.current_password ?? undefined,
        licenseKey: selected.license?.key ?? "",
      })
    : "";

  const copyAccessMessage = async () => {
    await Clipboard.setStringAsync(accessMessage);
    setMessageCopied(true);
    setTimeout(() => setMessageCopied(false), 1500);
  };

  const shareAccessMessage = async () => {
    try {
      await Share.share({ message: accessMessage });
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  };

  const expiryMutation = useMutation({
    mutationFn: ({ id, durationDays }: { id: string; durationDays: number | null }) =>
      adminSetExpiry(id, durationDays),
    onSuccess: () => {
      invalidate();
      flash("License duration updated");
      closeSheet();
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const approveDeviceMutation = useMutation({
    mutationFn: (requestId: string) => adminApproveDeviceRequest(requestId),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["admin", "device-requests"] });
      flash("Device change approved");
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const denyDeviceMutation = useMutation({
    mutationFn: (requestId: string) => adminDenyDeviceRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "device-requests"] });
      flash("Request denied");
    },
    onError: (e) => flash(e instanceof Error ? e.message : "Failed"),
  });

  const summary = summaryQuery.data;
  const insights = insightsQuery.data;
  const pendingRequests = requestsQuery.data?.requests ?? [];

  const allUsers = usersQuery.data?.users ?? [];
  const q = search.trim().toLowerCase();
  const visibleUsers = allUsers.filter((u) => {
    const matchesSearch = !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || statusLabel(u).toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <ScreenHeader
        title="Admin Dashboard"
        subtitle={profile?.email}
        right={
          <>
            {pendingRequests.length > 0 && (
              <IconButton
                testID="admin-pending-requests-bell"
                onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
              >
                <View>
                  <Symbol name="bell.fill" fallback="" size={19} color={colors.muted} />
                  <View
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -6,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      paddingHorizontal: 3,
                      backgroundColor: colors.error,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFFFFF" }}>
                      {pendingRequests.length}
                    </Text>
                  </View>
                </View>
              </IconButton>
            )}
            <IconButton testID="admin-refresh-button" onPress={manualRefresh} disabled={refreshing}>
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <Symbol name="arrow.clockwise" fallback="⟳" size={19} color={colors.muted} />
              )}
            </IconButton>
            <IconButton testID="admin-logout-button" onPress={logout}>
              <Symbol name="rectangle.portrait.and.arrow.right" fallback="⎋" size={20} color={colors.muted} />
            </IconButton>
          </>
        }
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={manualRefresh} tintColor={colors.brandPrimary} />
        }
      >
        {/* Revenue summary */}
        <SectionLabel>Revenue</SectionLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {summary &&
            Object.entries(summary.by_currency).map(([cur, v]) => (
              <Card key={cur} testID={`summary-${cur}`} style={{ flexGrow: 1, minWidth: "45%" }}>
                <Text style={{ fontSize: 26, fontWeight: "700", color: colors.onSurface, fontVariant: ["tabular-nums"] }}>
                  {CURRENCY_SYMBOL[cur] ?? ""}
                  {v.total.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                  {cur} · {v.count} sales
                </Text>
              </Card>
            ))}
          {summary && Object.keys(summary.by_currency).length === 0 && (
            <Card style={{ flexGrow: 1 }}>
              <Text style={{ fontSize: 26, fontWeight: "700", color: colors.onSurface }}>—</Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>No paid sales yet</Text>
            </Card>
          )}
        </View>

        {summary && (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Stat label="Users" value={summary.total_users} />
            <Stat label="Active" value={summary.active_licenses} />
            <Stat label="Paid" value={summary.paid_count} />
            <Stat label="Free" value={summary.free_count} />
          </View>
        )}

        {/* Sales insights */}
        {insights && insights.monthly.some((m) => Object.keys(m.by_currency).length > 0) && (
          <>
            <SectionLabel>Monthly Revenue</SectionLabel>
            <Card>
              <RevenueChart monthly={insights.monthly} />
            </Card>

            {insights.top.length > 0 && (
              <>
                <SectionLabel>Top-Selling Months</SectionLabel>
                <Card style={{ gap: 2 }}>
                  {insights.top.map((t, i) => (
                    <View
                      key={`${t.month}-${t.currency}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 9,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={{ fontSize: 12, color: colors.muted, width: 16 }}>{i + 1}</Text>
                        <Text style={{ fontSize: 14, color: colors.onSurface }}>
                          {monthLongLabel(t.month)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onSurface, fontVariant: ["tabular-nums"] }}>
                        {CURRENCY_SYMBOL[t.currency] ?? ""}
                        {t.total.toLocaleString()}
                        <Text style={{ fontSize: 11, fontWeight: "400", color: colors.muted }}> {t.currency}</Text>
                      </Text>
                    </View>
                  ))}
                </Card>
              </>
            )}
          </>
        )}

        {/* Device change requests */}
        {pendingRequests.length > 0 && (
          <>
            <SectionLabel>Device Change Requests ({pendingRequests.length})</SectionLabel>
            {pendingRequests.map((r) => (
              <Card key={r.id} testID={`device-request-${r.id}`} style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.onSurface }}>{r.email}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  {r.license_key} · wants to activate on {r.device_name || "a new device"}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      testID={`approve-device-${r.id}`}
                      label="Approve"
                      size="sm"
                      loading={approveDeviceMutation.isPending && approveDeviceMutation.variables === r.id}
                      onPress={() => approveDeviceMutation.mutate(r.id)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      testID={`deny-device-${r.id}`}
                      label="Deny"
                      variant="outline"
                      size="sm"
                      loading={denyDeviceMutation.isPending && denyDeviceMutation.variables === r.id}
                      onPress={() => denyDeviceMutation.mutate(r.id)}
                    />
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Users */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
          <SectionLabel>Magicians ({usersQuery.data?.count ?? 0})</SectionLabel>
          <Button
            testID="admin-create-user-button"
            label="New"
            size="sm"
            fullWidth={false}
            icon={<Symbol name="plus" fallback="+" size={14} color={colors.onBrandPrimary} />}
            onPress={() => router.push("/admin/create-user")}
          />
        </View>

        {allUsers.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <Input
                testID="admin-user-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name or email"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Pressable
              testID="admin-filter-button"
              onPress={() => setFilterSheetOpen(true)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: statusFilter !== "all" ? colors.brandPrimary : colors.border,
                backgroundColor: colors.surfaceSecondary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Symbol
                name="line.3.horizontal.decrease.circle"
                fallback=""
                size={20}
                color={statusFilter !== "all" ? colors.brandPrimary : colors.muted}
              />
              {statusFilter !== "all" && (
                <View
                  style={{
                    position: "absolute",
                    top: -3,
                    right: -3,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.brandPrimary,
                    borderWidth: 1.5,
                    borderColor: colors.surfaceSecondary,
                  }}
                />
              )}
            </Pressable>
          </View>
        )}

        {usersQuery.isLoading && <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 24 }} />}
        {allUsers.length === 0 && !usersQuery.isLoading && (
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 24, textAlign: "center" }}>
            No magicians yet. Tap “New” to create one.
          </Text>
        )}
        {allUsers.length > 0 && visibleUsers.length === 0 && (
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 24, textAlign: "center" }}>
            No magicians match{search ? ` "${search}"` : ""}
            {statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.
          </Text>
        )}
        {visibleUsers.map((u) => {
          const expiry = u.license ? expiryInfo(u.license.expires_at) : null;
          return (
            <Pressable
              key={u.id}
              testID={`user-card-${u.email}`}
              onPress={() => setSelected(u)}
              style={({ pressed }) => [{ marginTop: 10 }, pressed && { opacity: 0.75 }]}
            >
              <Card>
                {/* Name + status badge */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <Text
                    style={{ flex: 1, fontSize: 16, fontWeight: "700", color: colors.onSurface }}
                    numberOfLines={1}
                  >
                    {u.name || u.email}
                  </Text>
                  <Badge
                    label={u.status === "active" ? (u.license?.effective_status ?? u.license?.status ?? "—") : u.status}
                    tone={statusTone(u)}
                  />
                </View>

                {/* Email — shrinks, then truncates, so a long address never breaks the layout */}
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                  <Text
                    style={{ flex: 1, fontSize: 13, color: colors.muted }}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {u.email}
                  </Text>
                  <Pressable onPress={() => copyField(`${u.id}-email`, u.email)} hitSlop={8} style={{ marginLeft: 6 }}>
                    <Symbol
                      name={copiedField === `${u.id}-email` ? "checkmark" : "doc.on.doc"}
                      fallback=""
                      size={13}
                      color={copiedField === `${u.id}-email` ? colors.success : colors.muted}
                    />
                  </Pressable>
                </View>

                <View style={{ marginTop: 12, gap: 6 }}>
                  <InfoRow label="Created" value={shortDate(u.created_at)} />
                  <InfoRow
                    label="Key"
                    value={u.license?.key ?? "No license"}
                    mono
                    copied={copiedField === `${u.id}-key`}
                    onCopy={u.license?.key ? () => copyField(`${u.id}-key`, u.license!.key) : undefined}
                  />
                  <InfoRow
                    label="Expires"
                    value={expiry?.label ?? (u.license ? "Lifetime access" : "—")}
                    valueColor={expiry?.tone === "error" ? colors.error : expiry?.tone === "warning" ? colors.warning : undefined}
                  />
                </View>

                {(u.devices.length > 0 || u.sale) && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {u.devices.length > 0 ? "Device bound" : "Not activated"}
                    </Text>
                    {u.sale && (
                      <>
                        <Text style={{ color: colors.muted }}>·</Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>
                          {u.sale.is_free ? "Free" : `${CURRENCY_SYMBOL[u.sale.currency] ?? ""}${u.sale.amount}`}
                          {u.sale.refunded ? " (refunded)" : ""}
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Toast */}
      {!!toast && (
        <View
          testID="admin-toast"
          style={{
            position: "absolute",
            alignSelf: "center",
            bottom: insets.bottom + 24,
            backgroundColor: colors.surfaceInverse,
            borderRadius: 999,
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: colors.onSurfaceInverse, fontSize: 14, fontWeight: "600" }}>{toast}</Text>
        </View>
      )}

      {/* Action sheet */}
      <Sheet
        visible={!!selected}
        onClose={closeSheet}
        title={selected?.email}
        subtitle={`${selected?.license?.key ?? "no license"} · ${selected?.license?.effective_status ?? selected?.license?.status ?? "—"}`}
      >
        {resetPwOpen ? (
          <View style={{ gap: 12, paddingHorizontal: 8, paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
              <Pressable
                testID="reset-password-generate"
                onPress={() => setNewPw(generatePassword(selected?.name ?? "", selected?.email ?? ""))}
                hitSlop={8}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Symbol name="arrow.clockwise" fallback="" size={12} color={colors.brandPrimary} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.brandPrimary }}>
                  {newPw ? "Regenerate" : "Generate"}
                </Text>
              </Pressable>
            </View>
            <Input
              testID="reset-password-input"
              value={newPw}
              onChangeText={setNewPw}
              placeholder="New password (min 6), or tap Generate"
              autoCapitalize="none"
            />
            <Button
              testID="reset-password-confirm"
              label="Set Password"
              loading={resetPwMutation.isPending}
              onPress={() =>
                newPw.length >= 6
                  ? resetPwMutation.mutate({ uid: selected!.id, password: newPw })
                  : flash("Password too short")
              }
            />
          </View>
        ) : expiryOpen ? (
          <View style={{ gap: 12, paddingHorizontal: 8, paddingBottom: 8 }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>
              {selected?.license && expiryInfo(selected.license.expires_at)
                ? `Currently: ${expiryInfo(selected.license.expires_at)!.label}`
                : "Currently: lifetime access (never expires)"}
            </Text>
            <DurationPicker
              testIDPrefix="edit-duration"
              value={null}
              onChange={(days) => selected?.license && expiryMutation.mutate({ id: selected.license.id, durationDays: days })}
            />
            {expiryMutation.isPending && <ActivityIndicator color={colors.brandPrimary} />}
          </View>
        ) : shareOpen ? (
          <View style={{ gap: 12, paddingHorizontal: 8, paddingBottom: 8 }}>
            {selected?.current_password ? (
              <>
                <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                  Name, email, password, and license key — ready to send.
                </Text>
                <Card style={{ padding: 12 }}>
                  <Text style={{ fontSize: 12, color: colors.onSurfaceSecondary, lineHeight: 18 }}>
                    {accessMessage}
                  </Text>
                </Card>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      testID="copy-share-message"
                      variant="secondary"
                      label={messageCopied ? "Copied" : "Copy Message"}
                      icon={<Symbol name="doc.on.doc" fallback="" size={16} color={colors.onSurface} />}
                      onPress={copyAccessMessage}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      testID="share-share-message"
                      label="Share"
                      icon={<Symbol name="square.and.arrow.up" fallback="" size={16} color={colors.onBrandPrimary} />}
                      onPress={shareAccessMessage}
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                  This account was created before PINKEY started keeping a password on file, so
                  there's nothing to share yet. Reset the password once to enable sharing.
                </Text>
                <Button
                  testID="share-go-to-reset"
                  label="Reset Password"
                  variant="secondary"
                  onPress={() => {
                    setShareOpen(false);
                    setResetPwOpen(true);
                  }}
                />
              </>
            )}
          </View>
        ) : (
          selected && (
            <View>
              {selected.license?.status === "active" ? (
                <SheetItem
                  testID="action-revoke"
                  label="Revoke license"
                  tone="error"
                  icon={<Symbol name="xmark.shield" fallback="" size={18} color={colors.error} />}
                  onPress={() =>
                    confirmAction(
                      "Revoke License?",
                      `${selected.email} will be blocked from using the app immediately, until you reactivate it.`,
                      "Revoke",
                      () => licenseMutation.mutate({ id: selected.license!.id, status: "revoked" }),
                    )
                  }
                />
              ) : (
                <SheetItem
                  testID="action-reactivate"
                  label="Reactivate license"
                  tone="success"
                  icon={<Symbol name="checkmark.shield" fallback="" size={18} color={colors.success} />}
                  onPress={() => licenseMutation.mutate({ id: selected.license!.id, status: "active" })}
                />
              )}
              <SheetItem
                testID="action-unbind"
                label="Unlink device"
                icon={<Symbol name="iphone.slash" fallback="" size={18} color={colors.onSurface} />}
                onPress={() =>
                  confirmAction(
                    "Unlink Device?",
                    `${selected.email} will need to enter their license key again to activate on a device — the same one or a new one.`,
                    "Unlink",
                    () => unbindMutation.mutate(selected.license!.id),
                  )
                }
              />
              <SheetItem
                testID="action-toggle-status"
                label={selected.status === "active" ? "Disable account" : "Enable account"}
                icon={<Symbol name="person.slash" fallback="" size={18} color={colors.onSurface} />}
                onPress={() => {
                  const disabling = selected.status === "active";
                  if (!disabling) {
                    statusMutation.mutate({ uid: selected.id, disabled: false });
                    return;
                  }
                  confirmAction(
                    "Disable Account?",
                    `${selected.email} won't be able to sign in until you enable the account again.`,
                    "Disable",
                    () => statusMutation.mutate({ uid: selected.id, disabled: true }),
                  );
                }}
              />
              <SheetItem
                testID="action-reset-password"
                label="Reset password"
                icon={<Symbol name="key" fallback="•" size={18} color={colors.onSurface} />}
                onPress={() => setResetPwOpen(true)}
              />
              <SheetItem
                testID="action-manage-expiry"
                label="License duration"
                icon={<Symbol name="calendar" fallback="" size={18} color={colors.onSurface} />}
                onPress={() => setExpiryOpen(true)}
              />
              <SheetItem
                testID="action-share-message"
                label="Share access message"
                icon={<Symbol name="square.and.arrow.up" fallback="" size={18} color={colors.onSurface} />}
                onPress={() => setShareOpen(true)}
              />
              <SheetItem
                testID="action-delete"
                label="Delete user"
                tone="error"
                icon={<Symbol name="trash" fallback="" size={18} color={colors.error} />}
                onPress={() =>
                  confirmAction(
                    "Delete User?",
                    `This removes ${selected.email} from your dashboard and revokes their license. This can't be undone here.`,
                    "Delete",
                    () => deleteMutation.mutate(selected.id),
                  )
                }
              />
            </View>
          )
        )}
      </Sheet>

      <Sheet visible={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} title="Filter by Status">
        {STATUS_FILTERS.map((f) => (
          <SheetItem
            key={f}
            testID={`admin-status-filter-${f}`}
            label={f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
            icon={
              statusFilter === f ? (
                <Symbol name="checkmark" fallback="" size={18} color={colors.brandPrimary} />
              ) : (
                <View style={{ width: 18 }} />
              )
            }
            onPress={() => {
              setStatusFilter(f);
              setFilterSheetOpen(false);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

function statusTone(u: AdminUser): BadgeTone {
  if (u.status !== "active") return "error";
  const status = u.license?.effective_status ?? u.license?.status;
  if (status === "active") return "success";
  if (status === "expired") return "error";
  return "warning";
}

// Same value the card's badge shows — filtering matches what the admin sees.
function statusLabel(u: AdminUser): string {
  return u.status === "active" ? (u.license?.effective_status ?? u.license?.status ?? "—") : u.status;
}

const STATUS_FILTERS = ["all", "active", "suspended", "revoked", "expired", "disabled"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLongLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function InfoRow({
  label,
  value,
  mono,
  valueColor,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
  copied?: boolean;
  onCopy?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text style={{ fontSize: 12, color: colors.muted, width: 62 }}>{label}</Text>
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: "500",
          color: valueColor ?? colors.onSurfaceSecondary,
          fontVariant: mono ? ["tabular-nums"] : undefined,
        }}
        numberOfLines={1}
        ellipsizeMode={mono ? "clip" : "tail"}
      >
        {value}
      </Text>
      {onCopy && (
        <Pressable onPress={onCopy} hitSlop={8} style={{ marginLeft: 6 }}>
          <Symbol
            name={copied ? "checkmark" : "doc.on.doc"}
            fallback=""
            size={13}
            color={copied ? colors.success : colors.muted}
          />
        </Pressable>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}>
      <Text style={{ fontSize: 19, fontWeight: "700", color: colors.onSurface, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{label}</Text>
    </Card>
  );
}
