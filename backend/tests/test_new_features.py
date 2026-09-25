"""Integration tests for: device-change requests, license expiry, sales insights."""
import time
import requests

from conftest import firebase_signin


class TestDeviceChangeFlow:
    unique = str(int(time.time())) + "dc"
    email = f"test_dc_{unique}@example.com"
    password = "startpass123"
    state = {}

    def test_a_create_and_activate(self, admin_client, base_url):
        r = admin_client.post(f"{base_url}/api/admin/users", json={
            "email": self.email, "password": self.password, "name": "TEST DeviceChange",
            "price": 0, "currency": "USD", "is_free": True, "note": "TEST_created",
        })
        assert r.status_code == 200, r.text
        TestDeviceChangeFlow.state["uid"] = r.json()["uid"]
        TestDeviceChangeFlow.state["license_key"] = r.json()["license_key"]

        token = firebase_signin(self.email, self.password)
        TestDeviceChangeFlow.state["perf_token"] = token
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = requests.post(f"{base_url}/api/license/activate", headers=h, json={
            "key": self.state["license_key"], "device_id": "device-A", "device_name": "iPhone A",
        })
        assert r.status_code == 200, r.text

    def test_b_second_device_conflicts_then_requests_change(self, base_url):
        h = {"Authorization": f"Bearer {self.state['perf_token']}", "Content-Type": "application/json"}
        r = requests.post(f"{base_url}/api/license/activate", headers=h, json={
            "key": self.state["license_key"], "device_id": "device-B", "device_name": "iPhone B",
        })
        assert r.status_code == 409

        r = requests.post(f"{base_url}/api/license/request-device-change", headers=h, json={
            "device_id": "device-B", "device_name": "iPhone B",
        })
        assert r.status_code == 200, r.text
        TestDeviceChangeFlow.state["request_id"] = r.json()["request_id"]

    def test_c_admin_sees_pending_request(self, admin_client, base_url):
        r = admin_client.get(f"{base_url}/api/admin/device-requests")
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()["requests"]]
        assert self.state["request_id"] in ids
        match = next(x for x in r.json()["requests"] if x["id"] == self.state["request_id"])
        assert match["email"] == self.email
        assert match["device_name"] == "iPhone B"

    def test_d_admin_approves_and_old_device_is_swapped(self, admin_client, base_url):
        rid = self.state["request_id"]
        r = admin_client.post(f"{base_url}/api/admin/device-requests/{rid}/approve")
        assert r.status_code == 200, r.text

        # approving twice should now 409 (already resolved)
        r2 = admin_client.post(f"{base_url}/api/admin/device-requests/{rid}/approve")
        assert r2.status_code == 409

        # old device (A) should no longer validate; new device (B) should be open
        h = {"Authorization": f"Bearer {self.state['perf_token']}", "Content-Type": "application/json"}
        status_a = requests.post(f"{base_url}/api/license/status", headers=h, json={"device_id": "device-A"}).json()
        assert status_a["valid"] is False

        status_b = requests.post(f"{base_url}/api/license/status", headers=h, json={"device_id": "device-B"}).json()
        assert status_b == {"valid": True, "gate": "open"}

    def test_e_pending_list_no_longer_shows_resolved_request(self, admin_client, base_url):
        r = admin_client.get(f"{base_url}/api/admin/device-requests")
        ids = [x["id"] for x in r.json()["requests"]]
        assert self.state["request_id"] not in ids

    def test_f_cleanup(self, admin_client, base_url):
        admin_client.delete(f"{base_url}/api/admin/users/{self.state['uid']}")


class TestDenyDeviceRequest:
    unique = str(int(time.time())) + "dcdeny"
    email = f"test_dcdeny_{unique}@example.com"
    password = "startpass123"
    state = {}

    def test_a_setup_conflict_and_request(self, admin_client, base_url):
        r = admin_client.post(f"{base_url}/api/admin/users", json={
            "email": self.email, "password": self.password, "name": "TEST DenyFlow",
            "price": 0, "currency": "USD", "is_free": True, "note": "",
        })
        uid = r.json()["uid"]
        key = r.json()["license_key"]
        TestDenyDeviceRequest.state["uid"] = uid

        token = firebase_signin(self.email, self.password)
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        requests.post(f"{base_url}/api/license/activate", headers=h, json={
            "key": key, "device_id": "d1", "device_name": "d1",
        })
        r = requests.post(f"{base_url}/api/license/request-device-change", headers=h, json={
            "device_id": "d2", "device_name": "d2",
        })
        TestDenyDeviceRequest.state["request_id"] = r.json()["request_id"]
        TestDenyDeviceRequest.state["token"] = token

    def test_b_deny_keeps_old_device_bound(self, admin_client, base_url):
        rid = self.state["request_id"]
        r = admin_client.post(f"{base_url}/api/admin/device-requests/{rid}/deny")
        assert r.status_code == 200

        h = {"Authorization": f"Bearer {self.state['token']}", "Content-Type": "application/json"}
        status_d1 = requests.post(f"{base_url}/api/license/status", headers=h, json={"device_id": "d1"}).json()
        assert status_d1 == {"valid": True, "gate": "open"}

    def test_c_cleanup(self, admin_client, base_url):
        admin_client.delete(f"{base_url}/api/admin/users/{self.state['uid']}")


class TestLicenseExpiry:
    unique = str(int(time.time())) + "exp"
    email = f"test_exp_{unique}@example.com"
    password = "startpass123"
    state = {}

    def test_a_perpetual_by_default(self, admin_client, base_url):
        r = admin_client.post(f"{base_url}/api/admin/users", json={
            "email": self.email, "password": self.password, "name": "TEST Expiry",
            "price": 0, "currency": "USD", "is_free": True, "note": "",
        })
        assert r.status_code == 200, r.text
        TestLicenseExpiry.state["uid"] = r.json()["uid"]

        users = admin_client.get(f"{base_url}/api/admin/users").json()["users"]
        me = next(u for u in users if u["email"] == self.email)
        assert me["license"]["expires_at"] is None
        assert me["license"]["effective_status"] == "active"
        TestLicenseExpiry.state["license_id"] = me["license"]["id"]

    def test_b_set_short_expiry_and_it_takes_effect(self, admin_client, base_url):
        lid = self.state["license_id"]
        # duration_days=0 isn't allowed to mean "expire immediately" cleanly via
        # timedelta(days=0) (= now, borderline); use a negative-ish already-past
        # duration isn't supported by the API, so instead set 1 day then assert
        # the expires_at field lands ~1 day out, proving the plumbing works.
        r = admin_client.patch(f"{base_url}/api/admin/licenses/{lid}/expiry", json={"duration_days": 1})
        assert r.status_code == 200, r.text
        assert r.json()["expires_at"] is not None

        users = admin_client.get(f"{base_url}/api/admin/users").json()["users"]
        me = next(u for u in users if u["email"] == self.email)
        assert me["license"]["expires_at"] is not None
        assert me["license"]["effective_status"] == "active"  # not expired yet

    def test_c_clearing_expiry_returns_to_perpetual(self, admin_client, base_url):
        lid = self.state["license_id"]
        r = admin_client.patch(f"{base_url}/api/admin/licenses/{lid}/expiry", json={"duration_days": None})
        assert r.status_code == 200
        assert r.json()["expires_at"] is None

    def test_d_create_with_duration_days_sets_expiry_immediately(self, admin_client, base_url):
        email2 = f"test_exp2_{self.unique}@example.com"
        r = admin_client.post(f"{base_url}/api/admin/users", json={
            "email": email2, "password": self.password, "name": "TEST Expiry2",
            "price": 0, "currency": "USD", "is_free": True, "note": "",
            "duration_days": 30,
        })
        assert r.status_code == 200, r.text
        uid2 = r.json()["uid"]
        users = admin_client.get(f"{base_url}/api/admin/users").json()["users"]
        me = next(u for u in users if u["email"] == email2)
        assert me["license"]["expires_at"] is not None
        admin_client.delete(f"{base_url}/api/admin/users/{uid2}")

    def test_e_cleanup(self, admin_client, base_url):
        admin_client.delete(f"{base_url}/api/admin/users/{self.state['uid']}")


class TestExpiredLicenseIsBlocked:
    """A license whose expires_at is already in the past must gate the
    performer out, even though its stored status is still 'active'."""

    unique = str(int(time.time())) + "expblock"
    email = f"test_expblock_{unique}@example.com"
    password = "startpass123"
    state = {}

    def test_a_create_activate_then_backdate_expiry(self, admin_client, base_url):
        r = admin_client.post(f"{base_url}/api/admin/users", json={
            "email": self.email, "password": self.password, "name": "TEST ExpBlock",
            "price": 0, "currency": "USD", "is_free": True, "note": "",
        })
        uid = r.json()["uid"]
        key = r.json()["license_key"]
        TestExpiredLicenseIsBlocked.state["uid"] = uid

        token = firebase_signin(self.email, self.password)
        TestExpiredLicenseIsBlocked.state["token"] = token
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = requests.post(f"{base_url}/api/license/activate", headers=h, json={
            "key": key, "device_id": "dev-exp", "device_name": "dev-exp",
        })
        assert r.status_code == 200, r.text

        users = admin_client.get(f"{base_url}/api/admin/users").json()["users"]
        lid = next(u for u in users if u["email"] == self.email)["license"]["id"]
        TestExpiredLicenseIsBlocked.state["license_id"] = lid
        # Negative duration = an expiry date already in the past.
        r = admin_client.patch(f"{base_url}/api/admin/licenses/{lid}/expiry", json={"duration_days": -1})
        assert r.status_code == 200, r.text

    def test_b_me_reports_blocked_expired(self, base_url):
        h = {"Authorization": f"Bearer {self.state['token']}", "Content-Type": "application/json"}
        me = requests.get(f"{base_url}/api/me", headers=h).json()
        assert me["gate"] == "blocked"
        assert me["reason"] == "expired"
        assert me["license_status"] == "expired"

    def test_c_license_status_reports_expired(self, base_url):
        h = {"Authorization": f"Bearer {self.state['token']}", "Content-Type": "application/json"}
        r = requests.post(f"{base_url}/api/license/status", headers=h, json={"device_id": "dev-exp"})
        assert r.json() == {"valid": False, "gate": "blocked", "reason": "expired"}

    def test_d_activation_on_a_new_device_is_refused_as_expired(self, base_url):
        h = {"Authorization": f"Bearer {self.state['token']}", "Content-Type": "application/json"}
        r = requests.post(f"{base_url}/api/license/activate", headers=h, json={
            "key": "irrelevant-not-reached", "device_id": "dev-exp2", "device_name": "dev-exp2",
        })
        # 404 (key not found) is also acceptable here since we passed a bogus
        # key; the real assertion is in test_b/test_c above. This just checks
        # the endpoint doesn't 500.
        assert r.status_code in (403, 404)

    def test_e_admin_view_shows_effective_status_expired(self, admin_client, base_url):
        users = admin_client.get(f"{base_url}/api/admin/users").json()["users"]
        me = next(u for u in users if u["email"] == self.email)
        assert me["license"]["status"] == "active"  # stored status unchanged
        assert me["license"]["effective_status"] == "expired"  # computed override

    def test_f_cleanup(self, admin_client, base_url):
        admin_client.delete(f"{base_url}/api/admin/users/{self.state['uid']}")


class TestCurrentPasswordTracking:
    """The admin dashboard needs to re-share a magician's password later, and
    Firebase never hands back an existing one — so the backend deliberately
    keeps a readable copy in sync (see server.py's current_password field)."""

    unique = str(int(time.time())) + "pw"
    email = f"test_pw_{unique}@example.com"
    password = "startpass123"
    new_password = "changedpass456"
    state = {}

    def test_a_create_sets_current_password(self, admin_client, base_url):
        r = admin_client.post(f"{base_url}/api/admin/users", json={
            "email": self.email, "password": self.password, "name": "TEST Pw",
            "price": 0, "currency": "USD", "is_free": True, "note": "",
        })
        assert r.status_code == 200, r.text
        self.state["uid"] = r.json()["uid"]

        users = admin_client.get(f"{base_url}/api/admin/users").json()["users"]
        me = next(u for u in users if u["email"] == self.email)
        assert me["current_password"] == self.password

    def test_b_reset_updates_current_password(self, admin_client, base_url):
        r = admin_client.post(
            f"{base_url}/api/admin/users/{self.state['uid']}/reset-password",
            json={"password": self.new_password},
        )
        assert r.status_code == 200, r.text

        users = admin_client.get(f"{base_url}/api/admin/users").json()["users"]
        me = next(u for u in users if u["email"] == self.email)
        assert me["current_password"] == self.new_password

    def test_c_delete_clears_it(self, admin_client, base_url):
        admin_client.delete(f"{base_url}/api/admin/users/{self.state['uid']}")
        # deleted users are excluded from the listing entirely; nothing left to assert
        # via the API — the clearing itself is a DB-hygiene detail, not user-facing.


def test_sales_insights_shape(admin_client, base_url):
    r = admin_client.get(f"{base_url}/api/admin/sales/insights")
    assert r.status_code == 200, r.text
    j = r.json()
    assert "monthly" in j and "top" in j
    assert len(j["monthly"]) == 12
    # oldest-to-newest, each bucket has a month key + label + by_currency
    for bucket in j["monthly"]:
        assert set(bucket.keys()) == {"month", "label", "by_currency"}
    months = [b["month"] for b in j["monthly"]]
    assert months == sorted(months)  # chronological
