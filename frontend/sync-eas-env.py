#!/usr/bin/env python3
"""Copy the EXPO_PUBLIC_* values from frontend/.env into eas.json.

EAS Build honours .gitignore, and .env is gitignored, so it never reaches the
build machine -- an APK built without this step ships with an undefined
backend URL and undefined Firebase config. These values are not secrets: the
Expo bundler inlines EXPO_PUBLIC_* into the JS bundle, so they are already
readable in any shipped build. Firebase web config is public by design;
access is controlled by Firebase Security Rules, not by hiding the API key.

Usage:  ./sync-eas-env.py [backend-url]
        (backend-url overrides EXPO_PUBLIC_BACKEND_URL and is written to .env)
"""
import json
import pathlib
import sys

here = pathlib.Path(__file__).parent
env_path = here / ".env"
eas_path = here / "eas.json"

env = {}
for line in env_path.read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

if len(sys.argv) > 1:
    new_url = sys.argv[1].rstrip("/")
    env["EXPO_PUBLIC_BACKEND_URL"] = new_url
    lines = [
        f"EXPO_PUBLIC_BACKEND_URL={new_url}" if l.startswith("EXPO_PUBLIC_BACKEND_URL=") else l
        for l in env_path.read_text().splitlines()
    ]
    env_path.write_text("\n".join(lines) + "\n")
    print(f"  .env    EXPO_PUBLIC_BACKEND_URL -> {new_url}")

public = {k: v for k, v in env.items() if k.startswith("EXPO_PUBLIC_")}
missing = [k for k, v in public.items() if not v]
if missing:
    sys.exit(f"ERROR: empty values in .env: {missing}")
if "EXPO_PUBLIC_BACKEND_URL" not in public:
    sys.exit("ERROR: EXPO_PUBLIC_BACKEND_URL missing from .env")

eas = json.loads(eas_path.read_text())
for profile in ("development", "preview", "production"):
    eas["build"].setdefault(profile, {})["env"] = dict(sorted(public.items()))

eas_path.write_text(json.dumps(eas, indent=2) + "\n")
print(f"  eas.json {len(public)} EXPO_PUBLIC_* vars -> development, preview, production")
print(f"  backend  {public['EXPO_PUBLIC_BACKEND_URL']}")
