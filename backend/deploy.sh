#!/usr/bin/env bash
# Deploy the PINKEY backend to Google Cloud Run.
#
# Usage:  ./deploy.sh <gcp-project-id>
#
# Reads config from ./.env, pushes the sensitive values into Secret Manager,
# builds the container with Cloud Build (no local Docker needed) and deploys.
# Safe to re-run: every step is idempotent, so this doubles as the redeploy
# command after a code change.

set -euo pipefail

PROJECT="${1:?usage: ./deploy.sh <gcp-project-id>}"
REGION="${REGION:-asia-south1}"     # Mumbai, same region as the Atlas cluster
SERVICE="pinkey-api"

cd "$(dirname "$0")"
[[ -f .env ]] || { echo "ERROR: .env not found next to deploy.sh"; exit 1; }

# --- read .env without leaking values into the shell log -------------------
get() { grep -E "^$1=" .env | head -1 | cut -d= -f2- ; }

MONGO_URL=$(get MONGO_URL)
DB_NAME=$(get DB_NAME)
FIREBASE_SERVICE_ACCOUNT_B64=$(get FIREBASE_SERVICE_ACCOUNT_B64)
FIREBASE_WEB_API_KEY=$(get FIREBASE_WEB_API_KEY)
ADMIN_EMAIL=$(get ADMIN_EMAIL)
ADMIN_PASSWORD=$(get ADMIN_PASSWORD)
ADMIN_NAME=$(get ADMIN_NAME)

if [[ "$MONGO_URL" == *localhost* ]]; then
  echo "ERROR: MONGO_URL still points at localhost. Put the Atlas"
  echo "       connection string in backend/.env before deploying."
  exit 1
fi

echo "==> Project: $PROJECT   Region: $REGION   Service: $SERVICE"

echo "==> Enabling APIs (first run takes a minute)"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT"

# --- secrets --------------------------------------------------------------
put_secret() {
  local name="$1" value="$2"
  if ! gcloud secrets describe "$name" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic --project="$PROJECT" >/dev/null
    echo "    created secret $name"
  fi
  # Only add a version when the value actually changed, to avoid version sprawl.
  local current
  current=$(gcloud secrets versions access latest --secret="$name" --project="$PROJECT" 2>/dev/null || echo "")
  if [[ "$current" != "$value" ]]; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT" >/dev/null
    echo "    updated secret $name"
  else
    echo "    secret $name unchanged"
  fi
}

echo "==> Syncing secrets to Secret Manager"
put_secret pinkey-mongo-url            "$MONGO_URL"
put_secret pinkey-firebase-sa-b64      "$FIREBASE_SERVICE_ACCOUNT_B64"
put_secret pinkey-firebase-web-api-key "$FIREBASE_WEB_API_KEY"
put_secret pinkey-admin-password       "$ADMIN_PASSWORD"

# --- let the runtime service account read those secrets -------------------
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "==> Granting secret access to $RUNTIME_SA"
for s in pinkey-mongo-url pinkey-firebase-sa-b64 pinkey-firebase-web-api-key pinkey-admin-password; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role=roles/secretmanager.secretAccessor \
    --project="$PROJECT" >/dev/null 2>&1 || true
done

# --- build + deploy -------------------------------------------------------
# Sized for ~500 users: 80 concurrent requests per instance and up to 10
# instances is ~800 in-flight requests. min-instances=1 keeps one warm so
# testers never hit a cold start.
echo "==> Building and deploying (Cloud Build; a few minutes on first run)"
gcloud run deploy "$SERVICE" \
  --source . \
  --project="$PROJECT" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=80 \
  --min-instances=1 \
  --max-instances=10 \
  --timeout=60s \
  --set-env-vars="DB_NAME=${DB_NAME},ADMIN_EMAIL=${ADMIN_EMAIL},ADMIN_NAME=${ADMIN_NAME}" \
  --set-secrets="MONGO_URL=pinkey-mongo-url:latest,FIREBASE_SERVICE_ACCOUNT_B64=pinkey-firebase-sa-b64:latest,FIREBASE_WEB_API_KEY=pinkey-firebase-web-api-key:latest,ADMIN_PASSWORD=pinkey-admin-password:latest"

URL=$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='value(status.url)')
echo
echo "==> Deployed: $URL"
echo "==> Health:"
curl -fsS "$URL/health" && echo
echo
echo "Next: put this in frontend/.env then rebuild the app"
echo "  EXPO_PUBLIC_BACKEND_URL=$URL"
