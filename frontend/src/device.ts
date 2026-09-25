// A stable per-install device identifier (secure storage). Used to bind a
// license to a single device. Not tied to any real OS/hardware identifier.
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const DEVICE_ID_KEY = "pinkey.device_id";

function randomId(): string {
  return (
    "dev_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

export async function getDeviceId(): Promise<string> {
  const existing = await storage.secureGet(DEVICE_ID_KEY, "");
  if (existing) return existing;
  const id = randomId();
  await storage.secureSet(DEVICE_ID_KEY, id);
  return id;
}

export function getDeviceName(): string {
  if (Platform.OS === "ios") return "iPhone";
  if (Platform.OS === "android") return "Android";
  return "Web";
}
