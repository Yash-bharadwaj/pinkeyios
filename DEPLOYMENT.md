# PINKEY — Infrastructure & Deployment

Audience: whoever maintains this project (you, or a dev you hand it to).

## What is running where

| Piece | Where | Detail |
|---|---|---|
| Backend API | Google Cloud Run | project `pinkey-6f079`, region `asia-south1` (Mumbai), service `pinkey-api` |
| Public URL | https://pinkey-api-885349751083.asia-south1.run.app | HTTPS + certificate managed by Google |
| Database | MongoDB Atlas M0 (free) | cluster `pinkey`, host `pinkey.zyjzwz.mongodb.net`, GCP Mumbai, db name `pinkey` |
| Auth | Firebase Auth | project `pinkey-6f079` — unchanged, was already live |
| Secrets | GCP Secret Manager | `pinkey-mongo-url`, `pinkey-firebase-sa-b64`, `pinkey-firebase-web-api-key`, `pinkey-admin-password` |
| Android app | EAS Build | `@yashwanthbharadwaj/pinkey`, `preview` profile → installable APK |
| Uptime check | Cloud Monitoring | `/health` every 5 min from 3 continents, asserts body contains `"db":"up"` |
| Alerting | Cloud Monitoring | policy "PINKEY API is down" → email to yashwanthmantha1@gmail.com, auto-closes after 30 min |
| Budget alert | Cloud Billing | ₹1500/mo, alerts at 50% / 90% / 100%, scoped to this project only |

The backend lives in the same GCP project as Firebase, so the Firebase Admin
SDK and the API share one project and one billing line.

## Deploying a backend change

```bash
cd backend
./deploy.sh pinkey-6f079
```

Idempotent — it is both the first-deploy and the redeploy command. It syncs
secrets (only writing a new version when a value actually changed), builds via
Cloud Build, deploys, then curls `/health`. No local Docker needed.

`.env` is the source of truth for config and is **never** uploaded: it is
listed in `.gcloudignore`, and the values reach the service through Secret
Manager. Do not commit it.

## Deploying an app change

The Expo bundler **inlines** every `EXPO_PUBLIC_*` value into the JS bundle at
build time, and EAS Build honours `.gitignore` — where `.env` sits. So `.env`
never reaches the build machine, and the values must also live in `eas.json`.
Keep the two in sync with:

```bash
cd frontend
python3 ./sync-eas-env.py                      # copy .env -> eas.json
python3 ./sync-eas-env.py https://new-url      # change backend URL in both
eas build --platform android --profile preview # ~15-20 min on the free queue
```

The same values are also stored server-side on EAS (`eas env:list preview`).
The `eas.json` `env` block wins when both exist, but keep them matching or a
future build will silently pick up a stale URL. This already happened once:
the EAS `preview` environment still held the old ngrok URL.

## Scaling to ~500 users

Current Cloud Run config: `cpu=1`, `memory=512Mi`, `concurrency=80`,
`min-instances=1`, `max-instances=10`. That is ~800 simultaneous in-flight
requests before it refuses work, which is far above what 500 users generate.
`min-instances=1` keeps one instance warm so nobody hits a cold start.

Do these before the user count grows:

1. **Lock down Atlas network access.** It is currently open to `0.0.0.0/0`
   because Cloud Run has no fixed outbound IP. Fix properly with a Serverless
   VPC connector + Cloud NAT with a static IP, then allow only that IP.
   This is the one real security gap in the current setup.
2. **Atlas tier.** M0 is 512MB and shared CPU. Fine for 500 licence records,
   but it has no backups worth relying on. Move to M10 for automated backups
   and dedicated resources before this holds real customer money.
3. **Rotate the admin password.** `ADMIN_PASSWORD` seeds the owner account on
   every cold start. It is in Secret Manager now, but it was previously in a
   plaintext `.env` committed nowhere yet readable locally.
4. **`current_password` in Mongo.** `server.py` deliberately stores user
   passwords in readable form so the admin can re-share them. That is a
   deliberate product decision, but it means a database breach exposes
   customer passwords directly. Worth revisiting before scale.
5. **Confirm the alert email.** An alert policy ("PINKEY API is down") emails
   yashwanthmantha1@gmail.com when the uptime check fails twice in a row.
   Google may require you to confirm the email channel once -- check your inbox
   and verify it, or the alerts go nowhere.

## Costs

| Item | Cost |
|---|---|
| Cloud Run | ~$0-8/mo at this scale; `min-instances=1` is the bulk of it |
| Cloud Build | 120 free build-min/day, then ~$0.003/min |
| Artifact Registry | ~$0.10/GB/mo for stored images |
| Secret Manager | ~$0.06/secret/mo |
| MongoDB Atlas M0 | free |
| Firebase Auth | free at this volume |
| EAS Build | free tier, queued builds |

## Known issues

- **Test suite is not parallel-safe against a remote backend.** `pytest.ini`
  sets `-n 2`; all 47 tests pass serially against Cloud Run but ~20 fail in
  parallel because they share one admin account and one database (e.g.
  `test_sales_insights_shape` asserts over all sales while another worker is
  creating users). Run `pytest -n 0` against a deployed backend.
- **No `expo-updates`.** Every JS change needs a fresh APK and a manual
  reinstall by each tester. Adding `expo-updates` + EAS Update would let you
  ship JS fixes over the air, but it is a native dependency change and needs
  one new build.
- **`EXPO_PUBLIC_FIREBASE_APP_ID` is an iOS app id** (`1:...:ios:...`) used on
  Android too. Harmless for Firebase Auth via the JS SDK, which keys off
  `apiKey`, but register a Web app in Firebase for correct analytics.
- **iOS has no remote test path** without an Apple Developer Program
  membership ($99/yr). Expo Go can run SDK 57, but only from a dev server with
  the tester signed in — not unattended.

## Backups of files changed during setup

- `backend/server.py.prehost.bak` — before lifespan/pooling/health changes
- `backend/requirements.emergent-full.txt.bak` — the original 180-package list
- `backend/.env.localdev.bak` — `.env` when `MONGO_URL` was localhost
