# PINKEY — Master Plan (v1, September 2026)

> Source of truth: `PinKey_Claude_Safe_Build_Brief_v3.pdf`
> Owner decision record: build order, phases, design, security, App Store strategy.

---

## 0. WHAT WE ARE BUILDING (shared understanding)

PINKEY is a **professional theatrical number-mystery simulator for magicians/mentalists**.
A spectator types fictional numbers into a custom keypad; the app runs a scripted routine
(4 modes) and produces a simulated LOCKED → UNLOCKED show moment. After the "unlock",
the performer secretly opens a **Peek view** revealing the reconstructed performance values.

**Hard rules from the brief (never compromised):**
1. The performance engine is 100% local/offline. No network in the routine path.
2. It NEVER touches real OS passcodes, biometrics, contacts, accounts, or private data.
3. All entered values are fictional "performance values" (mock dates MMYY / MMDDYY etc.).
4. No debug state ever visible on the spectator screen.
5. Session state is temporary and wiped on reset.

**Business layer (user requirement, sits AROUND the engine, never inside it):**
- The app is sold directly to magicians by the owner (admin), not self-serve.
- Admin creates each user account + a license key; magicians cannot share credentials
  (license is device-bound, limited device count, revocable).
- Admin dashboard tracks users, licenses, sale price (paid/free), revenue.

**Key architectural separation:**
```
┌────────────────────────── APP ───────────────────────────┐
│ Auth & License Gate (online, Firebase + our backend)      │
│   └─ once unlocked, hands off to ──▶ Performance Engine   │
│                                       (100% offline,      │
│                                        in-memory only)    │
│ Admin role ─▶ Admin Dashboard (users, licenses, sales)    │
└───────────────────────────────────────────────────────────┘
```
The engine never imports network code. Auth/license wrap it like a shell. This keeps the
brief's security model intact while adding the commercial layer.

---

## 1. APP STORE RESEARCH SUMMARY (how similar apps are listed)

| App | Price | Category | Model |
|---|---|---|---|
| InLock (lock-screen passcode reveal — closest to PINKEY) | $150.00 | Entertainment | Paid upfront |
| WikiTest (book test) | $109.99 + $5.49/mo Pro | Entertainment | Paid + subscription |
| Xeno (thought reveal) | $59.99 | Entertainment | Paid upfront |
| Cipher Pro (PIN/birthday peek) | Paid via Ellusionist | Entertainment | Paid |
| iForce | $2.99 | Entertainment | Paid upfront |

**Findings:**
- Category: **Entertainment** (not Utilities — Utilities invites "what is this for?" scrutiny).
- This niche tolerates premium pricing ($60–$150) because buyers are working professionals.
- Listings describe a "performance tool for magicians", never claim to bypass real security,
  and never show real iOS system assets in screenshots.

**Apple policy risks & our mitigations:**
- ⚠️ Guideline 1.1.6 / 10.2: apps mimicking system UI can be rejected.
  → Mitigation: our keypad is *realistic but distinct* (own layout, typography, animation) —
  a theatrical prop, not a pixel-copy of the iOS passcode screen. No Apple logos/assets.
- ⚠️ Guideline 3.1.1 (IAP): selling access via external license keys is allowed under the
  **"free companion app to a paid external service"** pattern IF the app sells no digital
  content in-app and shows no purchase links. Our app: free download, login required,
  license sold outside (direct B2B to magicians). No prices/purchase UI in the app.
  (Same pattern used by professional SaaS and several magic apps.)
- ✅ **Unlisted App Distribution** (Apple, since iOS 15-era program): app lives on the App
  Store but is hidden from search/charts; reachable only via direct link. Ideal for a
  closed magician community. Requires: finished app, App Review pass, demo account for
  review, request form after submission. **This is our recommended distribution.**
- App Review needs **demo login credentials** — we will maintain a review/demo account.

---

## 2. TECH STACK (fixed decisions)

| Layer | Choice | Why |
|---|---|---|
| Mobile | Expo SDK 57, expo-router, iOS-first | User: App Store only. Web preview used for admin dashboard + dev testing |
| Engine | Pure TypeScript module, zero RN imports, zero I/O | Testable, fast, portable, crash-proof core |
| State | In-memory session (engine) + `@/src/utils/storage` only for license/config cache | Brief forbids persisting performance data |
| Auth | Firebase Auth (JS SDK, email/password) with AsyncStorage persistence | Expo Go compatible; user asked for Firebase |
| Roles | Firebase custom claims set by our backend via Firebase Admin SDK (`admin` / `performer`) | RBAC standard |
| Licenses | Our FastAPI + MongoDB: license key → uid + device binding + price + status | Firebase has no license concept; we own this data |
| Backend | Existing FastAPI (`/api/*`) + MongoDB (Motor) | Already provisioned |
| Admin UI | Same Expo codebase, role-gated screens (works on iOS + web browser) | One codebase, admin can use desktop browser |
| Animations | react-native-reanimated | 60fps, already installed |
| Haptics/Sound | expo-haptics (installed), expo-audio for subtle key clicks | Installed/allowed |

---

## 3. PHASE PLAN

Each phase: **Objective → Scope → Design → Security → Performance → Acceptance criteria → Exit gate.**
We do not start phase N+1 until phase N's acceptance criteria pass.

---

### PHASE 1 — The Performance Engine (offline core) ⚙️
**Objective:** Implement the brief's brain as a pure, unit-testable TypeScript module.
No UI. No network. No storage. This is the "never compromise" deliverable.

**What we're building:**
- `PerformanceConfig`: entryLength (4|6), mode (BASIC|TRANSFORM|SCRAMBLE|HYBRID), attempts, offsets, sessionId.
- `PerformanceSession` + `PerformanceEvent` (id, seq, type, mockInput, targetPosition, offset, deleted, includedInReconstruction, timestamp).
- **Event Engine**: append-only chronological event log; accepts INPUT / DELETE / FILLER / TRANSFORM events.
- **State machine** (brief §13): SETUP → READY/LOCKED → INPUT STEP → EVENT → NEXT STEP → FINAL STEP → RECONSTRUCT → SIMULATED UNLOCK → PEEK → RESET.
- **Modes:**
  - **BASIC**: configurable attempt sequence (target label, capture flag, unlock flag). 4-step reference sequence (mock code → mock date MMYY → mock associated number → performance key → unlock).
  - **TRANSFORM**: position-by-position **mod-10 digit arithmetic** with configurable offsets. Verified identity: `2749 +(+4,+1,+3,+2) → 6871 → reverse → 2749` (9+2=11→1 mod 10; reverse wraps too).
  - **SCRAMBLE PEEK**: non-linear target positions, DELETE events retained in history, FILLER events excluded from reconstruction, transformed-position reconstruction.
  - **HYBRID**: chronological mix of direct mapping + deletion tracking + positional jumps + transformation in one session; reference: reconstructs 2749 from 4 events.
- Mock date formatting helpers: 4-digit → MMYY, 6-digit → MMDDYY.

**Design:** n/a (logic only) — API shaped so UI binds 1:1 (`dispatch(digit)`, `dispatchDelete()`, `peek()`).

**Security:**
- Module imports nothing external; static check that no network/storage/API imports exist.
- No real-data code paths by construction.

**Performance:** O(1) per keypress; reconstruction O(n) over ≤ dozens of events; zero allocations in hot path beyond event append.

**Acceptance criteria (brief §16 tests 1–13):**
1. 4-digit input works 2. 6-digit works 3. MMYY format 4. MMDDYY format
5. Basic sequence 6. Basic unlock 7. Transform offsets 8. 2749→6871→2749
9. Scramble non-linear mapping 10. Deleted event retained 11. Filler excluded
12. Hybrid reconstruction 13. Chronological order retained.
→ Jest-style unit tests, 100% pass.

**Exit gate:** all 13 engine tests green; engine file has zero imports outside itself/types.

---

### PHASE 2 — Spectator Experience (the show UI) 🎭
**Objective:** The deceptive, premium performance surface a spectator sees.

**What we're building:**
- **Lock screen**: realistic-but-distinct premium passcode pad (our own visual language — not an iOS replica), LOCKED state, entry dots/field, custom keypad (0–9, delete), wrong-attempt shake + haptic, LOCKED→UNLOCKED transition animation.
- **Setup screen** (performer-only entry): entry length 4/6, mode picker, attempts config, offsets editor for Transform, scramble position editor.
- **Peek view**: hidden; opened by **long-press (2s) on the unlocked screen**; shows summary table: reconstructed performance value, mock date value, mock associated number, source event per result.
- **Reset / new session** control.
- Haptics on keypress + subtle key-click sound (expo-audio), all toggled in setup.

**Design:**
- Dark, theatrical, high-contrast; tokens in `src/theme.ts` (from design guidelines agent).
- Keypad keys: large (≥72pt), instant press states, staggered entrance.
- No tabs needed — single-flow stack navigation. Safe-area via `useSafeAreaInsets`.

**Security:**
- Peek reachable only via the secret gesture; no visible hints on spectator screen.
- Engine session lives only in memory; reset wipes it (brief test 15).
- No debug overlays, no logs of entered values in production builds.

**Performance:**
- Keypress → visual feedback < 16ms (reanimated worklets, no bridge round-trips).
- App cold start to keypad < 1.5s.

**Acceptance criteria:** brief §16 tests 14–15 (Peek shows reconstructed session; Reset clears); full manual flow for all 4 modes × 2 lengths on iOS.

**Exit gate:** testing_agent E2E pass on all mode flows + screenshot review.

---

### PHASE 3 — Auth & License Gate (Firebase) 🔐
**Objective:** Only paying, licensed magicians get in. Credentials can't be shared freely.

**What we're building:**
- Login screen (email/password, Firebase Auth JS SDK, AsyncStorage persistence).
- **No self-signup anywhere** — accounts exist only when admin creates them (Phase 4).
- License activation: first login asks for license key → backend validates → binds `license ↔ uid ↔ deviceId` (max N devices, default 2).
- License gate on app start: cached grant works **offline** (grace window, e.g. 30 days); online revalidation when network available; revoked license locks the app at next online check.
- Logout.

**Design:** minimal, premium dark gate; clearly separate from the show UI (performer-only).

**Security:**
- Firebase ID token verified server-side on every backend call (Firebase Admin SDK).
- Custom claims: `role: performer|admin` — client can never self-elevate (claims set only by backend).
- License keys: random, unguessable (e.g. `PK7X-…-…`), stored hashed-compared server-side; activation is atomic.
- No Admin SDK keys in the app bundle — ever. Backend env only.
- Grace-period cache stored via `@/src/utils/storage` (secure namespace).

**Performance:** gate check is local-first (instant open when cached); network revalidation is async, non-blocking, never in the engine path.

**Acceptance criteria:**
- Login works with admin-created account; wrong creds rejected cleanly.
- License key activates on device 1 & 2, refused on device 3.
- Revoked license locks app after revalidation.
- App opens fully offline within grace window; engine runs with airplane mode on.
- Auth integration implemented strictly from integration_expert playbook.

**Exit gate:** testing_agent E2E pass incl. revocation + offline scenarios.

---

### PHASE 4 — Admin Dashboard (your control room) 🛠️
**Objective:** You (admin) create users & licenses, set price/free, track sales.

**What we're building (role-gated `admin` screens, usable in-app and in a desktop browser):**
- **Users**: list (email, status, license, devices, price paid), create user (email + temp password + price or FREE + note), disable/delete user, reset password.
- **Licenses**: generate key per user, set max devices, activate/suspend/revoke, view bound devices, unbind device.
- **Sales**: per-user price (paid/free), revenue summary (total, this month, count free vs paid), edit price, mark refunded.
- Backend: FastAPI routes under `/api/admin/*` (all behind Firebase token + admin claim), MongoDB collections: `licenses`, `sales`, `deviceBindings`.

**Design:** clean data-dense dashboard, dark theme, tables on web / cards on mobile; testIDs everywhere.

**Security:**
- Every admin route double-checked: valid token AND `admin` custom claim.
- Creating a Firebase user happens only server-side (Admin SDK).
- Audit log collection: who created/revoked what, when.

**Performance:** paginated lists (50/page); revenue computed via Mongo aggregation, not client-side.

**Acceptance criteria:**
- Admin creates user → user can log in (Phase 3 flow works end-to-end).
- Free vs paid sales recorded correctly; revenue totals accurate.
- Revoke in dashboard → that user locked out on next online check.
- Non-admin token hitting `/api/admin/*` → 403.

**Exit gate:** testing_agent full pass on admin CRUD + end-to-end sell→activate→revoke cycle.

---

### PHASE 5 — App Store Readiness (iOS-only launch) 🚀
**Objective:** Ship to the App Store via unlisted distribution.

**What we're doing:**
- App icon, splash, `app.json` polish (name "PINKEY", portrait, iOS-only settings).
- Performance pass: cold-start budget, bundle audit, zero-crash sweep (ErrorBoundary already at root).
- Security sweep: no secrets in bundle, no performance data persisted, production log scrub.
- App Store Connect: Entertainment category, age rating, privacy nutrition label (we collect: email, device ID — disclosed), screenshots, description written as "professional performance tool for magicians" (no security-bypass claims).
- **Demo account for App Review** + review notes stating unlisted-distribution intent.
- Submit → request **Unlisted App Distribution** → TestFlight beta with you first.
- Builds via Emergent **Publish** flow (EAS under the hood — no manual EAS CLI).

**Design:** App Store page copy + screenshots styled to the premium brand.

**Security:** final checklist vs brief §16 tests 16–18 (no OS credential APIs, no network in engine, no private data access) — evidenced in review notes.

**Acceptance criteria:**
- TestFlight build installs & runs the full show offline.
- App Review pass (demo account provided).
- Unlisted link live.

**Exit gate:** approved unlisted App Store link in your hands.

---

## 4. DELIVERY ORDER & ESTIMATES

| Phase | Deliverable | Depends on |
|---|---|---|
| 1 | Engine + 13 unit tests | — |
| 2 | Full show UI | 1 |
| 3 | Login + license gate | 2 + your Firebase project |
| 4 | Admin dashboard | 3 |
| 5 | App Store submission | 4 |

**You will need to provide (Phase 3, not before):**
1. A Firebase project (free Spark plan is fine) with Email/Password auth enabled.
2. Firebase web config (apiKey, projectId, appId…) for the app.
3. Firebase service-account JSON for the backend (Admin SDK).

**Decisions locked from your inputs:**
- Keypad look: realistic lock-screen style (distinct design, not iOS replica — review safety).
- Peek gesture: long-press 2s on unlocked screen.
- Feedback: haptics + subtle key sounds + wrong-attempt shake.
- Distribution: App Store, unlisted listing, iOS-first.
- Business: admin-created users, device-bound license keys, paid/free per user, sales dashboard.
