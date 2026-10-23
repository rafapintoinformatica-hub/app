import time
import base64
import httpx

ENVS = {
    "uat": {"token": "https://connect.uat.pluxee.app/op/oidc/token", "base": "https://api.brso.uat.sodexonet.com/br/mpal"},
    "prd": {"token": "https://connect.pluxee.app/op/oidc/token", "base": "https://api.brso.sodexonet.com/br/mpal"},
}
SCOPE_CARDS = "scopes/card-service/cards/token"
SCOPE_TX = "scopes/transaction-service/transaction"
ERRORS = {
    "MPAL-TRANSACTION-1009": "CVV inválido", "MPAL-TRANSACTION-1051": "Saldo insuficiente",
    "MPAL-TRANSACTION-1017": "Limite diário excedido", "MPAL-TRANSACTION-1014": "Cartão inválido",
    "MPAL-TRANSACTION-1018": "Cartão bloqueado", "MPAL-TRANSACTION-1054": "Cartão vencido",
    "MPAL-TRANSACTION-1024": "Data de validade incorreta", "MPAL-TRANSACTION-1003": "CPF inválido",
    "MPAL-TRANSACTION-1082": "Tente novamente", "MPAL-TRANSACTION-1020": "Problema no cartão",
}
REQUIRED = ["pluxee_client_id", "pluxee_client_secret", "pluxee_mid", "pluxee_sub_key_cards", "pluxee_sub_key_transaction"]
_token_cache: dict = {}


class PluxeeError(Exception):
    pass


def is_configured(cfg: dict) -> bool:
    return all(cfg.get(k) for k in REQUIRED) and cfg.get("pluxee_env") in ENVS


async def _token(cfg: dict, scope: str) -> str:
    key = (cfg["pluxee_env"], cfg["pluxee_client_id"], scope)
    cached = _token_cache.get(key)
    if cached and cached[1] > time.time():
        return cached[0]
    env = ENVS[cfg["pluxee_env"]]
    basic = base64.b64encode(f"{cfg['pluxee_client_id']}:{cfg['pluxee_client_secret']}".encode()).decode()
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(env["token"], headers={"Authorization": f"Basic {basic}", "accept": "application/json"},
                         data={"grant_type": "client_credentials", "resource": env["base"] + "/", "scope": scope})
    if r.status_code != 200:
        raise PluxeeError(f"Falha na autenticação Pluxee ({r.status_code})")
    tok = r.json()["access_token"]
    _token_cache[key] = (tok, time.time() + 240)
    return tok


def _err(r: httpx.Response) -> str:
    try:
        d = r.json()
        code = d.get("responseCode", "")
        return ERRORS.get(code, d.get("responseDescription") or d.get("message") or f"Erro {r.status_code}")
    except ValueError:
        return f"Erro {r.status_code}"


async def test_connection(cfg: dict):
    await _token(cfg, SCOPE_CARDS)
    await _token(cfg, SCOPE_TX)


async def pay(cfg: dict, *, amount: float, order_number: str, card_number: str, owner_name: str,
              expiry_month: str, expiry_year: str, cvv: str, cpf: str) -> dict:
    base = ENVS[cfg["pluxee_env"]]["base"]
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{base}/card-service/cards/token", json={"cardNumber": card_number}, headers={
            "X-Mid": cfg["pluxee_mid"], "Ocp-Apim-Subscription-Key": cfg["pluxee_sub_key_cards"],
            "Authorization": f"Bearer {await _token(cfg, SCOPE_CARDS)}"})
        if r.status_code != 200:
            raise PluxeeError(_err(r))
        card_token = r.json()["cardToken"]
        r = await c.post(f"{base}/transaction-service/transaction", headers={
            "Ocp-Apim-Subscription-Key": cfg["pluxee_sub_key_transaction"],
            "Authorization": f"Bearer {await _token(cfg, SCOPE_TX)}"}, json={
            "payment": {"captureType": "AC", "currency": "BRL", "amount": round(amount, 2)},
            "card": {"token": {"token": card_token, "ownerName": owner_name, "cvv": cvv,
                               "expiryMonth": expiry_month, "expiryYear": expiry_year}},
            "merchant": {"orderNumber": order_number, "mid": cfg["pluxee_mid"]},
            "consumer": {"documentType": "CPF", "documentNumber": cpf},
        })
    if r.status_code != 200:
        raise PluxeeError(_err(r))
    data = r.json()
    if data.get("status") != "CAPTURED":
        raise PluxeeError(ERRORS.get(data.get("responseCode", ""), data.get("responseDescription") or "Pagamento recusado"))
    return data


async def cancel(cfg: dict, transaction_id: str, amount: float) -> dict:
    base = ENVS[cfg["pluxee_env"]]["base"]
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{base}/transaction-service/transaction/{transaction_id}/cancel", headers={
            "Ocp-Apim-Subscription-Key": cfg["pluxee_sub_key_transaction"],
            "Authorization": f"Bearer {await _token(cfg, SCOPE_TX)}"},
            json={"amount": round(amount, 2), "mid": cfg["pluxee_mid"]})
    if r.status_code != 200:
        raise PluxeeError(_err(r))
    return r.json()
