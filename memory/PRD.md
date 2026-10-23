# Deliciosas Cucas — PRD

## Original problem
App de venda sob encomenda (cucas e bolos) com entrega agendada. Cliente escolhe produto, sabor, quantidade, dia/horário da entrega e forma de pagamento (pago NA ENTREGA): Pix, Crédito, Débito ou Pluxee Refeição.

## Architecture
FastAPI + MongoDB (backend/server.py), React (frontend/src). Admin password via ADMIN_PASSWORD (.env).

## Implemented
- Loja com categorias, busca, seleção de sabor + quantidade por produto, carrinho por sabor
- Checkout 3 etapas: dados (nome, WhatsApp, local de entrega: Amil ou Green Park — sem endereço), dia da entrega (somente data, a partir de amanhã; sem horário), cupom + forma de pagamento na entrega
- Confirmação com botão "Enviar pedido pelo WhatsApp" (wa.me para loja 5541989023769, configurável)
- Admin: pedidos (status incl. "Entregue e Pago" e "Entregue - Aguardando Pagamento" → abre cobrança no WhatsApp do cliente com chave Pix), cardápio (sabores), cupons com limite de uso, Configurações (WhatsApp da loja + chave Pix)
- Jun/2026: Stripe/pagamento online REMOVIDO; sabores, pagamento na entrega, cobrança via WhatsApp adicionados (iteration_2: 100%)

## Backlog
- P1: Usuário cadastrar chave Pix em Configurações
- P2: Envio automático via WhatsApp API (Twilio), relatório financeiro de valores a receber

## Update (Jun/2026 — iteration_4: 98.5% backend, 100% frontend)
- Online payment: InfinitePay checkout (Pix + cartão), handle in settings (rafael-gomes-23d). Webhook /api/infinitepay/webhook + return page /pagamento/retorno (confirm via payment_check)
- Configurable in Admin → Configurações: Loja (name, texts, hero image, footer, WhatsApp, Pix, InfiniteTag, notification e-mail), Status (flags: inicial, marca pago, envia cobrança), Formas de pagamento (entrega/online, troco, ativo), Locais (custom fields), Categorias, Notificações & Senha
- Admin auth: bcrypt + JWT bearer (7 days); brute-force lockout
- Payment approved -> e-mail (Emergent managed email) + Web Push (VAPID, /sw.js, manifest PWA)
- Pluxee online: PENDING — user will request credentials from Pluxee (3003-5083); API M-PAL (OAuth2)
- Files: backend/notify.py, backend/infinitepay.py, frontend/src/components/admin/*, components/checkout/*, pages/PaymentReturn.jsx, lib/messages.js
## Backlog
- P0: Pluxee online when credentials arrive
- P2: order list filters by status/place; production agenda per day
