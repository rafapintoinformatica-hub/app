# Shared fixtures: admin-authenticated session + cleanup of TEST_ data (never touches real data)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def _admin_token():
    r = requests.post(f"{API}/admin/login", json={"password": "lanche123"},
                      headers={"X-Forwarded-For": "10.250.0.1"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def token():
    return _admin_token()


@pytest.fixture(scope="module")
def s(token):
    ss = requests.Session()
    ss.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return ss


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data(token):
    yield
    h = {"Authorization": f"Bearer {token}"}
    for o in requests.get(f"{API}/orders", headers=h).json():
        if o["customer_name"].startswith("TEST_"):
            requests.delete(f"{API}/orders/{o['id']}", headers=h)
    for p in requests.get(f"{API}/products").json():
        if p["name"].startswith("TEST_"):
            requests.delete(f"{API}/products/{p['id']}", headers=h)
    for c in requests.get(f"{API}/coupons", headers=h).json():
        if c["code"].startswith("TEST"):
            requests.delete(f"{API}/coupons/{c['id']}", headers=h)
    for kind in ("statuses", "payment_methods", "places", "categories"):
        for it in requests.get(f"{API}/config/{kind}").json():
            if it["name"].startswith("TEST_"):
                requests.delete(f"{API}/config/{kind}/{it['id']}", headers=h)
