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
from datetime import datetime, timedelta, timezone
from calendar import month_abbr

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
    duration_days: Optional[int] = None  # None = perpetual license


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


class SetExpiryRequest(BaseModel):
    duration_days: Optional[int] = None  # None clears the expiry (perpetual)


class RequestDeviceChangeRequest(BaseModel):
    device_id: str
    device_name: str = ""


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


def is_expired(license_doc: dict) -> bool:
    expires_at = license_doc.get("expires_at")
    if not expires_at:
        return False
    return datetime.now(timezone.utc) >= datetime.fromisoformat(expires_at)


def effective_license_status(license_doc: dict | None) -> str | None:
    """The license's status as the gate should see it — expiry overrides a
    stored 'active' status without needing a background job."""
    if not license_doc:
        return None
    if license_doc.get("status") == "active" and is_expired(license_doc):
        return "expired"
    return license_doc.get("status")


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
        license_doc["effective_status"] = effective_license_status(license_doc)
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
        # Deliberately stored in readable form so the admin can re-share it —
        # see admin_create_user / admin_reset_password for where it's set.
        "current_password": user_doc.get("current_password"),
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
    status = effective_license_status(license_doc)
    if user.get("role") == "admin":
        gate = "open"
    elif not license_doc:
        gate, reason = "blocked", "no_license"
    elif status == "revoked":
        gate, reason = "blocked", "revoked"
    elif status == "suspended":
        gate, reason = "blocked", "suspended"
    elif status == "expired":
        gate, reason = "blocked", "expired"
    elif device_count == 0:
        gate, reason = "needs_activation", "not_activated"
    return {
        "id": uid,
        "email": user.get("email"),
        "name": user.get("name", ""),
        "role": user.get("role"),
        "gate": gate,
        "reason": reason,
        "license_status": status,
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
    status = effective_license_status(license_doc)
    if status != "active":
        raise HTTPException(status_code=403, detail=f"License is {status}")

    max_devices = license_doc.get("max_devices", 1)
    existing = await db.devices.find({"license_id": license_doc["id"]}).to_list(10)
    already = next((d for d in existing if d["device_id"] == req.device_id), None)
    if already:
        return {"activated": True, "already": True}
    if len(existing) >= max_devices:
        raise HTTPException(
            status_code=409,
            detail="This license is already active on another device. Request a device change from the app, or contact your seller to move it.",
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
    status = effective_license_status(license_doc)
    if status != "active":
        return {"valid": False, "gate": "blocked", "reason": status}
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
        raise HTTPException(status_code=409, detail="That email already exists. Try a different email.")
    if get_user_by_email(email):
        raise HTTPException(status_code=409, detail="That email already exists. Try a different email.")

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
            "current_password": req.password,
        }
    )
    license_id = str(uuid.uuid4())
    key = generate_license_key()
    expires_at = (
        (datetime.now(timezone.utc) + timedelta(days=req.duration_days)).isoformat()
        if req.duration_days
        else None
    )
    await db.licenses.insert_one(
        {
            "id": license_id,
            "key": key,
            "uid": uid,
            "status": "active",
            "max_devices": 1,
            "note": req.note,
            "created_at": created_at,
            "expires_at": expires_at,
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
    await db.users.update_one({"id": uid}, {"$set": {"current_password": req.password}})
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
    # Soft-delete profile, hard-remove device bindings so a re-issued license is
    # clean. The account is gone in Firebase either way, so the stored password
    # is no longer useful — drop it rather than let it sit around.
    await db.users.update_one(
        {"id": uid},
        {"$set": {"status": "deleted", "deleted_at": now_iso()}, "$unset": {"current_password": ""}},
    )
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


@api_router.patch("/admin/licenses/{license_id}/expiry")
async def admin_set_expiry(license_id: str, req: SetExpiryRequest, admin: dict = Depends(require_admin)):
    license_doc = await db.licenses.find_one({"id": license_id})
    if not license_doc:
        raise HTTPException(status_code=404, detail="License not found")
    expires_at = (
        (datetime.now(timezone.utc) + timedelta(days=req.duration_days)).isoformat()
        if req.duration_days
        else None
    )
    await db.licenses.update_one({"id": license_id}, {"$set": {"expires_at": expires_at}})
    await audit(admin["id"], "license.set_expiry", license_id, {"duration_days": req.duration_days})
    return {"ok": True, "expires_at": expires_at}


# ---------------------------------------------------------------------------
# Device change requests — a magician asks to move their license to a new
# device; the admin approves with one tap from the dashboard.
# ---------------------------------------------------------------------------
@api_router.post("/license/request-device-change")
async def request_device_change(req: RequestDeviceChangeRequest, user: dict = Depends(current_user)):
    uid = user["id"]
    license_doc = await db.licenses.find_one({"uid": uid})
    if not license_doc:
        raise HTTPException(status_code=404, detail="No license found for this account")
    if license_doc.get("status") == "revoked":
        raise HTTPException(status_code=403, detail="This license has been revoked")
    # Only one open request per license at a time — replace any prior pending one.
    await db.device_requests.update_many(
        {"license_id": license_doc["id"], "status": "pending"},
        {"$set": {"status": "superseded", "resolved_at": now_iso()}},
    )
    request_id = str(uuid.uuid4())
    await db.device_requests.insert_one(
        {
            "id": request_id,
            "uid": uid,
            "license_id": license_doc["id"],
            "device_id": req.device_id,
            "device_name": req.device_name,
            "status": "pending",
            "created_at": now_iso(),
        }
    )
    await audit(uid, "device_request.create", request_id, {"device_id": req.device_id})
    return {"ok": True, "request_id": request_id}


@api_router.get("/admin/device-requests")
async def admin_list_device_requests(admin: dict = Depends(require_admin)):
    docs = await db.device_requests.find({"status": "pending"}).sort("created_at", -1).to_list(50)
    out = []
    for d in docs:
        d.pop("_id", None)
        user_doc = await db.users.find_one({"id": d["uid"]})
        license_doc = await db.licenses.find_one({"id": d["license_id"]})
        out.append(
            {
                **d,
                "email": user_doc.get("email") if user_doc else None,
                "license_key": license_doc.get("key") if license_doc else None,
            }
        )
    return {"requests": out}


@api_router.post("/admin/device-requests/{request_id}/approve")
async def admin_approve_device_request(request_id: str, admin: dict = Depends(require_admin)):
    req_doc = await db.device_requests.find_one({"id": request_id})
    if not req_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    if req_doc.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Request already resolved")
    license_id = req_doc["license_id"]
    await db.devices.delete_many({"license_id": license_id})
    await db.devices.insert_one(
        {
            "id": str(uuid.uuid4()),
            "license_id": license_id,
            "uid": req_doc["uid"],
            "device_id": req_doc["device_id"],
            "device_name": req_doc.get("device_name", ""),
            "bound_at": now_iso(),
        }
    )
    await db.device_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "resolved_at": now_iso(), "resolved_by": admin["id"]}},
    )
    await audit(admin["id"], "device_request.approve", request_id, {"license_id": license_id})
    return {"ok": True}


@api_router.post("/admin/device-requests/{request_id}/deny")
async def admin_deny_device_request(request_id: str, admin: dict = Depends(require_admin)):
    req_doc = await db.device_requests.find_one({"id": request_id})
    if not req_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    if req_doc.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Request already resolved")
    await db.device_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "denied", "resolved_at": now_iso(), "resolved_by": admin["id"]}},
    )
    await audit(admin["id"], "device_request.deny", request_id)
    return {"ok": True}


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


async def active_performer_uids() -> list[str]:
    """Sales/license rows outlive a soft-deleted user for audit purposes, but
    admin-facing aggregates must never count them — otherwise a deleted
    account's old sale keeps inflating totals forever."""
    return [u["id"] async for u in db.users.find({"status": {"$ne": "deleted"}}, {"id": 1})]


@api_router.get("/admin/sales/summary")
async def admin_sales_summary(admin: dict = Depends(require_admin)):
    uids = await active_performer_uids()
    pipeline = [
        {"$match": {"uid": {"$in": uids}, "refunded": {"$ne": True}, "is_free": {"$ne": True}}},
        {"$group": {"_id": "$currency", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    by_currency = {}
    async for row in db.sales.aggregate(pipeline):
        by_currency[row["_id"] or "USD"] = {"total": round(row["total"], 2), "count": row["count"]}
    total_users = await db.users.count_documents({"role": "performer", "status": {"$ne": "deleted"}})
    free_count = await db.sales.count_documents({"uid": {"$in": uids}, "is_free": True})
    paid_count = await db.sales.count_documents({"uid": {"$in": uids}, "is_free": {"$ne": True}, "refunded": {"$ne": True}})
    refunded_count = await db.sales.count_documents({"uid": {"$in": uids}, "refunded": True})
    active_licenses = await db.licenses.count_documents({"uid": {"$in": uids}, "status": "active"})
    return {
        "by_currency": by_currency,
        "total_users": total_users,
        "free_count": free_count,
        "paid_count": paid_count,
        "refunded_count": refunded_count,
        "active_licenses": active_licenses,
    }


@api_router.get("/admin/sales/insights")
async def admin_sales_insights(admin: dict = Depends(require_admin), months: int = 12):
    uids = await active_performer_uids()
    now = datetime.now(timezone.utc)
    # Build the last N calendar months (oldest first) as "YYYY-MM" keys.
    month_keys: list[str] = []
    y, m = now.year, now.month
    for _ in range(months):
        month_keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    month_keys.reverse()
    earliest = month_keys[0] + "-01T00:00:00"

    pipeline = [
        {"$match": {"uid": {"$in": uids}, "refunded": {"$ne": True}, "is_free": {"$ne": True}, "created_at": {"$gte": earliest}}},
        {"$addFields": {"month": {"$substrCP": ["$created_at", 0, 7]}}},
        {
            "$group": {
                "_id": {"month": "$month", "currency": "$currency"},
                "total": {"$sum": "$amount"},
                "count": {"$sum": 1},
            }
        },
    ]
    by_month_currency: dict[str, dict[str, dict]] = {k: {} for k in month_keys}
    all_entries: list[dict] = []
    async for row in db.sales.aggregate(pipeline):
        month = row["_id"]["month"]
        currency = row["_id"]["currency"] or "USD"
        entry = {"total": round(row["total"], 2), "count": row["count"]}
        if month in by_month_currency:
            by_month_currency[month][currency] = entry
        all_entries.append({"month": month, "currency": currency, **entry})

    monthly = [
        {"month": k, "label": f"{month_abbr[int(k.split('-')[1])]}", "by_currency": by_month_currency[k]}
        for k in month_keys
    ]
    top = sorted(all_entries, key=lambda e: e["total"], reverse=True)[:5]

    return {"monthly": monthly, "top": top}


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
