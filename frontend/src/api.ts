// Thin API client for the PINKEY backend. Attaches the Firebase ID token.
import { auth } from "@/src/firebase";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

async function authHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.detail ?? `Request failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return data as T;
}

// ---- Types --------------------------------------------------------------
export interface MeResponse {
  id: string;
  email: string;
  name: string;
  role: "admin" | "performer";
  gate: "open" | "blocked" | "needs_activation";
  reason: string;
  license_status: string | null;
}

export interface LicenseInfo {
  id: string;
  key: string;
  status: string;
  max_devices: number;
  note: string;
  created_at: string;
}

export interface SaleInfo {
  id: string;
  amount: number;
  currency: string;
  is_free: boolean;
  refunded: boolean;
  note: string;
  created_at: string;
}

export interface DeviceInfo {
  id: string;
  device_id: string;
  device_name: string;
  bound_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  created_at: string;
  license: LicenseInfo | null;
  devices: DeviceInfo[];
  sale: SaleInfo | null;
}

export interface SalesSummary {
  by_currency: Record<string, { total: number; count: number }>;
  total_users: number;
  free_count: number;
  paid_count: number;
  refunded_count: number;
  active_licenses: number;
}

// ---- Performer ----------------------------------------------------------
export const getMe = () => request<MeResponse>("/me");

export const activateLicense = (key: string, deviceId: string, deviceName: string) =>
  request<{ activated: boolean; already: boolean }>("/license/activate", {
    method: "POST",
    body: JSON.stringify({ key, device_id: deviceId, device_name: deviceName }),
  });

export const licenseStatus = (deviceId: string) =>
  request<{ valid: boolean; gate: string; reason?: string }>("/license/status", {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId }),
  });

// ---- Admin --------------------------------------------------------------
export const adminListUsers = () =>
  request<{ users: AdminUser[]; count: number }>("/admin/users");

export const adminCreateUser = (body: {
  email: string;
  password: string;
  name: string;
  price: number;
  currency: string;
  is_free: boolean;
  note: string;
}) => request<{ uid: string; email: string; license_key: string }>("/admin/users", {
  method: "POST",
  body: JSON.stringify(body),
});

export const adminSetUserStatus = (uid: string, disabled: boolean) =>
  request<{ ok: boolean }>(`/admin/users/${uid}/status?disabled=${disabled}`, { method: "POST" });

export const adminResetPassword = (uid: string, password: string) =>
  request<{ ok: boolean }>(`/admin/users/${uid}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });

export const adminDeleteUser = (uid: string) =>
  request<{ ok: boolean }>(`/admin/users/${uid}`, { method: "DELETE" });

export const adminSetLicense = (licenseId: string, status: "active" | "suspended" | "revoked") =>
  request<{ ok: boolean }>(`/admin/licenses/${licenseId}/set?status=${status}`, { method: "POST" });

export const adminUnbindDevices = (licenseId: string) =>
  request<{ ok: boolean; removed: number }>(`/admin/licenses/${licenseId}/unbind`, { method: "POST" });

export const adminUpdateSale = (
  saleId: string,
  body: Partial<{ price: number; currency: string; is_free: boolean; refunded: boolean; note: string }>,
) => request<{ ok: boolean }>(`/admin/sales/${saleId}`, {
  method: "PATCH",
  body: JSON.stringify(body),
});

export const adminSalesSummary = () => request<SalesSummary>("/admin/sales/summary");
