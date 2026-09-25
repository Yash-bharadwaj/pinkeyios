from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
import string
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone

from firebase_client import (
    init_firebase,
    verify_token,
    create_firebase_user,
    set_user_password,
    set_user_disabled,
    delete_firebase_user,
    set_role_claim,
    get_user_by_email,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("pinkey")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = ""
    price: float = 0.0
    currency: str = "USD"
    is_free: bool = False
    note: str = ""


class ActivateLicenseRequest(BaseModel):
    key: str
    device_id: str
    device_name: str = ""


class LicenseStatusRequest(BaseModel):
    device_id: str


class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=6)


class UpdateSaleRequest(BaseModel):
    price: Optional[float] = None
    currency: Optional[str] = None
    is_free: Optional[bool] = None
    refunded: Optional[bool] = None
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth dependencies
# ---------------------------------------------------------------------------
async def current_claims(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        return verify_token(token)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def current_user(claims: dict = Depends(current_claims)) -> dict:
    uid = claims["uid"]
    doc = await db.users.find_one({"id": uid})
    if not doc:
        # First-seen Firebase user with no profile — treat as unprovisioned.
        raise HTTPException(status_code=403, detail="No PINKEY profile for this account")
    if doc.get("status") == "disabled":
        raise HTTPException(status_code=403, detail="Account disabled")
    doc.pop("_id", None)
    return doc


async def require_admin(user: dict = Depends(current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def generate_license_key() -> str:
    alphabet = string.ascii_uppercase + string.digits
    groups = ["".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3)]
    return "PINK-" + "-".join(groups)


async def audit(actor_uid: str, action: str, target: str = "", meta: dict | None = None):
    await db.audit.insert_one(
        {
            "id": str(uuid.uuid4()),
            "actor_uid": actor_uid,
            "action": action,
            "target": target,
            "meta": meta or {},
            "created_at": now_iso(),
        }
    )


async def build_user_view(user_doc: dict) -> dict:
    """Compose a full admin-facing view: user + license + devices + latest sale."""
    uid = user_doc["id"]
    license_doc = await db.licenses.find_one({"uid": uid})
    devices = await db.devices.find({"uid": uid}).to_list(10)
    sale = await db.sales.find_one({"uid": uid}, sort=[("created_at", -1)])
    for d in devices:
        d.pop("_id", None)
    if license_doc:
        license_doc.pop("_id", None)
    if sale:
        sale.pop("_id", None)
    return {
        "id": uid,
        "email": user_doc.get("email"),
        "name": user_doc.get("name", ""),
        "role": user_doc.get("role"),
        "status": user_doc.get("status"),
        "created_at": user_doc.get("created_at"),
        "license": license_doc,
        "devices": devices,
        "sale": sale,
    }


# ---------------------------------------------------------------------------
# Public / performer routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "PINKEY API", "status": "ok"}


@api_router.get("/me")
async def me(user: dict = Depends(current_user)):
    """Returns the caller's profile + license gate status."""
    uid = user["id"]
    license_doc = await db.licenses.find_one({"uid": uid})
    device_count = await db.devices.count_documents({"uid": uid})
    gate = "open"
    reason = ""
    if user.get("role") == "admin":
        gate = "open"
    elif not license_doc:
        gate, reason = "blocked", "no_license"
    elif license_doc.get("status") == "revoked":
        gate, reason = "blocked", "revoked"
    elif license_doc.get("status") == "suspended":
        gate, reason = "blocked", "suspended"
    elif device_count == 0:
        gate, reason = "needs_activation", "not_activated"
    return {
        "id": uid,
        "email": user.get("email"),
        "name": user.get("name", ""),
        "role": user.get("role"),
        "gate": gate,
        "reason": reason,
        "license_status": license_doc.get("status") if license_doc else None,
    }


@api_router.post("/license/activate")
async def activate_license(req: ActivateLicenseRequest, user: dict = Depends(current_user)):
    uid = user["id"]
    key = req.key.strip().upper()
    license_doc = await db.licenses.find_one({"key": key})
    if not license_doc:
        raise HTTPException(status_code=404, detail="License key not found")
    if license_doc.get("uid") != uid:
        raise HTTPException(status_code=403, detail="This license belongs to another account")
    if license_doc.get("status") != "active":
        raise HTTPException(status_code=403, detail=f"License is {license_doc.get('status')}")

    max_devices = license_doc.get("max_devices", 1)
    existing = await db.devices.find({"license_id": license_doc["id"]}).to_list(10)
    already = next((d for d in existing if d["device_id"] == req.device_id), None)
    if already:
        return {"activated": True, "already": True}
    if len(existing) >= max_devices:
        raise HTTPException(
            status_code=409,
            detail="This license is already active on another device. Contact your seller to move it.",
        )
    await db.devices.insert_one(
        {
            "id": str(uuid.uuid4()),
            "license_id": license_doc["id"],
            "uid": uid,
            "device_id": req.device_id,
            "device_name": req.device_name,
            "bound_at": now_iso(),
        }
    )
    await audit(uid, "license.activate", license_doc["id"], {"device_id": req.device_id})
    return {"activated": True, "already": False}


@api_router.post("/license/status")
async def license_status(req: LicenseStatusRequest, user: dict = Depends(current_user)):
    """Online revalidation used by the client gate (revoke takes effect here)."""
    uid = user["id"]
    if user.get("role") == "admin":
        return {"valid": True, "gate": "open"}
    license_doc = await db.licenses.find_one({"uid": uid})
    if not license_doc:
        return {"valid": False, "gate": "blocked", "reason": "no_license"}
    if license_doc.get("status") != "active":
        return {"valid": False, "gate": "blocked", "reason": license_doc.get("status")}
    device = await db.devices.find_one({"uid": uid, "device_id": req.device_id})
    if not device:
        return {"valid": False, "gate": "needs_activation", "reason": "device_not_bound"}
    return {"valid": True, "gate": "open"}


# ---------------------------------------------------------------------------
# Admin routes
# ---------------------------------------------------------------------------
@api_router.get("/admin/users")
async def admin_list_users(admin: dict = Depends(require_admin), limit: int = 100, skip: int = 0):
    query = {"role": "performer", "status": {"$ne": "deleted"}}
    docs = await db.users.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    views = [await build_user_view(d) for d in docs]
    return {"users": views, "count": await db.users.count_documents(query)}


@api_router.post("/admin/users")
async def admin_create_user(req: CreateUserRequest, admin: dict = Depends(require_admin)):
    email = req.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    if get_user_by_email(email):
        raise HTTPException(status_code=409, detail="This email is already registered in Firebase")

    uid = create_firebase_user(email, req.password, req.name)
    set_role_claim(uid, "performer")
    created_at = now_iso()
    await db.users.insert_one(
        {
            "id": uid,
            "email": email,
            "name": req.name,
            "role": "performer",
            "status": "active",
            "created_at": created_at,
            "created_by": admin["id"],
        }
    )
    license_id = str(uuid.uuid4())
    key = generate_license_key()
    await db.licenses.insert_one(
        {
            "id": license_id,
            "key": key,
            "uid": uid,
            "status": "active",
            "max_devices": 1,
            "note": req.note,
            "created_at": created_at,
        }
    )
    amount = 0.0 if req.is_free else float(req.price)
    sale_id = str(uuid.uuid4())
    await db.sales.insert_one(
        {
            "id": sale_id,
            "uid": uid,
            "license_id": license_id,
            "amount": amount,
            "currency": req.currency,
            "is_free": req.is_free,
            "refunded": False,
            "note": req.note,
            "created_at": created_at,
        }
    )
    await audit(admin["id"], "user.create", uid, {"email": email, "amount": amount, "currency": req.currency})
    return {"uid": uid, "email": email, "license_key": key}


@api_router.post("/admin/users/{uid}/status")
async def admin_set_status(uid: str, disabled: bool, admin: dict = Depends(require_admin)):
    user_doc = await db.users.find_one({"id": uid, "role": "performer"})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    set_user_disabled(uid, disabled)
    await db.users.update_one({"id": uid}, {"$set": {"status": "disabled" if disabled else "active"}})
    await audit(admin["id"], "user.disable" if disabled else "user.enable", uid)
    return {"ok": True}


@api_router.post("/admin/users/{uid}/reset-password")
async def admin_reset_password(uid: str, req: ResetPasswordRequest, admin: dict = Depends(require_admin)):
    if not await db.users.find_one({"id": uid, "role": "performer"}):
        raise HTTPException(status_code=404, detail="User not found")
    set_user_password(uid, req.password)
    await audit(admin["id"], "user.reset_password", uid)
    return {"ok": True}


@api_router.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, admin: dict = Depends(require_admin)):
    user_doc = await db.users.find_one({"id": uid, "role": "performer"})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        delete_firebase_user(uid)
    except Exception as e:  # noqa: BLE001
        logger.warning("firebase delete_user failed for %s: %s", uid, e)
    # Soft-delete profile, hard-remove device bindings so a re-issued license is clean.
    await db.users.update_one({"id": uid}, {"$set": {"status": "deleted", "deleted_at": now_iso()}})
    await db.licenses.update_many({"uid": uid}, {"$set": {"status": "revoked"}})
    await db.devices.delete_many({"uid": uid})
    await audit(admin["id"], "user.delete", uid)
    return {"ok": True}


@api_router.post("/admin/licenses/{license_id}/set")
async def admin_set_license(license_id: str, status: str, admin: dict = Depends(require_admin)):
    if status not in ("active", "suspended", "revoked"):
        raise HTTPException(status_code=400, detail="Invalid status")
    license_doc = await db.licenses.find_one({"id": license_id})
    if not license_doc:
        raise HTTPException(status_code=404, detail="License not found")
    await db.licenses.update_one({"id": license_id}, {"$set": {"status": status}})
    await audit(admin["id"], f"license.{status}", license_id)
    return {"ok": True}


@api_router.post("/admin/licenses/{license_id}/unbind")
async def admin_unbind_devices(license_id: str, admin: dict = Depends(require_admin)):
    license_doc = await db.licenses.find_one({"id": license_id})
    if not license_doc:
        raise HTTPException(status_code=404, detail="License not found")
    result = await db.devices.delete_many({"license_id": license_id})
    await audit(admin["id"], "license.unbind", license_id, {"removed": result.deleted_count})
    return {"ok": True, "removed": result.deleted_count}


@api_router.patch("/admin/sales/{sale_id}")
async def admin_update_sale(sale_id: str, req: UpdateSaleRequest, admin: dict = Depends(require_admin)):
    sale = await db.sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    update: dict = {}
    if req.is_free is not None:
        update["is_free"] = req.is_free
        if req.is_free:
            update["amount"] = 0.0
    if req.price is not None and not update.get("is_free", sale.get("is_free")):
        update["amount"] = float(req.price)
    if req.currency is not None:
        update["currency"] = req.currency
    if req.refunded is not None:
        update["refunded"] = req.refunded
    if req.note is not None:
        update["note"] = req.note
    if update:
        await db.sales.update_one({"id": sale_id}, {"$set": update})
    await audit(admin["id"], "sale.update", sale_id, update)
    return {"ok": True}


@api_router.get("/admin/sales/summary")
async def admin_sales_summary(admin: dict = Depends(require_admin)):
    pipeline = [
        {"$match": {"refunded": {"$ne": True}, "is_free": {"$ne": True}}},
        {"$group": {"_id": "$currency", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    by_currency = {}
    async for row in db.sales.aggregate(pipeline):
        by_currency[row["_id"] or "USD"] = {"total": round(row["total"], 2), "count": row["count"]}
    total_users = await db.users.count_documents({"role": "performer", "status": {"$ne": "deleted"}})
    free_count = await db.sales.count_documents({"is_free": True})
    paid_count = await db.sales.count_documents({"is_free": {"$ne": True}, "refunded": {"$ne": True}})
    refunded_count = await db.sales.count_documents({"refunded": True})
    active_licenses = await db.licenses.count_documents({"status": "active"})
    return {
        "by_currency": by_currency,
        "total_users": total_users,
        "free_count": free_count,
        "paid_count": paid_count,
        "refunded_count": refunded_count,
        "active_licenses": active_licenses,
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def seed_admin():
    """Ensure the owner admin account exists in Firebase + Mongo (idempotent)."""
    email = os.environ["ADMIN_EMAIL"].lower().strip()
    password = os.environ["ADMIN_PASSWORD"]
    name = os.environ.get("ADMIN_NAME", "Owner")
    fb_user = get_user_by_email(email)
    if fb_user is None:
        uid = create_firebase_user(email, password, name)
    else:
        uid = fb_user.uid
    set_role_claim(uid, "admin")
    existing = await db.users.find_one({"id": uid})
    if not existing:
        await db.users.insert_one(
            {
                "id": uid,
                "email": email,
                "name": name,
                "role": "admin",
                "status": "active",
                "created_at": now_iso(),
                "created_by": "system",
            }
        )
    else:
        await db.users.update_one({"id": uid}, {"$set": {"role": "admin", "status": "active"}})
    logger.info("Admin seeded: %s (uid=%s)", email, uid)


@app.on_event("startup")
async def startup():
    init_firebase()
    await db.licenses.create_index("key", unique=True)
    await db.users.create_index("email")
    await db.devices.create_index("device_id")
    try:
        await seed_admin()
    except Exception as e:  # noqa: BLE001
        logger.error("Admin seed failed: %s", e)


@app.on_event("shutdown")
async def shutdown():
    client.close()
