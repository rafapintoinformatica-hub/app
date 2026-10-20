# Deliciosas Cucas — PRD

## Original problem
App de venda sob encomenda (cucas e bolos) com entrega agendada. Cliente escolhe produto, sabor, quantidade, dia/horário da entrega e forma de pagamento (pago NA ENTREGA): Pix, Crédito, Débito ou Pluxee Refeição.

## Architecture
FastAPI + MongoDB (backend/server.py), React (frontend/src). Admin password via ADMIN_PASSWORD (.env).

## Implemented
- Loja com categorias, busca, seleção de sabor + quantidade por produto, carrinho por sabor
- Checkout 3 etapas: dados, agendamento (data a partir de amanhã + faixa horária), cupom + forma de pagamento na entrega
- Confirmação com botão "Enviar pedido pelo WhatsApp" (wa.me para loja 5541989023769, configurável)
- Admin: pedidos (status incl. "Entregue e Pago" e "Entregue - Aguardando Pagamento" → abre cobrança no WhatsApp do cliente com chave Pix), cardápio (sabores), cupons com limite de uso, Configurações (WhatsApp da loja + chave Pix)
- Jun/2026: Stripe/pagamento online REMOVIDO; sabores, pagamento na entrega, cobrança via WhatsApp adicionados (iteration_2: 100%)

## Backlog
- P1: Usuário cadastrar chave Pix em Configurações
- P2: Envio automático via WhatsApp API (Twilio), relatório financeiro de valores a receber
