// PINKEY auth + license gate. Wraps the whole app.
//
// Gate states:
//   loading         — still resolving Firebase session / backend profile
//   signed-out      — no Firebase user → Login screen
//   needs-activation— performer without a bound device → Activate screen
//   blocked         — license revoked/suspended/disabled → Blocked screen
//   open-admin      — admin → dashboard available + performance
//   open-performer  — licensed performer → performance
//
// Revocation policy: "next time the app has internet". We cache the last
// successful grant; offline within a grace window keeps the app open, but an
// online check that returns invalid locks immediately.

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { getMe, licenseStatus, type MeResponse } from "@/src/api";
import { getDeviceId } from "@/src/device";
import { auth } from "@/src/firebase";
import { storage } from "@/src/utils/storage";

const GRANT_KEY = "pinkey.grant"; // cached { role, uid, at }
const GRACE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days offline grace

export type GateState =
  | "loading"
  | "signed-out"
  | "needs-activation"
  | "blocked"
  | "open-admin"
  | "open-performer";

interface CachedGrant {
  role: "admin" | "performer";
  uid: string;
  at: number;
}

interface AuthValue {
  gate: GateState;
  user: User | null;
  profile: MeResponse | null;
  blockReason: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [gate, setGate] = useState<GateState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const resolve = useCallback(async (fbUser: User | null) => {
    if (!fbUser) {
      setProfile(null);
      setGate("signed-out");
      return;
    }
    setUser(fbUser);
    try {
      const me = await getMe();
      setProfile(me);
      if (me.role === "admin") {
        await storage.setItem(
          GRANT_KEY,
          JSON.stringify({ role: "admin", uid: me.id, at: Date.now() } as CachedGrant),
        );
        setGate("open-admin");
        return;
      }
      // performer: verify license + device online
      if (me.gate === "blocked") {
        setBlockReason(me.reason);
        setGate("blocked");
        await storage.removeItem(GRANT_KEY);
        return;
      }
      if (me.gate === "needs_activation") {
        setGate("needs-activation");
        return;
      }
      const deviceId = await getDeviceId();
      const status = await licenseStatus(deviceId);
      if (status.gate === "open") {
        await storage.setItem(
          GRANT_KEY,
          JSON.stringify({ role: "performer", uid: me.id, at: Date.now() } as CachedGrant),
        );
        setGate("open-performer");
      } else if (status.gate === "needs_activation") {
        setGate("needs-activation");
      } else {
        setBlockReason(status.reason ?? "revoked");
        setGate("blocked");
        await storage.removeItem(GRANT_KEY);
      }
    } catch (e) {
      // Offline (or backend unreachable): fall back to cached grant within grace.
      const raw = await storage.getItem(GRANT_KEY, "");
      if (raw) {
        try {
          const grant = JSON.parse(raw) as CachedGrant;
          if (grant.uid === fbUser.uid && Date.now() - grant.at < GRACE_MS) {
            setGate(grant.role === "admin" ? "open-admin" : "open-performer");
            return;
          }
        } catch {
          /* ignore */
        }
      }
      setBlockReason("offline");
      setGate("blocked");
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      setGate("loading");
      resolve(fbUser);
    });
    return unsub;
  }, [resolve]);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    // onAuthStateChanged drives the rest.
  }, []);

  const logout = useCallback(async () => {
    await storage.removeItem(GRANT_KEY);
    await signOut(auth);
  }, []);

  const refresh = useCallback(async () => {
    setGate("loading");
    await resolve(auth.currentUser);
  }, [resolve]);

  return (
    <AuthContext.Provider
      value={{ gate, user, profile, blockReason, login, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}
