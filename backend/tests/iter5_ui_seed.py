# Helper: seed/cleanup TEST_ data for iteration 5 UI tests. Usage: python iter5_ui_seed.py seed|cleanup
import os, sys, requests
from datetime import date, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{URL}/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
s = requests.Session()
s.headers["Authorization"] = "Bearer " + s.post(f"{API}/admin/login", json={"password": "lanche123"}).json()["token"]


def order(method, name):
    return s.post(f"{API}/orders", json={"customer_name": name, "customer_phone": "41999990000", "address": "TEST_Rua",
                                         "delivery_date": (date.today() + timedelta(days=3)).isoformat(),
                                         "items": [{"product_id": "x", "name": "TEST_Cuca", "price": 10.0, "quantity": 1}],
                                         "payment_method": method, "origin_url": URL}).json()


if sys.argv[1] == "seed":
    print(s.post(f"{API}/config/statuses", json={"name": "TEST_Cancelado", "color": "zinc", "is_cancel": True, "requires_note": True, "position": 99}).status_code)
    a = order("Pix Online", "TEST_PagoOnline")
    db.orders.update_one({"id": a["id"]}, {"$set": {"payment_status": "Pago", "status": "Pagamento Aprovado", "transaction_nsu": "TEST_nsu"}})
    b = order("Dinheiro", "TEST_Entrega")
    print("paid:", a["order_code"], "entrega:", b["order_code"])
else:
    for o in db.orders.find({"customer_name": {"$regex": "^TEST_"}}, {"id": 1, "order_code": 1}):
        print("del", o["order_code"], s.delete(f"{API}/orders/{o['id']}").status_code)
    print("statuses", db.statuses.delete_many({"name": {"$regex": "^TEST_"}}).deleted_count)
    db.settings.update_one({"id": "store"}, {"$set": {"pluxee_enabled": False, "pluxee_client_id": None, "pluxee_mid": None, "pluxee_env": "uat",
                                                      "infinitepay_handle": "rafael-gomes-23d"},
                                             "$unset": {"pluxee_client_secret": "", "pluxee_sub_key_cards": "", "pluxee_sub_key_transaction": ""}})
    print(requests.get(f"{API}/settings").json()["pluxee_ready"])
