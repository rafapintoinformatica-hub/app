import os
import re
import json
import asyncio
import ipaddress
import logging
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
VAPID_PRIVATE_KEY = os.environ["VAPID_PRIVATE_KEY"]
VAPID_PUBLIC_KEY = os.environ["VAPID_PUBLIC_KEY"]
VAPID_SUBJECT = os.environ["VAPID_SUBJECT"]

# ---------- Email guardrail gate ----------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> bool:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return True
    except httpx.HTTPStatusError as e:
        logger.warning(f"Email send failed: {e.response.status_code} {e.response.text}")
    except Exception as e:
        logger.error(f"Email send error: {e}")
    return False


def _fmt_brl(v: float) -> str:
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def payment_email_html(order: dict) -> str:
    rows = "".join(
        f"<tr><td style='padding:4px 0'>{i['quantity']}x {escape(i['name'])}"
        f"{' (' + escape(i['flavor']) + ')' if i.get('flavor') else ''}</td>"
        f"<td style='padding:4px 0;text-align:right'>{_fmt_brl(i['price'] * i['quantity'])}</td></tr>"
        for i in order["items"]
    )
    return (
        "<table role='presentation' width='100%'><tr><td style='padding:24px;font-family:Arial,sans-serif;color:#3b1d0a'>"
        f"<h2 style='margin:0 0 8px'>Pagamento aprovado - pedido #{escape(order['order_code'])}</h2>"
        f"<p>Cliente: <strong>{escape(order['customer_name'])}</strong> ({escape(order['customer_phone'])})</p>"
        f"<p>Forma: {escape(order['payment_method'])} &middot; Entrega: {escape(order['delivery_date'])}</p>"
        f"<p>Local: {escape(order['address'])} {escape(order.get('complement') or '')}</p>"
        f"<table width='100%' style='border-top:1px solid #eee;margin-top:8px'>{rows}</table>"
        f"<p style='font-size:18px'><strong>Total pago: {_fmt_brl(order['total'])}</strong></p>"
        f"<p style='font-size:12px;color:#888'>Enviado por {escape(EMAIL_FROM_NAME)}.</p>"
        "</td></tr></table>"
    )


# ---------- Web push ----------
def _push_one(sub: dict, data: dict):
    webpush(sub, json.dumps(data), vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT}, ttl=3600)


async def send_push_all(db, title: str, body: str, url: str = "/admin") -> int:
    sent = 0
    async for s in db.push_subscriptions.find({}, {"_id": 0}):
        sub = {"endpoint": s["endpoint"], "keys": s["keys"]}
        try:
            await asyncio.to_thread(_push_one, sub, {"title": title, "body": body, "url": url})
            sent += 1
        except WebPushException as e:
            code = e.response.status_code if e.response is not None else None
            if code in (404, 410):
                await db.push_subscriptions.delete_one({"endpoint": s["endpoint"]})
            else:
                logger.warning(f"Push failed: {code}")
        except Exception as e:
            logger.warning(f"Push error: {e}")
    return sent


async def notify_payment_approved(db, order: dict):
    settings = await db.settings.find_one({"id": "store"}, {"_id": 0}) or {}
    title = f"Pagamento aprovado #{order['order_code']}"
    body = f"{order['customer_name']} pagou {_fmt_brl(order['total'])} ({order['payment_method']})"
    await send_push_all(db, title, body)
    if settings.get("notification_email"):
        await send_email(to=settings["notification_email"], subject=title, html=payment_email_html(order))
