from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, BackgroundTasks
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import bcrypt
import jwt
from pydantic import BaseModel, Field, ValidationError
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

import notify
import infinitepay

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']

app = FastAPI()
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


# ---------- Auth ----------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


async def require_admin(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    if payload.get("sub") != "admin":
        raise HTTPException(status_code=401, detail="Token inválido")
    return True


Admin = Depends(require_admin)


# ---------- Models ----------
class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: str = ""
    price: float
    category: str
    image_url: str = ""
    badge: Optional[str] = None
    lead_time_days: int = 1
    available: bool = True
    flavors: List[str] = []
    created_at: str = Field(default_factory=now_iso)


class ProductInput(BaseModel):
    name: str
    description: str = ""
    price: float
    category: str
    image_url: str = ""
    badge: Optional[str] = None
    lead_time_days: int = 1
    available: bool = True
    flavors: List[str] = []


class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    flavor: Optional[str] = None


class OrderInput(BaseModel):
    customer_name: str
    customer_phone: str
    address: str
    neighborhood: str = ""
    cep: str = ""
    complement: str = ""
    delivery_date: str
    time_slot: str = ""
    items: List[OrderItem]
    payment_method: str
    change_for: Optional[float] = None
    notes: str = ""
    coupon_code: Optional[str] = None


class OrderCreate(OrderInput):
    origin_url: Optional[str] = None


class Order(OrderInput):
    id: str = Field(default_factory=new_id)
    order_code: str
    subtotal: float
    discount: float = 0
    total: float
    status: str = "Pendente"
    payment_status: str = "A pagar na entrega"
    payment_mode: str = "entrega"
    checkout_url: Optional[str] = None
    receipt_url: Optional[str] = None
    transaction_nsu: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class StatusUpdate(BaseModel):
    status: str


class PaymentUpdate(BaseModel):
    payment_method: str
    change_for: Optional[float] = None


PUBLIC_SETTINGS = ["store_name", "store_tagline", "hero_badge", "hero_title", "hero_subtitle",
                   "hero_image", "footer_text", "store_whatsapp", "pix_key"]


class Settings(BaseModel):
    store_name: str = "Deliciosas Cucas"
    store_tagline: str = "Cucas & Bolos"
    hero_badge: str = "Cucas & bolos feitos sob encomenda"
    hero_title: str = "Cucas e bolos caseiros, agendados do seu jeito."
    hero_subtitle: str = "Escolha seus favoritos, marque o dia da entrega e pague online ou na entrega. Tudo assado fresquinho para você."
    hero_image: str = "https://images.pexels.com/photos/5121948/pexels-photo-5121948.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    footer_text: str = "Pedidos agendados · Pague online ou na entrega"
    store_whatsapp: str = "5541989023769"
    pix_key: str = ""
    infinitepay_handle: str = "rafael-gomes-23d"
    notification_email: str = ""


class AdminLogin(BaseModel):
    password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class Coupon(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    discount_type: str
    discount_value: float
    max_uses: int = 1
    used_count: int = 0
    active: bool = True
    valid_until: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class CouponInput(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    max_uses: int = 1
    active: bool = True
    valid_until: Optional[str] = None


class CouponValidate(BaseModel):
    code: str
    subtotal: float


# Configurable lists
class StatusItem(BaseModel):
    name: str
    color: str = "amber"
    position: int = 0
    is_initial: bool = False
    marks_paid: bool = False
    sends_charge: bool = False


class PaymentMethodItem(BaseModel):
    name: str
    mode: str = "entrega"  # "entrega" | "online"
    allows_change: bool = False
    active: bool = True
    position: int = 0


class PlaceField(BaseModel):
    label: str
    placeholder: str = ""


class PlaceItem(BaseModel):
    name: str
    fields: List[PlaceField] = []
    position: int = 0


class CategoryItem(BaseModel):
    name: str
    position: int = 0


CONFIG_MODELS = {
    "statuses": StatusItem,
    "payment_methods": PaymentMethodItem,
    "places": PlaceItem,
    "categories": CategoryItem,
}


def parse_config(kind: str, body: dict) -> dict:
    model = CONFIG_MODELS.get(kind)
    if not model:
        raise HTTPException(status_code=404, detail="Tipo inválido")
    try:
        item = model(**body).model_dump()
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors(include_url=False, include_context=False))
    if not item["name"].strip():
        raise HTTPException(status_code=422, detail="Informe o nome")
    item["name"] = item["name"].strip()
    return item

DEFAULT_CONFIG = {
    "statuses": [
        {"name": "Pendente", "color": "amber", "is_initial": True},
        {"name": "Em Preparo", "color": "blue"},
        {"name": "Pronto", "color": "purple"},
        {"name": "Em Rota", "color": "orange"},
        {"name": "Entregue e Pago", "color": "emerald", "marks_paid": True},
        {"name": "Entregue - Aguardando Pagamento", "color": "red", "sends_charge": True},
    ],
    "payment_methods": [
        {"name": "Pix Online", "mode": "online"},
        {"name": "Cartão de Crédito Online", "mode": "online"},
        {"name": "Pix", "mode": "entrega"},
        {"name": "Cartão de Crédito", "mode": "entrega"},
        {"name": "Cartão de Débito", "mode": "entrega"},
        {"name": "Pluxee Refeição", "mode": "entrega"},
        {"name": "Dinheiro", "mode": "entrega", "allows_change": True},
    ],
    "places": [
        {"name": "Amil", "fields": [{"label": "Setor", "placeholder": "Ex: Financeiro, 3º andar"},
                                    {"label": "Intervalo disponível", "placeholder": "Ex: 12h às 13h"}]},
        {"name": "Green Park", "fields": [{"label": "Bloco", "placeholder": "Ex: Bloco 4"},
                                          {"label": "Apartamento", "placeholder": "Ex: 302"}]},
    ],
    "categories": [{"name": n} for n in ["Cucas", "Bolos Caseiros", "Bolos Recheados", "Tortas Doces", "Bebidas"]],
}


SEED_PRODUCTS = [
    {
        "name": "Cuca de Banana com Farofa Doce",
        "description": "Cuca fofinha de banana coberta com farofa doce crocante de canela. Forma inteira, serve até 10 fatias.",
        "price": 32.90, "category": "Cucas", "badge": None, "lead_time_days": 1,
        "image_url": "https://images.pexels.com/photos/34241964/pexels-photo-34241964.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
    {
        "name": "Cuca de Frutas Vermelhas",
        "description": "Massa amanteigada com geleia de frutas vermelhas e streusel dourado por cima. Clássica cuca alemã.",
        "price": 36.90, "category": "Cucas", "badge": "Mais Pedidos", "lead_time_days": 1,
        "image_url": "https://images.pexels.com/photos/35286345/pexels-photo-35286345.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
    {
        "name": "Bolo de Fubá Cremoso",
        "description": "Bolo de fubá cremoso de goiabada por dentro, assado no capricho. Perfeito com café. Forma inteira.",
        "price": 28.90, "category": "Bolos Caseiros", "badge": None, "lead_time_days": 1,
        "image_url": "https://images.unsplash.com/photo-1664339031047-970bf639e43f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwxfHxjb3JubWVhbCUyMHBvdW5kJTIwY2FrZSUyMHJ1c3RpY3xlbnwwfHx8fDE3OTIyNDgzOTJ8MA&ixlib=rb-4.1.0&q=85",
    },
    {
        "name": "Bolo de Cenoura com Cobertura de Chocolate",
        "description": "O xodó da casa: bolo de cenoura fofinho com generosa cobertura de brigadeiro cremoso.",
        "price": 34.90, "category": "Bolos Caseiros", "badge": "Novidade", "lead_time_days": 1,
        "image_url": "https://images.pexels.com/photos/5121948/pexels-photo-5121948.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
    {
        "name": "Bolo de Chocolate Recheado",
        "description": "Três camadas de massa de chocolate intenso com recheio de ganache. Sob encomenda, 1,2kg.",
        "price": 49.90, "category": "Bolos Recheados", "badge": "Mais Pedidos", "lead_time_days": 2,
        "image_url": "https://images.unsplash.com/photo-1722673353577-350697f89b31?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwzfHxjaG9jb2xhdGUlMjBsYXllciUyMGNha2UlMjBzbGljZXxlbnwwfHx8fDE3OTIyNDgzOTJ8MA&ixlib=rb-4.1.0&q=85",
    },
    {
        "name": "Bolo Floresta Negra",
        "description": "Massa de chocolate, chantilly, cerejas e raspas de chocolate meio amargo. Encomenda especial, 1,5kg.",
        "price": 58.90, "category": "Bolos Recheados", "badge": None, "lead_time_days": 2,
        "image_url": "https://images.pexels.com/photos/37050357/pexels-photo-37050357.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
    {
        "name": "Torta de Limão",
        "description": "Base crocante, creme de limão siciliano e merengue maçaricado. Refrescante e irresistível.",
        "price": 42.90, "category": "Tortas Doces", "badge": "Novidade", "lead_time_days": 1,
        "image_url": "https://images.unsplash.com/photo-1614174486496-344ef3e9d870?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwxfHxsZW1vbiUyMHBpZSUyMHRhcnQlMjBkZXNzZXJ0fGVufDB8fHx8MTc5MjI0ODM5Mnww&ixlib=rb-4.1.0&q=85",
    },
    {
        "name": "Suco Natural Artesanal (1,5L)",
        "description": "Suco natural da estação, feito na hora. Combina perfeitamente com cucas e bolos. Garrafa 1,5L.",
        "price": 18.90, "category": "Bebidas", "badge": "Vegano", "lead_time_days": 1,
        "image_url": "https://images.pexels.com/photos/1337825/pexels-photo-1337825.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
]


DEFAULT_FLAVORS = {
    "Cucas": ["Banana", "Uva", "Frutas Vermelhas", "Coco", "Doce de Leite"],
    "Bolos Caseiros": ["Fubá", "Cenoura", "Laranja", "Milho"],
    "Bolos Recheados": ["Chocolate", "Prestígio", "Ninho com Morango"],
    "Tortas Doces": ["Limão", "Maracujá"],
    "Bebidas": ["Laranja", "Uva", "Abacaxi com Hortelã"],
}



@app.on_event("startup")
async def startup_seed():
    if await db.products.count_documents({}) == 0:
        await db.products.insert_many([Product(**p).model_dump() for p in SEED_PRODUCTS])
    for kind, items in DEFAULT_CONFIG.items():
        if await db[kind].count_documents({}) == 0:
            docs = [{**CONFIG_MODELS[kind](**{**it, "position": i}).model_dump(), "id": new_id()}
                    for i, it in enumerate(items)]
            await db[kind].insert_many(docs)
    existing = await db.settings.find_one({"id": "store"}, {"_id": 0}) or {}
    merged = {**Settings().model_dump(), **{k: v for k, v in existing.items() if k != "id"}}
    await db.settings.update_one({"id": "store"}, {"$set": merged}, upsert=True)
    if not await db.admin.find_one({"id": "admin"}):
        await db.admin.insert_one({"id": "admin", "password_hash": hash_password(os.environ["ADMIN_PASSWORD"])})
    await db.push_subscriptions.create_index("endpoint", unique=True)


# ---------- Helpers ----------
def _coupon_usable(coupon: dict) -> bool:
    if not coupon.get("active"):
        return False
    if coupon.get("used_count", 0) >= coupon.get("max_uses", 1):
        return False
    if coupon.get("valid_until"):
        try:
            if datetime.fromisoformat(coupon["valid_until"]).date() < datetime.now(timezone.utc).date():
                return False
        except ValueError:
            pass
    return True


async def compute_totals(items: List[OrderItem], coupon_code: Optional[str]):
    subtotal = sum(i.price * i.quantity for i in items)
    discount = 0.0
    coupon = None
    if coupon_code:
        coupon = await db.coupons.find_one({"code": coupon_code.upper().strip()}, {"_id": 0})
        if coupon and _coupon_usable(coupon):
            if coupon["discount_type"] == "percent":
                discount = subtotal * coupon["discount_value"] / 100.0
            else:
                discount = min(coupon["discount_value"], subtotal)
        else:
            coupon = None
    total = max(round(subtotal - discount, 2), 0)
    return round(subtotal, 2), round(discount, 2), total, coupon


async def get_settings_doc() -> dict:
    return await db.settings.find_one({"id": "store"}, {"_id": 0, "id": 0}) or Settings().model_dump()


async def get_payment_method(name: str) -> dict:
    pm = await db.payment_methods.find_one({"name": name, "active": True}, {"_id": 0})
    if not pm:
        raise HTTPException(status_code=400, detail="Forma de pagamento inválida")
    return pm


async def mark_paid(order_id: str, extra: dict) -> Optional[dict]:
    res = await db.orders.update_one(
        {"id": order_id, "payment_status": {"$ne": "Pago"}},
        {"$set": {"payment_status": "Pago", **extra}},
    )
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if res.modified_count and order:
        try:
            await notify.notify_payment_approved(db, order)
        except Exception as e:
            logger.error(f"Notify error: {e}")
    return order


# ---------- Public routes ----------
@api_router.get("/")
async def root():
    return {"message": "Deliciosas Cucas API"}


@api_router.get("/products", response_model=List[Product])
async def list_products():
    return await db.products.find({}, {"_id": 0}).to_list(500)


@api_router.get("/settings")
async def public_settings():
    s = await get_settings_doc()
    return {k: s.get(k, "") for k in PUBLIC_SETTINGS}


@api_router.get("/config/{kind}")
async def list_config(kind: str):
    if kind not in CONFIG_MODELS:
        raise HTTPException(status_code=404, detail="Tipo inválido")
    return await db[kind].find({}, {"_id": 0}).sort("position", 1).to_list(500)


@api_router.post("/coupons/validate")
async def validate_coupon(data: CouponValidate):
    coupon = await db.coupons.find_one({"code": data.code.upper().strip()}, {"_id": 0})
    if not coupon:
        return {"valid": False, "message": "Cupom não encontrado"}
    if not _coupon_usable(coupon):
        return {"valid": False, "message": "Cupom expirado ou esgotado"}
    if coupon["discount_type"] == "percent":
        discount = data.subtotal * coupon["discount_value"] / 100.0
    else:
        discount = min(coupon["discount_value"], data.subtotal)
    discount = round(discount, 2)
    return {"valid": True, "message": "Cupom aplicado!", "discount": discount,
            "total": round(max(data.subtotal - discount, 0), 2)}


@api_router.post("/orders")
async def create_order(data: OrderCreate):
    pm = await get_payment_method(data.payment_method)
    subtotal, discount, total, coupon = await compute_totals(data.items, data.coupon_code)
    initial = await db.statuses.find_one({"is_initial": True}, {"_id": 0}) or \
        await db.statuses.find_one({}, {"_id": 0}, sort=[("position", 1)])
    online = pm["mode"] == "online"
    order = Order(
        **data.model_dump(exclude={"origin_url"}), order_code=f"ENC-{random.randint(1000, 9999)}",
        subtotal=subtotal, discount=discount, total=total,
        status=initial["name"] if initial else "Pendente",
        payment_status="Aguardando pagamento online" if online else "A pagar na entrega",
        payment_mode=pm["mode"],
    )
    if not pm.get("allows_change"):
        order.change_for = None
    doc = order.model_dump()
    if online:
        if not data.origin_url:
            raise HTTPException(status_code=400, detail="origin_url obrigatório para pagamento online")
        settings = await get_settings_doc()
        try:
            doc["checkout_url"] = await infinitepay.create_link(settings["infinitepay_handle"], doc, data.origin_url)
        except Exception as e:
            logger.error(f"InfinitePay error: {e}")
            raise HTTPException(status_code=502, detail="Não foi possível gerar o pagamento online. Tente novamente.")
    await db.orders.insert_one(doc)
    if coupon:
        await db.coupons.update_one({"id": coupon["id"]}, {"$inc": {"used_count": 1}})
    doc.pop("_id", None)
    return doc


@api_router.get("/orders/{order_id}/public")
async def public_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return order


class PaymentConfirm(BaseModel):
    order_id: str
    transaction_nsu: str
    slug: str
    receipt_url: Optional[str] = None


@api_router.post("/payments/infinitepay/confirm")
async def confirm_infinitepay(data: PaymentConfirm):
    order = await db.orders.find_one({"id": data.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if order.get("payment_status") == "Pago":
        return order
    settings = await get_settings_doc()
    check = await infinitepay.check_payment(settings["infinitepay_handle"], data.order_id, data.transaction_nsu, data.slug)
    if check.get("success") and check.get("paid"):
        return await mark_paid(data.order_id, {"transaction_nsu": data.transaction_nsu, "receipt_url": data.receipt_url})
    return order


@api_router.post("/infinitepay/webhook")
async def infinitepay_webhook(request: Request, background: BackgroundTasks):
    body = await request.json()
    order_id, tx, slug = body.get("order_nsu"), body.get("transaction_nsu"), body.get("invoice_slug")
    if not (order_id and tx and slug):
        raise HTTPException(status_code=400, detail="Payload inválido")
    if not await db.orders.find_one({"id": order_id}, {"_id": 0, "id": 1}):
        return {"ok": True}

    async def process():
        settings = await get_settings_doc()
        check = await infinitepay.check_payment(settings["infinitepay_handle"], order_id, tx, slug)
        if check.get("success") and check.get("paid"):
            await mark_paid(order_id, {"transaction_nsu": tx, "receipt_url": body.get("receipt_url")})

    background.add_task(process)
    return {"ok": True}


# ---------- Admin auth ----------
@api_router.post("/admin/login")
async def admin_login(data: AdminLogin, request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0]
    attempt = await db.login_attempts.find_one({"ip": ip}, {"_id": 0})
    if attempt and attempt.get("count", 0) >= 5 and attempt.get("until", "") > now_iso():
        raise HTTPException(status_code=429, detail="Muitas tentativas. Aguarde 15 minutos.")
    admin = await db.admin.find_one({"id": "admin"}, {"_id": 0})
    if not verify_password(data.password, admin["password_hash"]):
        count = (attempt or {}).get("count", 0) + 1
        until = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"ip": ip}, {"$set": {"count": count, "until": until}}, upsert=True)
        raise HTTPException(status_code=401, detail="Senha incorreta")
    await db.login_attempts.delete_one({"ip": ip})
    token = jwt.encode({"sub": "admin", "exp": datetime.now(timezone.utc) + timedelta(days=7)}, JWT_SECRET, algorithm="HS256")
    return {"ok": True, "token": token}


@api_router.get("/admin/me")
async def admin_me(_=Admin):
    return {"ok": True}


@api_router.put("/admin/password")
async def change_password(data: PasswordChange, _=Admin):
    admin = await db.admin.find_one({"id": "admin"}, {"_id": 0})
    if not verify_password(data.current_password, admin["password_hash"]):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="A nova senha precisa ter ao menos 6 caracteres")
    await db.admin.update_one({"id": "admin"}, {"$set": {"password_hash": hash_password(data.new_password)}})
    return {"ok": True}


# ---------- Admin: settings & config ----------
@api_router.get("/admin/settings", response_model=Settings)
async def admin_settings(_=Admin):
    return Settings(**await get_settings_doc())


@api_router.put("/admin/settings", response_model=Settings)
async def update_settings(data: Settings, _=Admin):
    data.store_whatsapp = "".join(c for c in data.store_whatsapp if c.isdigit())
    data.infinitepay_handle = data.infinitepay_handle.strip().lstrip("$")
    data.notification_email = data.notification_email.strip()
    await db.settings.update_one({"id": "store"}, {"$set": data.model_dump()}, upsert=True)
    return data


@api_router.post("/config/{kind}")
async def create_config(kind: str, body: dict, _=Admin):
    item = parse_config(kind, body)
    if await db[kind].find_one({"name": item["name"]}):
        raise HTTPException(status_code=400, detail="Já existe um item com esse nome")
    if kind == "statuses" and item["is_initial"]:
        await db.statuses.update_many({}, {"$set": {"is_initial": False}})
    item["id"] = new_id()
    await db[kind].insert_one(item)
    item.pop("_id", None)
    return item


@api_router.put("/config/{kind}/{item_id}")
async def update_config(kind: str, item_id: str, body: dict, _=Admin):
    item = parse_config(kind, body)
    existing = await db[kind].find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    if kind == "statuses" and item["is_initial"]:
        await db.statuses.update_many({"id": {"$ne": item_id}}, {"$set": {"is_initial": False}})
    await db[kind].update_one({"id": item_id}, {"$set": item})
    if existing["name"] != item["name"]:
        field = {"statuses": "status", "payment_methods": "payment_method", "places": "address", "categories": None}[kind]
        if field:
            await db.orders.update_many({field: existing["name"]}, {"$set": {field: item["name"]}})
        else:
            await db.products.update_many({"category": existing["name"]}, {"$set": {"category": item["name"]}})
    return {**item, "id": item_id}


@api_router.delete("/config/{kind}/{item_id}")
async def delete_config(kind: str, item_id: str, _=Admin):
    if kind not in CONFIG_MODELS:
        raise HTTPException(status_code=404, detail="Tipo inválido")
    if await db[kind].count_documents({}) <= 1:
        raise HTTPException(status_code=400, detail="Mantenha ao menos um item")
    res = await db[kind].delete_one({"id": item_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return {"ok": True}


# ---------- Admin: products ----------
@api_router.post("/products", response_model=Product)
async def create_product(data: ProductInput, _=Admin):
    product = Product(**data.model_dump())
    await db.products.insert_one(product.model_dump())
    return product


@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, data: ProductInput, _=Admin):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    updated = {**existing, **data.model_dump()}
    await db.products.update_one({"id": product_id}, {"$set": updated})
    return updated


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, _=Admin):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return {"ok": True}


# ---------- Admin: coupons ----------
@api_router.get("/coupons", response_model=List[Coupon])
async def list_coupons(_=Admin):
    return await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/coupons", response_model=Coupon)
async def create_coupon(data: CouponInput, _=Admin):
    code = data.code.upper().strip()
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Já existe um cupom com esse código")
    coupon = Coupon(**{**data.model_dump(), "code": code})
    await db.coupons.insert_one(coupon.model_dump())
    return coupon


@api_router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, _=Admin):
    res = await db.coupons.delete_one({"id": coupon_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cupom não encontrado")
    return {"ok": True}


# ---------- Admin: orders ----------
@api_router.get("/orders", response_model=List[Order])
async def list_orders(_=Admin):
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api_router.patch("/orders/{order_id}/status", response_model=Order)
async def update_order_status(order_id: str, data: StatusUpdate, _=Admin):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    status = await db.statuses.find_one({"name": data.status}, {"_id": 0})
    if not status:
        raise HTTPException(status_code=400, detail="Status inválido")
    update = {"status": data.status}
    if status.get("marks_paid"):
        update["payment_status"] = "Pago"
    elif status.get("sends_charge") and existing.get("payment_status") != "Pago":
        update["payment_status"] = "Aguardando Pagamento"
    await db.orders.update_one({"id": order_id}, {"$set": update})
    return {**existing, **update}


@api_router.patch("/orders/{order_id}/payment", response_model=Order)
async def update_order_payment(order_id: str, data: PaymentUpdate, _=Admin):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    pm = await db.payment_methods.find_one({"name": data.payment_method}, {"_id": 0})
    if not pm:
        raise HTTPException(status_code=400, detail="Forma de pagamento inválida")
    update = {"payment_method": data.payment_method,
              "change_for": data.change_for if pm.get("allows_change") else None}
    await db.orders.update_one({"id": order_id}, {"$set": update})
    return {**existing, **update}


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, _=Admin):
    res = await db.orders.delete_one({"id": order_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return {"ok": True}


# ---------- Admin: push notifications ----------
class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: dict


@api_router.get("/push/public-key")
async def push_public_key():
    return {"publicKey": notify.VAPID_PUBLIC_KEY}


@api_router.post("/push/subscribe")
async def push_subscribe(sub: PushSubscriptionIn, _=Admin):
    if set(sub.keys) != {"p256dh", "auth"} or not sub.endpoint.startswith("https://"):
        raise HTTPException(status_code=400, detail="Inscrição inválida")
    await db.push_subscriptions.update_one(
        {"endpoint": sub.endpoint}, {"$set": {"endpoint": sub.endpoint, "keys": sub.keys, "created_at": now_iso()}}, upsert=True)
    return {"ok": True}


@api_router.post("/push/test")
async def push_test(_=Admin):
    sent = await notify.send_push_all(db, "Teste de notificação", "As notificações da loja estão funcionando!")
    return {"sent": sent}


@api_router.post("/admin/test-email")
async def email_test(_=Admin):
    s = await get_settings_doc()
    if not s.get("notification_email"):
        raise HTTPException(status_code=400, detail="Cadastre o e-mail de notificação primeiro")
    sample = {"order_code": "TESTE", "customer_name": "Cliente Teste", "customer_phone": "41999999999",
              "payment_method": "Pix Online", "delivery_date": "--", "address": "Amil", "complement": "",
              "items": [{"quantity": 1, "name": "Cuca de Banana", "flavor": None, "price": 32.9}], "total": 32.9}
    ok = await notify.send_email(to=s["notification_email"], subject="Teste - Deliciosas Cucas",
                                 html=notify.payment_email_html(sample))
    if not ok:
        raise HTTPException(status_code=502, detail="Falha ao enviar e-mail")
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
