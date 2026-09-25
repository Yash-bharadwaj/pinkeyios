export const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", INR: "₹", EUR: "€" };

// Converts an amount between USD and INR using a live USD→INR rate (see
// src/utils/exchangeRate.ts). Returns null when the conversion isn't
// possible — same currency needs no rate, but a currency other than USD/INR
// (e.g. EUR) or a not-yet-loaded rate can't be honestly converted, and
// callers should show the native amount rather than a wrong number.
export function convertAmount(
  amount: number,
  from: string,
  to: "USD" | "INR",
  usdToInrRate: number | null,
): number | null {
  if (from === to) return amount;
  if (!usdToInrRate) return null;
  if (from === "USD" && to === "INR") return amount * usdToInrRate;
  if (from === "INR" && to === "USD") return amount / usdToInrRate;
  return null;
}

export function formatMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? "";
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  })}`;
}

// Fixed categorical hue order for chart series — validated (CVD-safe, lightness
// band, chroma floor, contrast) via the dataviz skill's palette validator
// against the admin dashboard's actual card surface, one run per mode. Never
// reassign per-render; only append. The revenue chart only ever renders on the
// light (admin) theme today, but both steps are kept so this stays correct if
// a chart is ever added to a dark screen.
const SERIES_COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#4a3aa7"], // blue, orange, aqua, violet
  dark: ["#3987e5", "#d95926", "#199e70", "#9085e9"],
};
const CURRENCY_ORDER = ["USD", "INR", "EUR"];

export function currencyColor(currency: string, scheme: "light" | "dark" = "light"): string {
  const steps = SERIES_COLORS[scheme];
  const idx = CURRENCY_ORDER.indexOf(currency);
  return steps[idx >= 0 && idx < steps.length ? idx : steps.length - 1];
}
