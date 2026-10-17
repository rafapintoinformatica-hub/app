from fastapi import FastAPI, APIRouter, HTTPException
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


class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int


class OrderInput(BaseModel):
    customer_name: str
    customer_phone: str
    address: str
    neighborhood: str = ""
    cep: str = ""
    complement: str = ""
    delivery_date: str
    time_slot: str
    items: List[OrderItem]
    payment_method: str
    notes: str = ""


class Order(OrderInput):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_code: str
    subtotal: float
    total: float
    status: str = "Pendente"
    created_at: str = Field(default_factory=now_iso)


class StatusUpdate(BaseModel):
    status: str


class AdminLogin(BaseModel):
    password: str


# ---------- Seed ----------
SEED_PRODUCTS = [
    {
        "name": "Coxinha Gourmet de Frango com Catupiry",
        "description": "Coxinhas douradas e crocantes, recheadas com frango desfiado e catupiry cremoso. Pacote com 12 unidades.",
        "price": 48.90, "category": "Salgados & Coxinhas", "badge": "Mais Pedidos", "lead_time_days": 1,
        "image_url": "https://images.pexels.com/photos/17409458/pexels-photo-17409458.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
    {
        "name": "Cesta de Salgados Variados para Festa",
        "description": "Mini empadinhas, risoles, bolinhas de queijo e salgadinhos sortidos. Ideal para festas. 50 unidades.",
        "price": 129.90, "category": "Salgados & Coxinhas", "badge": "Festa", "lead_time_days": 2,
        "image_url": "https://images.pexels.com/photos/36933440/pexels-photo-36933440.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
    {
        "name": "Bandeja de Mini Pão de Queijo Recheado",
        "description": "Pães de queijo artesanais quentinhos, feitos com polvilho e queijo da canastra. Bandeja com 20.",
        "price": 39.90, "category": "Salgados & Coxinhas", "badge": "Novidade", "lead_time_days": 1,
        "image_url": "https://images.unsplash.com/photo-1598142982901-df6cec10ae35?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwxfHxicmF6aWxpYW4lMjBzYWxnYWRvcyUyMGNveGluaGElMjBlbXBhZGF8ZW58MHx8fHwxNzkyMjQ1ODU4fDA&ixlib=rb-4.1.0&q=85",
    },
    {
        "name": "Burger Defumado Bacon & Cheddar",
        "description": "Hambúrguer artesanal 180g, cheddar cremoso, bacon fatiado e pão brioche. Sob encomenda.",
        "price": 34.90, "category": "Hambúrgueres Artesanais", "badge": "Mais Pedidos", "lead_time_days": 1,
        "image_url": "https://images.pexels.com/photos/15010285/pexels-photo-15010285.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
    {
        "name": "Combo Smash Burger Duplo + Rústicas",
        "description": "Dois hambúrgueres smash, queijo prato e batatas rústicas com ervas. Combo individual.",
        "price": 42.90, "category": "Hambúrgueres Artesanais", "badge": None, "lead_time_days": 1,
        "image_url": "https://images.unsplash.com/photo-1790010381859-d4916cdd34fd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHw0fHxnb3VybWV0JTIwYnVyZ2VyJTIwY2hlZXNlJTIwYmFjb258ZW58MHx8fHwxNzkyMjQ1ODU7fDA&ixlib=rb-4.1.0&q=85",
    },
    {
        "name": "Kit Festa Gourmet (50 Salgados + 2 Burgers + Sobremesa)",
        "description": "Combo completo para celebrações: 50 salgados, 2 hambúrgueres artesanais e 1 sobremesa. Sob encomenda com 2 dias.",
        "price": 189.90, "category": "Combos Sob Encomenda", "badge": "Festa", "lead_time_days": 2,
        "image_url": "https://images.pexels.com/photos/25860505/pexels-photo-25860505.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
    {
        "name": "Burger de Brigadeiro com Morango",
        "description": "Brioche doce recheado com creme de avelã, brigadeiro gourmet e morangos frescos. Sobremesa artesanal.",
        "price": 27.90, "category": "Doces & Sobremesas", "badge": "Novidade", "lead_time_days": 1,
        "image_url": "https://images.pexels.com/photos/31450825/pexels-photo-31450825.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
    {
        "name": "Suco Natural Artesanal (1,5L)",
        "description": "Suco natural da estação, feito na hora com frutas selecionadas. Garrafa de 1,5 litro. Sabores sortidos.",
        "price": 18.90, "category": "Bebidas Naturais", "badge": "Vegano", "lead_time_days": 1,
        "image_url": "https://images.pexels.com/photos/1337825/pexels-photo-1337825.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    },
]


@app.on_event("startup")
async def seed_products():
    count = await db.products.count_documents({})
    if count == 0:
        docs = [Product(**p).model_dump() for p in SEED_PRODUCTS]
        await db.products.insert_many(docs)
        logging.info(f"Seeded {len(docs)} products")


# ---------- Product routes ----------
@api_router.get("/")
async def root():
    return {"message": "Lanchonete Artesanal API"}


@api_router.get("/products", response_model=List[Product])
async def list_products():
    items = await db.products.find({}, {"_id": 0}).to_list(500)
    return items


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


# ---------- Order routes ----------
@api_router.post("/orders", response_model=Order)
async def create_order(data: OrderInput):
    subtotal = sum(i.price * i.quantity for i in data.items)
    total = subtotal
    code = f"ENC-{random.randint(1000, 9999)}"
    order = Order(**data.model_dump(), order_code=code, subtotal=round(subtotal, 2), total=round(total, 2))
    await db.orders.insert_one(order.model_dump())
    return order


@api_router.get("/orders", response_model=List[Order])
async def list_orders():
    items = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@api_router.patch("/orders/{order_id}/status", response_model=Order)
async def update_order_status(order_id: str, data: StatusUpdate):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": data.status}})
    existing["status"] = data.status
    return existing


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
