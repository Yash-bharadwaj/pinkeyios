# PINKEY — Product Requirements Document

## Original Problem Statement
Build a mobile app per `PinKey_Claude_Safe_Build_Brief_v3.pdf`: a theatrical number-mystery
performance simulator for magicians. Custom numeric keypad, 4 modes (Basic, Transform,
Scramble Peek, Hybrid), 4/6-digit entries, simulated LOCKED→UNLOCKED show moment, hidden
performer Peek view. Strictly offline engine; never touches real OS credentials or private
data. Business layer (user requirement): Firebase-auth accounts created only by the admin,
device-bound license keys (1 device), admin dashboard for users/sales (paid or free).
iOS App Store only (unlisted distribution target). Premium quality, no crashes, fast.

## User Personas
- **Admin (owner)**: sells licenses to magicians, manages users/pricing/devices from dashboard.
- **Performer (magician)**: configures the routine, performs for spectators, uses hidden Peek.
- **Spectator**: interacts only with the deceptive lock screen; sees zero debug info.

## Architecture
- `frontend/` Expo SDK 57 (expo-router, stack-only nav, dark-only theme).
- `src/engine/` — pure TypeScript performance engine (no RN/storage/network imports):
  types.ts, defaults.ts (reference routines), engine.ts (event engine + state machine +
  reconstruction), sessionStore.ts (in-memory session; only config persisted via
  `@/src/utils/storage` as JSON string), engine.test.ts (20 assertions, all brief §16 tests).
- `src/components/` — Keypad (monochrome, haptics + click sound pool via expo-audio),
  PasscodeDots (reanimated shake), UnlockedView (wallpaper, status bar, icon grid, dock),
  Symbol (SF Symbols on iOS + text fallback), wallpapers.ts (5 bundled presets + custom photo).
- Screens: `app/index.tsx` (performance: lock → slide-up unlock → home), `app/setup.tsx`
  (performer command center), `app/peek.tsx` (hidden summary).
- Backend (FastAPI + MongoDB): untouched template; Phase 3/4 will add auth/license/admin APIs.
- Firebase (Phase 3): project pinkey-6f079, bundle com.pinkey.app, plist stored at
  frontend/GoogleService-Info.plist. Service-account JSON still needed for backend Admin SDK.

## Core Requirements (static, from brief)
1. 4 modes × 2 entry lengths; event engine; chronological log; reconstruction rules.
2. Transform: mod-10 per-position offsets (2749 +4+1+3+2 → 6871 → reverse → 2749).
3. Scramble/Hybrid: non-linear positions, delete events retained, filler excluded.
4. Simulated unlock; Peek via 2s long-press; reset clears session; no debug state.
5. 100% offline engine; no real credential/private-data access ever.

## Implemented
- **2026-09-25 (Phase 1)**: Full engine + 20 passing unit tests (all brief acceptance tests
  1–13 + backspace/reset). Pure, offline, deterministic.
- **2026-09-25 (Phase 2)**: Spectator lock screen (live clock, dots, custom keypad, haptics,
  click sounds, wrong-attempt shake), Basic/Transform/Scramble/Hybrid flows, setup screen
  (mode, length, attempts 2–6, offsets editor with live preview + validation, routine script
  view, haptics/sound toggles), hidden Peek (long-press 2s, summary table + source events,
  New Session / Close), discreet setup entry (long-press "Emergency"). Testing agent: 29/29
  E2E assertions passed; 1 bug found (duplicate React key in Transform peek rows) — fixed.
- **2026-09-25 (Phase 2.5 — realism upgrade)**: iOS-style unlock transition (lock slides up,
  home fades in, icons stagger in), realistic home screen (status bar, labeled app grid,
  dock, home indicator), configurable wallpaper: 5 bundled cinematic presets (Midnight,
  Ocean, Forest, Sunset, Graphite — all offline) + performer's own photo via expo-image-picker
  (contextual permission flow with Open Settings fallback). Fixed 44pt steppers, brighter scrim.
  Bundle ID set to com.pinkey.app; app renamed PINKEY; dark UI pinned.

## Prioritized Backlog
- **P0 — Phase 3 (Auth & License Gate)**: Firebase email/password login (admin-created
  accounts only), license key activation bound to 1 device, offline grace window, revocation
  lock. Needs from user: Firebase web config + service-account JSON (backend).
- **P0 — Phase 4 (Admin Dashboard)**: users CRUD, license generate/suspend/revoke, price/free
  per sale, revenue summary, device unbind, audit log. `/api/admin/*` behind Firebase token +
  admin custom claim.
- **P1 — Phase 5 (App Store)**: icon/splash polish, privacy label, review demo account,
  unlisted distribution request, TestFlight, Publish flow.
- **P2 — Polish**: editable scramble/hybrid scripts in setup, peek via Apple Watch-style
  discreet haptic tap, performance analytics for admin, additional keypad themes.

## Next Tasks
1. Collect Firebase web config + service-account JSON from user.
2. Call integration_expert for Firebase Auth playbook; build login + license gate (Phase 3).
3. Build admin dashboard (Phase 4), then App Store readiness (Phase 5).

## Master Plan
Full phased plan with security/design per phase: /app/memory/PINKEY_MASTER_PLAN.md
