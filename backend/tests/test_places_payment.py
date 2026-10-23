# Tests for delivery places (Amil/Green Park), Dinheiro + troco, payment edit (PATCH /orders/{id}/payment)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


def payload(**kw):
    base = {
        "customer_name": "TEST_Places",
        "customer_phone": "41999990000",
        "address": "Amil",
        "complement": "Setor: TI · Intervalo: 12h às 13h",
        "delivery_date": "2030-01-15",
        "items": [{"product_id": "x", "name": "Cuca", "price": 30.0, "quantity": 2, "flavor": "Banana"}],
        "payment_method": "Dinheiro",
        "change_for": 100.0,
    }
    base.update(kw)
    return base


# Order creation with place + complement + change_for
class TestOrderPlaces:
    def test_amil_dinheiro_change(self, s):
        r = s.post(f"{BASE_URL}/api/orders", json=payload())
        assert r.status_code == 200
        d = r.json()
        assert d["address"] == "Amil"
        assert d["complement"] == "Setor: TI · Intervalo: 12h às 13h"
        assert d["change_for"] == 100.0
        assert d["total"] == 60.0
        assert d["time_slot"] == ""
        lst = s.get(f"{BASE_URL}/api/orders").json()
        found = next(o for o in lst if o["id"] == d["id"])
        assert found["change_for"] == 100.0 and found["address"] == "Amil"

    def test_green_park_no_change(self, s):
        r = s.post(f"{BASE_URL}/api/orders", json=payload(address="Green Park", complement="Bloco: 4 · Apartamento: 302",
                                                          payment_method="Pix", change_for=None))
        assert r.status_code == 200
        d = r.json()
        assert d["address"] == "Green Park" and d["change_for"] is None


# PATCH payment method
class TestPaymentEdit:
    def test_patch_payment_persist(self, s):
        o = s.post(f"{BASE_URL}/api/orders", json=payload(payment_method="Pix", change_for=None)).json()
        r = s.patch(f"{BASE_URL}/api/orders/{o['id']}/payment", json={"payment_method": "Dinheiro", "change_for": 80})
        assert r.status_code == 200
        assert r.json()["payment_method"] == "Dinheiro" and r.json()["change_for"] == 80
        found = next(x for x in s.get(f"{BASE_URL}/api/orders").json() if x["id"] == o["id"])
        assert found["payment_method"] == "Dinheiro" and found["change_for"] == 80
        assert found["status"] == "Pendente" and found["total"] == o["total"]
        r = s.patch(f"{BASE_URL}/api/orders/{o['id']}/payment", json={"payment_method": "Cartão de Crédito", "change_for": None})
        found = next(x for x in s.get(f"{BASE_URL}/api/orders").json() if x["id"] == o["id"])
        assert found["payment_method"] == "Cartão de Crédito" and found["change_for"] is None

    def test_patch_payment_404(self, s):
        r = s.patch(f"{BASE_URL}/api/orders/nonexistent/payment", json={"payment_method": "Pix"})
        assert r.status_code == 404

    def test_patch_payment_missing_method_422(self, s):
        r = s.patch(f"{BASE_URL}/api/orders/nonexistent/payment", json={})
        assert r.status_code == 422

    def test_patch_payment_invalid_method_rejected(self, s):
        # Expected: unknown method should be rejected (400/422)
        o = s.post(f"{BASE_URL}/api/orders", json=payload(payment_method="Pix", change_for=None)).json()
        r = s.patch(f"{BASE_URL}/api/orders/{o['id']}/payment", json={"payment_method": "Bitcoin"})
        assert r.status_code in (400, 422), f"accepted arbitrary method: {r.status_code}"
