from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'lanche123')

app = FastAPI()
api_router = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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


class Order(OrderInput):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_code: str
    subtotal: float
    discount: float = 0
    total: float
    status: str = "Pendente"
    payment_status: str = "A pagar na entrega"
    created_at: str = Field(default_factory=now_iso)


class StatusUpdate(BaseModel):
    status: str


class PaymentUpdate(BaseModel):
    payment_method: str
    change_for: Optional[float] = None


class Settings(BaseModel):
    store_whatsapp: str = "5541989023769"
    pix_key: str = ""


class AdminLogin(BaseModel):
    password: str


class Coupon(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    discount_type: str  # "percent" | "fixed"
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


# ---------- Seed ----------
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
async def seed_products():
    count = await db.products.count_documents({})
    if count == 0:
        docs = [Product(**p).model_dump() for p in SEED_PRODUCTS]
        await db.products.insert_many(docs)
        logging.info(f"Seeded {len(docs)} products")
    for cat, flavors in DEFAULT_FLAVORS.items():
        await db.products.update_many(
            {"category": cat, "flavors": {"$exists": False}}, {"$set": {"flavors": flavors}}
        )


# ---------- Helpers ----------
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
    total = max(round(subtotal - discount, 2), 0)
    return round(subtotal, 2), round(discount, 2), total, coupon


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


# ---------- Product routes ----------
@api_router.get("/")
async def root():
    return {"message": "Deliciosas Cucas API"}


@api_router.get("/products", response_model=List[Product])
async def list_products():
    return await db.products.find({}, {"_id": 0}).to_list(500)


@api_router.post("/products", response_model=Product)
async def create_product(data: ProductInput):
    product = Product(**data.model_dump())
    await db.products.insert_one(product.model_dump())
    return product


@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, data: ProductInput):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    updated = {**existing, **data.model_dump()}
    await db.products.update_one({"id": product_id}, {"$set": updated})
    return updated


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return {"ok": True}


# ---------- Coupon routes ----------
@api_router.get("/coupons", response_model=List[Coupon])
async def list_coupons():
    return await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/coupons", response_model=Coupon)
async def create_coupon(data: CouponInput):
    code = data.code.upper().strip()
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Já existe um cupom com esse código")
    coupon = Coupon(**{**data.model_dump(), "code": code})
    await db.coupons.insert_one(coupon.model_dump())
    return coupon


@api_router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str):
    res = await db.coupons.delete_one({"id": coupon_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cupom não encontrado")
    return {"ok": True}


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
    return {
        "valid": True,
        "message": "Cupom aplicado!",
        "discount": discount,
        "total": round(max(data.subtotal - discount, 0), 2),
        "discount_type": coupon["discount_type"],
        "discount_value": coupon["discount_value"],
    }


# ---------- Order routes ----------
@api_router.post("/orders", response_model=Order)
async def create_order(data: OrderInput):
    subtotal, discount, total, coupon = await compute_totals(data.items, data.coupon_code)
    code = f"ENC-{random.randint(1000, 9999)}"
    order = Order(
        **data.model_dump(), order_code=code, subtotal=subtotal, discount=discount,
        total=total, status="Pendente", payment_status="A pagar na entrega",
    )
    await db.orders.insert_one(order.model_dump())
    if coupon:
        await db.coupons.update_one({"id": coupon["id"]}, {"$inc": {"used_count": 1}})
    return order


@api_router.get("/orders", response_model=List[Order])
async def list_orders():
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


PAYMENT_BY_STATUS = {
    "Entregue e Pago": "Pago",
    "Entregue - Aguardando Pagamento": "Aguardando Pagamento",
}


@api_router.patch("/orders/{order_id}/status", response_model=Order)
async def update_order_status(order_id: str, data: StatusUpdate):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    update = {"status": data.status}
    if data.status in PAYMENT_BY_STATUS:
        update["payment_status"] = PAYMENT_BY_STATUS[data.status]
    await db.orders.update_one({"id": order_id}, {"$set": update})
    return {**existing, **update}


@api_router.patch("/orders/{order_id}/payment", response_model=Order)
async def update_order_payment(order_id: str, data: PaymentUpdate):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    update = data.model_dump()
    await db.orders.update_one({"id": order_id}, {"$set": update})
    return {**existing, **update}


@api_router.get("/settings", response_model=Settings)
async def get_settings():
    doc = await db.settings.find_one({"id": "store"}, {"_id": 0, "id": 0})
    return Settings(**(doc or {}))


@api_router.put("/settings", response_model=Settings)
async def update_settings(data: Settings):
    data.store_whatsapp = "".join(c for c in data.store_whatsapp if c.isdigit())
    await db.settings.update_one({"id": "store"}, {"$set": data.model_dump()}, upsert=True)
    return data


# ---------- Admin ----------
@api_router.post("/admin/login")
async def admin_login(data: AdminLogin):
    if data.password == ADMIN_PASSWORD:
        return {"ok": True}
    raise HTTPException(status_code=401, detail="Senha incorreta")


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
