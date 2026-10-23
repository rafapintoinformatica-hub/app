# Iteration 5: integrations (InfinitePay/Pluxee), status justification, auto-approved status, refund flow
import os
import pytest
import requests
from datetime import date, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

FAKE = {"pluxee_env": "uat", "pluxee_client_id": "TEST_client", "pluxee_client_secret": "TEST_secret_abcd",
        "pluxee_mid": "TEST_mid", "pluxee_sub_key_cards": "TEST_cards_1234", "pluxee_sub_key_transaction": "TEST_tx_5678"}
CREATED = []


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{API}/admin/login", json={"password": "lanche123"})
    assert r.status_code == 200
    sess.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    yield sess
    for oid in CREATED:
        sess.delete(f"{API}/orders/{oid}")
    mdb.statuses.delete_many({"name": {"$regex": "^TEST_"}})
    # restore pluxee to original empty/off state
    mdb.settings.update_one({"id": "store"}, {"$set": {"pluxee_enabled": False, "pluxee_client_id": None, "pluxee_mid": None,
                                                      "pluxee_env": "uat"},
                                              "$unset": {"pluxee_client_secret": "", "pluxee_sub_key_cards": "",
                                                         "pluxee_sub_key_transaction": ""}})


def order_payload(method):
    return {"customer_name": "TEST_Cliente", "customer_phone": "41999990000", "address": "TEST_Rua 1",
            "delivery_date": (date.today() + timedelta(days=3)).isoformat(),
            "items": [{"product_id": "x", "name": "TEST_Cuca", "price": 10.0, "quantity": 1}],
            "payment_method": method, "origin_url": BASE_URL}


# --- InfinitePay test endpoint
def test_infinitepay_test(s):
    r = s.post(f"{API}/admin/integrations/infinitepay/test", headers={"Origin": BASE_URL})
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True and "sucesso" in d["message"]
    assert d["url"].startswith("https://checkout.infinitepay.io/rafael-gomes-23d")


# --- Pluxee test with empty creds
def test_pluxee_test_empty(s):
    r = s.post(f"{API}/admin/integrations/pluxee/test")
    assert r.status_code == 200
    assert r.json()["ok"] is False and "Preencha todas as credenciais" in r.json()["message"]


def test_pluxee_disabled_order_400(s):
    assert requests.get(f"{API}/settings").json()["pluxee_ready"] is False
    r = requests.post(f"{API}/orders", json=order_payload("Pluxee Refeição Online"))
    assert r.status_code == 400


# --- Pluxee save + mask + keep secret
def test_pluxee_save_masked(s):
    r = s.put(f"{API}/admin/integrations", json=FAKE)
    assert r.status_code == 200
    d = r.json()
    assert d["pluxee_client_secret"] == "••••abcd"
    assert d["pluxee_sub_key_cards"] == "••••1234"
    assert d["pluxee_configured"] is True
    assert d["pluxee_enabled"] is False
    # save masked/empty value keeps secret
    r = s.put(f"{API}/admin/integrations", json={"pluxee_client_secret": "••••abcd", "pluxee_sub_key_cards": ""})
    assert r.status_code == 200
    doc = mdb.settings.find_one({"id": "store"})
    assert doc["pluxee_client_secret"] == "TEST_secret_abcd"
    assert doc["pluxee_sub_key_cards"] == "TEST_cards_1234"


def test_pluxee_invalid_env(s):
    r = s.put(f"{API}/admin/integrations", json={"pluxee_env": "xxx"})
    assert r.status_code == 400


def test_pluxee_test_fake_creds_fails_gracefully(s):
    r = s.post(f"{API}/admin/integrations/pluxee/test", timeout=60)
    assert r.status_code == 200
    d = r.json()
    print("pluxee test:", d)
    assert d["ok"] is False and d["message"]


def test_pluxee_enabled_ready_and_pay_fails(s):
    r = s.put(f"{API}/admin/integrations", json={"pluxee_enabled": True})
    assert r.json()["pluxee_enabled"] is True
    assert requests.get(f"{API}/settings").json()["pluxee_ready"] is True
    r = requests.post(f"{API}/orders", json=order_payload("Pluxee Refeição Online"))
    assert r.status_code == 200
    o = r.json()
    CREATED.append(o["id"])
    assert o["payment_mode"] == "pluxee" and o["payment_status"] == "Aguardando pagamento online"
    card = {"order_id": o["id"], "card_number": "6060 1234 5678 9012", "owner_name": "TEST Nome", "expiry_month": "12",
            "expiry_year": "30", "cvv": "123", "cpf": "123.456.789-09"}
    r = requests.post(f"{API}/payments/pluxee/pay", json=card, timeout=60)
    print("pluxee pay:", r.status_code, r.text)
    assert r.status_code in (402, 502)
    assert mdb.orders.find_one({"id": o["id"]})["payment_status"] == "Aguardando pagamento online"
    # disable again
    r = s.put(f"{API}/admin/integrations", json={"pluxee_enabled": False})
    assert r.json()["pluxee_enabled"] is False
    assert requests.get(f"{API}/settings").json()["pluxee_ready"] is False
    r = requests.post(f"{API}/payments/pluxee/pay", json=card)
    assert r.status_code == 400


def test_pluxee_pay_wrong_order_404():
    r = requests.post(f"{API}/payments/pluxee/pay", json={"order_id": "nope", "card_number": "1", "owner_name": "a",
                                                          "expiry_month": "1", "expiry_year": "1", "cvv": "1", "cpf": "1"})
    assert r.status_code == 404


# --- Seeded statuses
def test_seeded_statuses():
    st = {x["name"]: x for x in requests.get(f"{API}/config/statuses").json()}
    assert st["Pagamento Aprovado"]["auto_on_online_paid"] is True
    assert st["Cancelado"]["is_cancel"] is True and st["Cancelado"]["requires_note"] is True


@pytest.fixture(scope="module")
def cancel_status(s):
    # DB's pre-existing 'Cancelado' lacks is_cancel (seed skipped) -> use TEST_ cancel status
    r = s.post(f"{API}/config/statuses", json={"name": "TEST_Cancelado", "color": "zinc", "is_cancel": True,
                                               "requires_note": True, "position": 99})
    assert r.status_code == 200
    d = r.json()
    assert d["is_cancel"] is True and d["requires_note"] is True
    return d["name"]


# --- Status justification
def test_status_note_required_and_history(s, cancel_status):
    r = requests.post(f"{API}/orders", json=order_payload("Dinheiro"))
    o = r.json()
    CREATED.append(o["id"])
    r = s.patch(f"{API}/orders/{o['id']}/status", json={"status": cancel_status})
    assert r.status_code == 400
    r = s.patch(f"{API}/orders/{o['id']}/status", json={"status": cancel_status, "note": "  TEST_motivo  "})
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == cancel_status and d["status_note"] == "TEST_motivo"
    assert d["payment_status"] == "A pagar na entrega"  # not paid online -> no refund
    assert d["status_history"][-1]["note"] == "TEST_motivo"
    r = s.patch(f"{API}/orders/{o['id']}/status", json={"status": "Em Preparo"})
    assert r.status_code == 200 and r.json()["status_note"] == ""
    assert len(mdb.orders.find_one({"id": o["id"]})["status_history"]) == 2


# --- Refund flow (InfinitePay paid order)
def test_refund_flow_infinitepay(s, cancel_status):
    r = requests.post(f"{API}/orders", json=order_payload("Pix Online"))
    assert r.status_code == 200
    o = r.json()
    CREATED.append(o["id"])
    assert o["checkout_url"].startswith("https://checkout.infinitepay.io/")
    mdb.orders.update_one({"id": o["id"]}, {"$set": {"payment_status": "Pago", "status": "Pagamento Aprovado"}})
    r = s.patch(f"{API}/orders/{o['id']}/status", json={"status": cancel_status, "note": "TEST_cliente desistiu"})
    assert r.status_code == 200
    assert r.json()["payment_status"] == "Estorno pendente"
    r = s.patch(f"{API}/orders/{o['id']}/refunded")
    assert r.status_code == 200 and r.json()["payment_status"] == "Estornado"
    doc = mdb.orders.find_one({"id": o["id"]})
    assert doc["payment_status"] == "Estornado"
    assert doc["status_history"][-1]["note"] == "Estorno realizado"


def test_refunded_404(s):
    assert s.patch(f"{API}/orders/nope/refunded").status_code == 404


def test_integrations_requires_auth():
    assert requests.get(f"{API}/admin/integrations").status_code == 401
    assert requests.put(f"{API}/admin/integrations", json={}).status_code == 401
    assert requests.post(f"{API}/admin/integrations/pluxee/test").status_code == 401
