# Iteration 4: admin JWT auth/lockout, config CRUD (statuses/payment_methods/places/categories), status flags,
# InfinitePay online checkout link, webhook/confirm, public order, push/email endpoints, settings, password change
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def order(**kw):
    p = {"customer_name": "TEST_It4", "customer_phone": "41999990000", "address": "Amil",
         "complement": "Setor: TI", "delivery_date": "2030-01-15",
         "items": [{"product_id": "x", "name": "Cuca", "price": 30.0, "quantity": 2, "flavor": "Banana"}],
         "payment_method": "Pix"}
    p.update(kw)
    return p


# ---- Auth ----
class TestAuth:
    @pytest.mark.parametrize("method,path", [
        ("get", "/orders"), ("post", "/products"), ("put", "/products/x"), ("delete", "/products/x"),
        ("get", "/coupons"), ("post", "/coupons"), ("post", "/config/statuses"), ("put", "/config/statuses/x"),
        ("delete", "/config/statuses/x"), ("get", "/admin/settings"), ("put", "/admin/settings"),
        ("post", "/push/subscribe"), ("post", "/push/test"), ("post", "/admin/test-email"),
        ("patch", "/orders/x/status"), ("patch", "/orders/x/payment"), ("delete", "/orders/x"),
        ("put", "/admin/password"), ("get", "/admin/me")])
    def test_admin_routes_401(self, method, path):
        r = getattr(requests, method)(f"{API}{path}", json={})
        assert r.status_code == 401, f"{method} {path} -> {r.status_code}"

    def test_invalid_token_401(self):
        r = requests.get(f"{API}/orders", headers={"Authorization": "Bearer abc"})
        assert r.status_code == 401

    def test_login_returns_token_and_me(self, token):
        assert isinstance(token, str) and len(token) > 20
        r = requests.get(f"{API}/admin/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200 and r.json()["ok"] is True

    def test_lockout_after_5(self):
        ip = f"10.251.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"
        h = {"X-Forwarded-For": ip}
        codes = [requests.post(f"{API}/admin/login", json={"password": "wrong"}, headers=h).status_code for _ in range(5)]
        assert codes == [401] * 5
        r = requests.post(f"{API}/admin/login", json={"password": "lanche123"}, headers=h)
        assert r.status_code == 429

    def test_public_routes_no_auth(self):
        for p in ("/products", "/settings", "/config/statuses", "/config/payment_methods", "/config/places",
                  "/config/categories", "/push/public-key"):
            assert requests.get(f"{API}{p}").status_code == 200, p
        st = requests.get(f"{API}/settings").json()
        assert "notification_email" not in st and "infinitepay_handle" not in st


# ---- Config CRUD ----
class TestConfigCrud:
    @pytest.mark.parametrize("kind,body,upd", [
        ("statuses", {"name": "TEST_St", "color": "blue"}, {"name": "TEST_St2", "color": "red"}),
        ("payment_methods", {"name": "TEST_Pg", "mode": "entrega"}, {"name": "TEST_Pg2", "mode": "entrega", "allows_change": True}),
        ("places", {"name": "TEST_Lc", "fields": [{"label": "Sala", "placeholder": "Ex: 1"}]},
         {"name": "TEST_Lc2", "fields": [{"label": "Sala"}, {"label": "Andar"}]}),
        ("categories", {"name": "TEST_Ct"}, {"name": "TEST_Ct2"}),
    ])
    def test_crud(self, s, kind, body, upd):
        r = s.post(f"{API}/config/{kind}", json=body)
        assert r.status_code == 200, r.text
        it = r.json()
        assert it["name"] == body["name"] and isinstance(it["id"], str) and "_id" not in it
        assert s.post(f"{API}/config/{kind}", json=body).status_code == 400  # duplicate
        lst = requests.get(f"{API}/config/{kind}").json()
        assert any(x["id"] == it["id"] for x in lst)
        r = s.put(f"{API}/config/{kind}/{it['id']}", json=upd)
        assert r.status_code == 200 and r.json()["name"] == upd["name"]
        got = next(x for x in requests.get(f"{API}/config/{kind}").json() if x["id"] == it["id"])
        assert got["name"] == upd["name"]
        if kind == "places":
            assert len(got["fields"]) == 2
        assert s.delete(f"{API}/config/{kind}/{it['id']}").status_code == 200
        assert s.delete(f"{API}/config/{kind}/{it['id']}").status_code == 404
        assert not any(x["id"] == it["id"] for x in requests.get(f"{API}/config/{kind}").json())

    def test_invalid_kind_404(self, s):
        assert requests.get(f"{API}/config/bogus").status_code == 404
        assert s.post(f"{API}/config/bogus", json={"name": "x"}).status_code == 404

    def test_create_missing_name_is_4xx(self, s):
        r = s.post(f"{API}/config/categories", json={})
        assert r.status_code in (400, 422), f"got {r.status_code}"

    def test_rename_payment_propagates_to_orders(self, s):
        pm = s.post(f"{API}/config/payment_methods", json={"name": "TEST_PgR", "mode": "entrega"}).json()
        o = s.post(f"{API}/orders", json=order(payment_method="TEST_PgR")).json()
        assert o["payment_method"] == "TEST_PgR"
        s.put(f"{API}/config/payment_methods/{pm['id']}", json={"name": "TEST_PgR2", "mode": "entrega"})
        got = next(x for x in s.get(f"{API}/orders").json() if x["id"] == o["id"])
        assert got["payment_method"] == "TEST_PgR2"
        s.delete(f"{API}/config/payment_methods/{pm['id']}")

    def test_rename_status_and_category_propagate(self, s):
        st = s.post(f"{API}/config/statuses", json={"name": "TEST_StR"}).json()
        o = s.post(f"{API}/orders", json=order()).json()
        assert s.patch(f"{API}/orders/{o['id']}/status", json={"status": "TEST_StR"}).status_code == 200
        s.put(f"{API}/config/statuses/{st['id']}", json={"name": "TEST_StR2"})
        got = next(x for x in s.get(f"{API}/orders").json() if x["id"] == o["id"])
        assert got["status"] == "TEST_StR2"
        s.delete(f"{API}/config/statuses/{st['id']}")
        cat = s.post(f"{API}/config/categories", json={"name": "TEST_CtR"}).json()
        p = s.post(f"{API}/products", json={"name": "TEST_ProdCat", "price": 5, "category": "TEST_CtR"}).json()
        s.put(f"{API}/config/categories/{cat['id']}", json={"name": "TEST_CtR2"})
        gp = next(x for x in requests.get(f"{API}/products").json() if x["id"] == p["id"])
        assert gp["category"] == "TEST_CtR2"
        s.delete(f"{API}/products/{p['id']}")
        s.delete(f"{API}/config/categories/{cat['id']}")

    def test_initial_status_unchanged(self):
        sts = requests.get(f"{API}/config/statuses").json()
        assert [x["name"] for x in sts if x["is_initial"]] == ["Pendente"]


# ---- Status flags ----
class TestStatusFlags:
    def test_marks_paid_custom_status(self, s):
        st = s.post(f"{API}/config/statuses", json={"name": "TEST_PaidSt", "marks_paid": True}).json()
        o = s.post(f"{API}/orders", json=order()).json()
        r = s.patch(f"{API}/orders/{o['id']}/status", json={"status": "TEST_PaidSt"})
        assert r.status_code == 200 and r.json()["payment_status"] == "Pago"
        s.delete(f"{API}/config/statuses/{st['id']}")

    def test_unknown_status_400(self, s):
        o = s.post(f"{API}/orders", json=order()).json()
        assert s.patch(f"{API}/orders/{o['id']}/status", json={"status": "Nope"}).status_code == 400


# ---- Orders / payments ----
class TestOrdersPayments:
    def test_invalid_payment_method_400(self, s):
        assert s.post(f"{API}/orders", json=order(payment_method="Bitcoin")).status_code == 400

    def test_change_for_dropped_for_non_cash(self, s):
        o = s.post(f"{API}/orders", json=order(payment_method="Pix", change_for=100)).json()
        assert o["change_for"] is None
        o2 = s.post(f"{API}/orders", json=order(payment_method="Dinheiro", change_for=100)).json()
        assert o2["change_for"] == 100

    def test_online_requires_origin(self, s):
        assert s.post(f"{API}/orders", json=order(payment_method="Pix Online")).status_code == 400

    def test_online_order_creates_infinitepay_link(self, s):
        r = s.post(f"{API}/orders", json=order(payment_method="Pix Online", origin_url=BASE_URL))
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["payment_status"] == "Aguardando pagamento online" and o["payment_mode"] == "online"
        assert o["checkout_url"].startswith("https://checkout.infinitepay.io/rafael-gomes-23d")
        pub = requests.get(f"{API}/orders/{o['id']}/public").json()
        assert pub["id"] == o["id"]
        # confirm with fake tx keeps it unpaid
        c = requests.post(f"{API}/payments/infinitepay/confirm",
                          json={"order_id": o["id"], "transaction_nsu": "fake", "slug": "fake"})
        assert c.status_code == 200 and c.json()["payment_status"] == "Aguardando pagamento online"
        # webhook with real order but fake tx -> 200 and still unpaid
        w = requests.post(f"{API}/infinitepay/webhook",
                          json={"order_nsu": o["id"], "transaction_nsu": "fake", "invoice_slug": "fake"})
        assert w.status_code == 200
        import time; time.sleep(3)
        assert requests.get(f"{API}/orders/{o['id']}/public").json()["payment_status"] != "Pago"

    def test_card_online_with_coupon_link(self, s):
        code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        s.post(f"{API}/coupons", json={"code": code, "discount_type": "fixed", "discount_value": 5})
        r = s.post(f"{API}/orders", json=order(payment_method="Cartão de Crédito Online", origin_url=BASE_URL, coupon_code=code))
        assert r.status_code == 200, r.text
        assert r.json()["total"] == 55.0 and "infinitepay.io" in r.json()["checkout_url"]

    def test_public_order_404(self):
        assert requests.get(f"{API}/orders/nope/public").status_code == 404

    def test_confirm_unknown_404(self):
        r = requests.post(f"{API}/payments/infinitepay/confirm", json={"order_id": "nope", "transaction_nsu": "a", "slug": "b"})
        assert r.status_code == 404

    def test_webhook_unknown_and_missing(self):
        r = requests.post(f"{API}/infinitepay/webhook", json={"order_nsu": "nope", "transaction_nsu": "a", "invoice_slug": "b"})
        assert r.status_code == 200 and r.json()["ok"] is True
        assert requests.post(f"{API}/infinitepay/webhook", json={"order_nsu": "nope"}).status_code == 400

    def test_patch_payment_uses_config(self, s):
        o = s.post(f"{API}/orders", json=order()).json()
        assert s.patch(f"{API}/orders/{o['id']}/payment", json={"payment_method": "Bitcoin"}).status_code == 400
        r = s.patch(f"{API}/orders/{o['id']}/payment", json={"payment_method": "Dinheiro", "change_for": 70})
        assert r.status_code == 200 and r.json()["change_for"] == 70

    def test_delete_order(self, s):
        o = s.post(f"{API}/orders", json=order()).json()
        assert s.delete(f"{API}/orders/{o['id']}").status_code == 200
        assert requests.get(f"{API}/orders/{o['id']}/public").status_code == 404


# ---- Notifications / settings / password ----
class TestNotifySettings:
    def test_push_public_key_and_test(self, s):
        assert len(requests.get(f"{API}/push/public-key").json()["publicKey"]) > 40
        r = s.post(f"{API}/push/test")
        assert r.status_code == 200 and isinstance(r.json()["sent"], int)

    def test_push_subscribe_invalid_400(self, s):
        assert s.post(f"{API}/push/subscribe", json={"endpoint": "http://x", "keys": {"a": 1}}).status_code == 400

    def test_email_flow(self, s):
        orig = s.get(f"{API}/admin/settings").json()
        if orig["notification_email"]:
            pytest.skip("Owner configured a real notification_email - not touching it")
        try:
            assert s.post(f"{API}/admin/test-email").status_code == 400
            r = s.put(f"{API}/admin/settings", json={**orig, "notification_email": " delivered@resend.dev "})
            assert r.json()["notification_email"] == "delivered@resend.dev"
            e = s.post(f"{API}/admin/test-email")
            assert e.status_code == 200 and e.json()["ok"] is True, e.text
        finally:
            s.put(f"{API}/admin/settings", json=orig)
        assert s.get(f"{API}/admin/settings").json()["notification_email"] == ""

    def test_settings_handle_sanitized(self, s):
        orig = s.get(f"{API}/admin/settings").json()
        try:
            r = s.put(f"{API}/admin/settings", json={**orig, "infinitepay_handle": " $rafael-gomes-23d ", "store_name": "TEST_Loja"})
            assert r.json()["infinitepay_handle"] == "rafael-gomes-23d"
            assert requests.get(f"{API}/settings").json()["store_name"] == "TEST_Loja"
        finally:
            s.put(f"{API}/admin/settings", json=orig)
        assert requests.get(f"{API}/settings").json()["store_name"] == orig["store_name"]

    def test_password_change_and_revert(self, s):
        assert s.put(f"{API}/admin/password", json={"current_password": "bad", "new_password": "abcdef"}).status_code == 400
        assert s.put(f"{API}/admin/password", json={"current_password": "lanche123", "new_password": "abc"}).status_code == 400
        assert s.put(f"{API}/admin/password", json={"current_password": "lanche123", "new_password": "TEST_pw99"}).status_code == 200
        try:
            h = {"X-Forwarded-For": "10.250.0.2"}
            assert requests.post(f"{API}/admin/login", json={"password": "TEST_pw99"}, headers=h).status_code == 200
        finally:
            r = s.put(f"{API}/admin/password", json={"current_password": "TEST_pw99", "new_password": "lanche123"})
            assert r.status_code == 200
        assert requests.post(f"{API}/admin/login", json={"password": "lanche123"}, headers={"X-Forwarded-For": "10.250.0.2"}).status_code == 200
