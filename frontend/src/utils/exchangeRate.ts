// Live USD↔INR exchange rate for the admin dashboard's currency toggle.
// Frankfurter mirrors the European Central Bank's daily reference rates —
// free, no API key, no rate limit, HTTPS, and it's the rate a real
// accounting conversion would use (not a guessed constant that goes stale
// the day it's written). Using the .dev host directly (not .app, which
// 301-redirects here) avoids a pointless extra round trip on every request.
export async function fetchUsdInrRate(): Promise<number> {
  const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR");
  if (!res.ok) throw new Error(`Exchange rate request failed (${res.status})`);
  const data = await res.json();
  const rate = data?.rates?.INR;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Exchange rate response was malformed");
  }
  return rate;
}
