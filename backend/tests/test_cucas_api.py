# Deliciosas Cucas API regression tests: products/flavors, orders (pay on delivery), status->payment, settings, coupons, Stripe removal
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def original_settings(s):
    r = s.get(f"{API}/admin/settings")
    orig = r.json()
    yield orig
    s.put(f"{API}/admin/settings", json=orig)


def order_payload(**kw):
    p = {
        "customer_name": "TEST_Cliente",
        "customer_phone": "(41) 99999-1111",
        "address": "Amil",
        "neighborhood": "Centro",
        "cep": "80000-000",
        "delivery_date": "2026-12-20",
        "time_slot": "Manhã",
        "items": [
            {"product_id": "p1", "name": "Cuca", "price": 30.0, "quantity": 2, "flavor": "Banana"},
            {"product_id": "p1", "name": "Cuca", "price": 30.0, "quantity": 1, "flavor": "Uva"},
        ],
        "payment_method": "Pix",
    }
    p.update(kw)
    return p


# Products / flavors / categories
class TestProducts:
    def test_list_products_have_flavors(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        cats = {p["category"] for p in data}
        assert cats <= {"Cucas", "Bolos Caseiros", "Bolos Recheados", "Tortas Doces", "Bebidas"} | cats
        for p in data:
            assert "_id" not in p
            assert isinstance(p["flavors"], list)
        seeded = [p for p in data if p["category"] == "Cucas"]
        assert all(isinstance(p["flavors"], list) for p in data)

    def test_create_update_delete_product_with_flavors(self, s):
        r = s.post(f"{API}/products", json={"name": "TEST_Prod", "price": 10, "category": "Tortas Doces", "flavors": ["A", "B"]})
        assert r.status_code == 200
        pid = r.json()["id"]
        assert r.json()["flavors"] == ["A", "B"]
        r = s.put(f"{API}/products/{pid}", json={"name": "TEST_Prod2", "price": 11, "category": "Bebidas", "flavors": ["C"]})
        assert r.status_code == 200 and r.json()["flavors"] == ["C"]
        got = [p for p in s.get(f"{API}/products").json() if p["id"] == pid][0]
        assert got["name"] == "TEST_Prod2" and got["flavors"] == ["C"]
        assert s.delete(f"{API}/products/{pid}").status_code == 200
        assert s.delete(f"{API}/products/{pid}").status_code == 404


# Orders - pay on delivery
class TestOrders:
    def test_create_order_with_flavor(self, s):
        r = s.post(f"{API}/orders", json=order_payload())
        assert r.status_code == 200
        o = r.json()
        assert o["payment_status"] == "A pagar na entrega"
        assert o["status"] == "Pendente"
        assert o["order_code"].startswith("ENC-")
        assert o["subtotal"] == 90.0 and o["total"] == 90.0
        assert [i["flavor"] for i in o["items"]] == ["Banana", "Uva"]
        lst = s.get(f"{API}/orders").json()
        assert any(x["id"] == o["id"] for x in lst)

    def test_status_entregue_e_pago(self, s):
        o = s.post(f"{API}/orders", json=order_payload()).json()
        r = s.patch(f"{API}/orders/{o['id']}/status", json={"status": "Entregue e Pago"})
        assert r.status_code == 200 and r.json()["payment_status"] == "Pago"
        got = [x for x in s.get(f"{API}/orders").json() if x["id"] == o["id"]][0]
        assert got["status"] == "Entregue e Pago" and got["payment_status"] == "Pago"

    def test_status_aguardando(self, s):
        o = s.post(f"{API}/orders", json=order_payload()).json()
        r = s.patch(f"{API}/orders/{o['id']}/status", json={"status": "Entregue - Aguardando Pagamento"})
        assert r.status_code == 200 and r.json()["payment_status"] == "Aguardando Pagamento"
        got = [x for x in s.get(f"{API}/orders").json() if x["id"] == o["id"]][0]
        assert got["payment_status"] == "Aguardando Pagamento"

    def test_status_other_keeps_payment(self, s):
        o = s.post(f"{API}/orders", json=order_payload()).json()
        r = s.patch(f"{API}/orders/{o['id']}/status", json={"status": "Em Preparo"})
        assert r.json()["payment_status"] == "A pagar na entrega"

    def test_status_404(self, s):
        r = s.patch(f"{API}/orders/nonexistent/status", json={"status": "Pronto"})
        assert r.status_code == 404

    def test_order_missing_fields_422(self, s):
        r = s.post(f"{API}/orders", json={"customer_name": "x"})
        assert r.status_code == 422


# Stripe removal
class TestStripeRemoved:
    def test_create_session_gone(self, s):
        r = s.post(f"{API}/checkout/create-session", json={})
        assert r.status_code in (404, 405)

    def test_payments_gone(self, s):
        r = s.get(f"{API}/payments/status/abc")
        assert r.status_code in (404, 405)


# Settings
class TestSettings:
    def test_get_put_settings(self, s, original_settings):
        r = s.put(f"{API}/admin/settings", json={**original_settings, "store_whatsapp": "+55 (41) 98902-3769", "pix_key": "TEST_pix@x.com"})
        assert r.status_code == 200
        assert r.json()["store_whatsapp"] == "5541989023769"
        g = s.get(f"{API}/settings").json()
        assert g["pix_key"] == "TEST_pix@x.com" and g["store_whatsapp"] == "5541989023769"


# Coupons
class TestCoupons:
    def test_coupon_apply_and_decrement(self, s):
        code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        c = s.post(f"{API}/coupons", json={"code": code, "discount_type": "percent", "discount_value": 10, "max_uses": 1}).json()
        v = s.post(f"{API}/coupons/validate", json={"code": code.lower(), "subtotal": 90}).json()
        assert v["valid"] and v["discount"] == 9.0 and v["total"] == 81.0
        o = s.post(f"{API}/orders", json=order_payload(coupon_code=code)).json()
        assert o["discount"] == 9.0 and o["total"] == 81.0
        cp = [x for x in s.get(f"{API}/coupons").json() if x["id"] == c["id"]][0]
        assert cp["used_count"] == 1
        v2 = s.post(f"{API}/coupons/validate", json={"code": code, "subtotal": 90}).json()
        assert v2["valid"] is False
        o2 = s.post(f"{API}/orders", json=order_payload(coupon_code=code)).json()
        assert o2["discount"] == 0
        assert s.delete(f"{API}/coupons/{c['id']}").status_code == 200

    def test_duplicate_coupon_400(self, s):
        code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        c = s.post(f"{API}/coupons", json={"code": code, "discount_type": "fixed", "discount_value": 5}).json()
        assert s.post(f"{API}/coupons", json={"code": code, "discount_type": "fixed", "discount_value": 5}).status_code == 400
        s.delete(f"{API}/coupons/{c['id']}")


# Admin login
class TestAdmin:
    def test_login_ok(self, s):
        assert s.post(f"{API}/admin/login", json={"password": "lanche123"}).status_code == 200

    def test_login_bad(self, s):
        assert s.post(f"{API}/admin/login", json={"password": "x"}, headers={"X-Forwarded-For": "10.250.0.9"}).status_code == 401
