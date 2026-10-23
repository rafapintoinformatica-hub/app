import httpx

BASE = "https://api.checkout.infinitepay.io"


async def create_link(handle: str, order: dict, origin_url: str) -> str:
    items = [
        {"quantity": i["quantity"], "price": int(round(i["price"] * 100)),
         "description": f"{i['name']}{' - ' + i['flavor'] if i.get('flavor') else ''}"}
        for i in order["items"]
    ]
    if order["discount"] > 0:
        # InfinitePay has no discount field: send the discounted total as a single item
        items = [{"quantity": 1, "price": int(round(order["total"] * 100)),
                  "description": f"Pedido #{order['order_code']} (com desconto)"}]
    digits = "".join(c for c in order["customer_phone"] if c.isdigit())
    payload = {
        "handle": handle,
        "items": items,
        "order_nsu": order["id"],
        "redirect_url": f"{origin_url}/pagamento/retorno",
        "webhook_url": f"{origin_url}/api/infinitepay/webhook",
        "customer": {"name": order["customer_name"],
                     "phone_number": f"+{digits if digits.startswith('55') else '55' + digits}"},
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{BASE}/links", json=payload)
    r.raise_for_status()
    return r.json()["url"]


async def check_payment(handle: str, order_nsu: str, transaction_nsu: str, slug: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{BASE}/payment_check", json={
            "handle": handle, "order_nsu": order_nsu, "transaction_nsu": transaction_nsu, "slug": slug,
        })
    return r.json()
