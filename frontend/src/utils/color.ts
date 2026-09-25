// #rrggbb -> rgba(r,g,b,alpha). Used to derive translucent tints from a
// theme's solid hex tokens, so a badge/chip tint always matches whichever
// scheme (light or dark) actually supplied the base color.
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
