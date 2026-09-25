"""Firebase Admin SDK singleton + auth helpers for PINKEY backend."""
import base64
import json
import os

import firebase_admin
from firebase_admin import auth, credentials

_initialized = False


def init_firebase() -> None:
    global _initialized
    if _initialized or firebase_admin._apps:
        _initialized = True
        return
    b64 = os.environ["FIREBASE_SERVICE_ACCOUNT_B64"]
    sa = json.loads(base64.b64decode(b64))
    cred = credentials.Certificate(sa)
    firebase_admin.initialize_app(cred)
    _initialized = True


def verify_token(id_token: str) -> dict:
    """Verify a Firebase ID token; returns decoded claims (raises on failure)."""
    return auth.verify_id_token(id_token)


def create_firebase_user(email: str, password: str, display_name: str) -> str:
    user = auth.create_user(email=email, password=password, display_name=display_name)
    return user.uid


def set_user_password(uid: str, password: str) -> None:
    auth.update_user(uid, password=password)


def set_user_disabled(uid: str, disabled: bool) -> None:
    auth.update_user(uid, disabled=disabled)


def delete_firebase_user(uid: str) -> None:
    auth.delete_user(uid)


def set_role_claim(uid: str, role: str) -> None:
    auth.set_custom_user_claims(uid, {"role": role})


def get_user_by_email(email: str):
    try:
        return auth.get_user_by_email(email)
    except auth.UserNotFoundError:
        return None
