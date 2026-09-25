// Sanitizes free-text input down to a valid decimal amount as the user
// types — digits and at most one decimal point, nothing else (no letters,
// no minus sign, no second "."). Needed because `keyboardType="decimal-pad"`
// only shapes the on-screen keyboard; it doesn't stop a paste or a hardware
// keyboard from putting anything else into the field.
export function sanitizeDecimalInput(raw: string): string {
  const digitsAndDots = raw.replace(/[^0-9.]/g, "");
  const firstDot = digitsAndDots.indexOf(".");
  if (firstDot === -1) return digitsAndDots;
  const before = digitsAndDots.slice(0, firstDot + 1);
  const after = digitsAndDots.slice(firstDot + 1).replace(/\./g, "");
  return before + after;
}
