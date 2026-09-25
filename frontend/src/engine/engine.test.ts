// PINKEY engine acceptance tests (brief §16, tests 1–13).
// Run: npx -y tsx src/engine/engine.test.ts
import { buildAttempts, buildDefaultConfig } from "./defaults";
import {
  backspace,
  createSession,
  formatMockDate,
  getPeek,
  inputDigit,
  resetSession,
  reverseTransformValue,
  transformValue,
} from "./engine";
import type { PerformanceConfig, Session } from "./types";

let failures = 0;
function assert(condition: boolean, name: string) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failures += 1;
    console.error(`FAIL  ${name}`);
  }
}

function enter(session: Session, digits: string): Session {
  let s = session;
  for (const c of digits) s = inputDigit(s, Number(c));
  return s;
}

// --- 1 & 2: 4-digit and 6-digit input works -------------------------------
{
  const c4 = buildDefaultConfig("BASIC", 4);
  let s = enter(createSession(c4), "2749");
  assert(s.events.length === 1 && s.events[0].value === "2749", "1. 4-digit input works");

  const c6: PerformanceConfig = { ...buildDefaultConfig("BASIC", 6), attempts: buildAttempts(4) };
  s = enter(createSession(c6), "274918");
  assert(s.events.length === 1 && s.events[0].value === "274918", "2. 6-digit input works");
}

// --- 3 & 4: MMYY / MMDDYY mock-date formatting ----------------------------
{
  assert(formatMockDate("0897", 4) === "08/97", "3. MMYY mock-date formatting works");
  assert(formatMockDate("081297", 6) === "08/12/97", "4. MMDDYY mock-date formatting works");
}

// --- 5 & 6: Basic sequence + simulated unlock ------------------------------
{
  const config = buildDefaultConfig("BASIC", 4); // code → date → associated → key
  let s = createSession(config);
  s = enter(s, "2749");
  assert(s.status === "LOCKED" && s.lastEffect === "attempt-failed", "5a. Basic attempt 1 stays locked");
  s = enter(s, "0897");
  s = enter(s, "5832");
  assert(s.status === "LOCKED" && s.events.length === 3, "5b. Basic sequence works");
  s = enter(s, "5837");
  assert(s.status === "UNLOCKED" && s.reconstructed === "5837", "6. Basic simulated unlock works");
  const peek = getPeek(s);
  assert(peek.associatedNumber === "5832", "6b. Peek associated number captured");
  assert(peek.rows.length === 4, "6c. Peek lists all captured attempts");
}

// --- 7 & 8: Transform offsets + 2749→6871→2749 -----------------------------
{
  assert(transformValue("2749", [4, 1, 3, 2]) === "6871", "7. Transform offsets work");
  assert(reverseTransformValue("6871", [4, 1, 3, 2]) === "2749", "8a. Reverse transform works");
  const config = buildDefaultConfig("TRANSFORM", 4);
  const s = enter(createSession(config), "6871");
  assert(s.status === "UNLOCKED" && s.reconstructed === "2749", "8b. 2749-6871-2749 test passes");
  assert(getPeek(s).associatedNumber === "6871", "8c. Peek shows visible transformed entry");
}

// --- 9, 10, 11: Scramble non-linear mapping, delete retained, filler excluded
{
  const config = buildDefaultConfig("SCRAMBLE", 4);
  // script: pos2 direct, pos4 delete, pos3 direct, filler, pos1 transform(2)
  const s = enter(createSession(config), "79464");
  assert(s.status === "UNLOCKED" && s.reconstructed === "2749", "9. Scramble non-linear mapping works");
  const deleted = s.events.find((e) => e.type === "DELETE");
  assert(!!deleted && deleted.value === "9" && deleted.deleted, "10. Deleted event retained in session history");
  const filler = s.events.find((e) => e.type === "FILLER");
  assert(!!filler && !filler.includedInReconstruction, "11. Filler event excluded from reconstruction");
}

// --- 12 & 13: Hybrid reconstruction + chronological order ------------------
{
  const config = buildDefaultConfig("HYBRID", 4);
  // script: pos2 direct, pos4 delete, pos3 direct, pos1 transform(2)
  const s = enter(createSession(config), "7944");
  assert(s.status === "UNLOCKED" && s.reconstructed === "2749", "12. Hybrid reconstruction works");
  const types = s.events.map((e) => e.type).join(",");
  const seqs = s.events.map((e) => e.seq);
  const ordered = seqs.every((v, i) => i === 0 || v > seqs[i - 1]);
  assert(types === "INPUT,DELETE,INPUT,TRANSFORM" && ordered, "13. Chronological event order is retained");
}

// --- extras: backspace + reset ---------------------------------------------
{
  const config = buildDefaultConfig("BASIC", 4);
  let s = enter(createSession(config), "27");
  s = backspace(s);
  assert(s.buffer === "2" && s.events.some((e) => e.type === "BACKSPACE"), "x1. Backspace records correction event");
  const fresh = resetSession(s);
  assert(fresh.events.length === 0 && fresh.status === "LOCKED" && fresh.id !== s.id, "x2. Reset clears the session");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) FAILED`);
  process.exit(1);
}
console.log("\nAll engine acceptance tests passed.");
