// Formats a license's `expires_at` (ISO string or null = perpetual) into a
// short human label + a tone for the badge.

export type ExpiryTone = "neutral" | "warning" | "error";

export function expiryInfo(expiresAt: string | null | undefined): { label: string; tone: ExpiryTone } | null {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diffMs / 86_400_000);
  if (days < 0) return { label: "Expired", tone: "error" };
  if (days === 0) return { label: "Expires today", tone: "error" };
  if (days === 1) return { label: "Expires tomorrow", tone: "warning" };
  if (days <= 7) return { label: `Expires in ${days}d`, tone: "warning" };
  return { label: `Expires in ${days}d`, tone: "neutral" };
}
