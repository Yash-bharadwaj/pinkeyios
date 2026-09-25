"""PINKEY backend API integration tests (Phase 3+4)."""
import time
import pytest
import requests
from conftest import firebase_signin

# --- health ---------------------------------------------------------------
def test_root(anon_client, base_url):
    r = anon_client.get(f"{base_url}/api/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# --- auth guards ----------------------------------------------------------
def test_me_requires_token(anon_client, base_url):
    r = anon_client.get(f"{base_url}/api/me")
    assert r.status_code == 401


def test_admin_users_requires_token(anon_client, base_url):
    r = anon_client.get(f"{base_url}/api/admin/users")
    assert r.status_code == 401


def test_admin_me(admin_client, base_url):
    r = admin_client.get(f"{base_url}/api/me")
    assert r.status_code == 200
    j = r.json()
    assert j["role"] == "admin"
    assert j["gate"] == "open"


# --- admin CRUD + license lifecycle --------------------------------------
class TestAdminUserLifecycle:
    unique = str(int(time.time()))
    email = f"test_perf_{unique}@example.com"
    password = "startpass123"
    new_password = "changedpass456"
    state = {}

    def test_a_create_user(self, admin_client, base_url):
        r = admin_client.post(f"{base_url}/api/admin/users", json={
            "email": self.email,
            "password": self.password,
            "name": "TEST Performer",
            "price": 49.99,
            "currency": "USD",
            "is_free": False,
            "note": "TEST_created",
        })
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["email"] == self.email
        assert j["license_key"].startswith("PINK-")
        assert len(j["license_key"].split("-")) == 4
        TestAdminUserLifecycle.state["uid"] = j["uid"]
        TestAdminUserLifecycle.state["license_key"] = j["license_key"]

    def test_b_duplicate_create_fails(self, admin_client, base_url):
        r = admin_client.post(f"{base_url}/api/admin/users", json={
            "email": self.email, "password": self.password, "name": "dup",
            "price": 0, "currency": "USD", "is_free": True, "note": "",
        })
        assert r.status_code == 409

    def test_c_list_shows_user(self, admin_client, base_url):
        r = admin_client.get(f"{base_url}/api/admin/users")
        assert r.status_code == 200
        emails = [u["email"] for u in r.json()["users"]]
        assert self.email in emails
        for u in r.json()["users"]:
            if u["email"] == self.email:
                assert u["license"] is not None
                assert u["license"]["status"] == "active"
                assert u["sale"]["amount"] == 49.99
                TestAdminUserLifecycle.state["license_id"] = u["license"]["id"]
                TestAdminUserLifecycle.state["sale_id"] = u["sale"]["id"]

    def test_d_performer_signin_and_me(self, base_url):
        # newly created firebase user should be able to sign in
        token = firebase_signin(self.email, self.password)
        assert token
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = requests.get(f"{base_url}/api/me", headers=h)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["role"] == "performer"
        assert j["gate"] == "needs_activation"
        TestAdminUserLifecycle.state["perf_token"] = token

    def test_e_activate_license(self, base_url):
        token = self.state["perf_token"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        did = f"test-device-{self.unique}"
        r = requests.post(f"{base_url}/api/license/activate", headers=h, json={
            "key": self.state["license_key"], "device_id": did, "device_name": "pytest",
        })
        assert r.status_code == 200, r.text
        assert r.json()["activated"] is True
        TestAdminUserLifecycle.state["device_id"] = did

    def test_f_activate_invalid_key(self, base_url):
        token = self.state["perf_token"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = requests.post(f"{base_url}/api/license/activate", headers=h, json={
            "key": "PINK-ZZZZ-ZZZZ-ZZZZ", "device_id": "x", "device_name": "x",
        })
        assert r.status_code == 404

    def test_g_second_device_conflicts(self, base_url):
        token = self.state["perf_token"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = requests.post(f"{base_url}/api/license/activate", headers=h, json={
            "key": self.state["license_key"], "device_id": "another-device",
            "device_name": "other",
        })
        assert r.status_code == 409

    def test_h_license_status_open(self, base_url):
        token = self.state["perf_token"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = requests.post(f"{base_url}/api/license/status", headers=h,
                          json={"device_id": self.state["device_id"]})
        assert r.status_code == 200
        assert r.json() == {"valid": True, "gate": "open"}

    def test_i_revoke_license(self, admin_client, base_url):
        lid = self.state["license_id"]
        r = admin_client.post(f"{base_url}/api/admin/licenses/{lid}/set?status=revoked")
        assert r.status_code == 200
        # Verify performer /me now blocked
        token = self.state["perf_token"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        me = requests.get(f"{base_url}/api/me", headers=h).json()
        assert me["gate"] == "blocked"
        assert me["reason"] == "revoked"

    def test_j_reactivate_license(self, admin_client, base_url):
        lid = self.state["license_id"]
        r = admin_client.post(f"{base_url}/api/admin/licenses/{lid}/set?status=active")
        assert r.status_code == 200

    def test_k_unbind_devices(self, admin_client, base_url):
        lid = self.state["license_id"]
        r = admin_client.post(f"{base_url}/api/admin/licenses/{lid}/unbind")
        assert r.status_code == 200
        assert r.json()["removed"] >= 1
        # Verify /api/admin/users shows empty devices for this user
        users = admin_client.get(f"{base_url}/api/admin/users").json()["users"]
        for u in users:
            if u["email"] == self.email:
                assert u["devices"] == []

    def test_l_toggle_status_disable(self, admin_client, base_url):
        uid = self.state["uid"]
        r = admin_client.post(f"{base_url}/api/admin/users/{uid}/status?disabled=true")
        assert r.status_code == 200
        # performer token: after disable, backend should refuse
        token = self.state["perf_token"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        me = requests.get(f"{base_url}/api/me", headers=h)
        assert me.status_code == 403

    def test_m_toggle_status_enable(self, admin_client, base_url):
        uid = self.state["uid"]
        r = admin_client.post(f"{base_url}/api/admin/users/{uid}/status?disabled=false")
        assert r.status_code == 200

    def test_n_reset_password(self, admin_client, base_url):
        uid = self.state["uid"]
        r = admin_client.post(f"{base_url}/api/admin/users/{uid}/reset-password",
                              json={"password": self.new_password})
        assert r.status_code == 200
        # verify new password works via firebase signin (retry a few times, propagation)
        last = None
        for _ in range(5):
            try:
                token = firebase_signin(self.email, self.new_password)
                assert token
                return
            except Exception as e:
                last = e
                time.sleep(2)
        pytest.fail(f"New password did not authenticate: {last}")

    def test_o_sales_summary(self, admin_client, base_url):
        r = admin_client.get(f"{base_url}/api/admin/sales/summary")
        assert r.status_code == 200
        j = r.json()
        assert "by_currency" in j
        assert j["total_users"] >= 1
        assert j["active_licenses"] >= 1

    def test_p_update_sale_refund(self, admin_client, base_url):
        sid = self.state["sale_id"]
        r = admin_client.patch(f"{base_url}/api/admin/sales/{sid}",
                                json={"refunded": True})
        assert r.status_code == 200

    def test_q_delete_user(self, admin_client, base_url):
        uid = self.state["uid"]
        r = admin_client.delete(f"{base_url}/api/admin/users/{uid}")
        assert r.status_code == 200
        # Verify soft-delete: user no longer in listing
        users = admin_client.get(f"{base_url}/api/admin/users").json()["users"]
        assert self.email not in [u["email"] for u in users]


# --- performer role can NOT hit admin routes ------------------------------
def test_performer_cannot_access_admin(base_url):
    """Sign in as the seeded magician1 (may need activation) and try admin routes."""
    try:
        token = firebase_signin("magician1@test.com", "perform123")
    except Exception:
        pytest.skip("magician1 firebase account not present")
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    r = requests.get(f"{base_url}/api/admin/users", headers=h)
    assert r.status_code == 403
    r2 = requests.get(f"{base_url}/api/admin/sales/summary", headers=h)
    assert r2.status_code == 403


# --- wrong credentials ----------------------------------------------------
def test_wrong_login_rejected():
    with pytest.raises(requests.HTTPError):
        firebase_signin("someyash2000@gmail.com", "wrongpassword!!")
