// Generates a readable, memorable password from a person's name/email instead
// of random gibberish — easier for a seller to read aloud or type out, while
// still meeting the 6-character minimum with a number and a symbol.
const SYMBOLS = ["!", "@", "#", "$", "%", "&", "*"];

function titleCaseWord(word: string): string {
  if (!word) return "";
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function nameBase(name: string, email: string): string {
  const source = name.trim() || email.split("@")[0];
  const words = source
    .replace(/[^a-zA-Z\s._-]/g, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);
  const base = words.map(titleCaseWord).join("");
  return base.length >= 3 ? base : "Pinkey";
}

export function generatePassword(name: string, email: string): string {
  const base = nameBase(name, email);
  const num = Math.floor(100 + Math.random() * 900); // 3-digit
  const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  return `${base}${num}${symbol}`;
}
