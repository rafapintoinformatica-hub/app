# PRD — Dona Lanche (Venda de Lanches Sob Encomenda)

## Problema original
App de venda de lanches com pagamento online via Pix, cartão de crédito/débito e vale/Pluxee refeição. Itens com entrega agendada — o cliente escolhe o dia da entrega (venda sob encomenda).

## Escolhas do usuário
- Pagamentos SIMULADOS (sem gateway real)
- Sem login de cliente (checkout com nome, telefone, endereço)
- Painel admin para gerenciar cardápio e pedidos
- Agendamento: cliente escolhe apenas a DATA (+ faixa de horário)
- Imagens bonitas de lanches, UI em pt-BR

## Arquitetura
- Backend: FastAPI + MongoDB (motor). IDs uuid. Endpoints: /api/products (CRUD), /api/orders (POST/GET), /api/orders/{id}/status (PATCH), /api/admin/login (POST). Seed de 8 produtos no startup.
- Frontend: React 19 + Vite + Tailwind v4 + shadcn/ui + framer-motion + sonner. Rotas: `/` (loja), `/admin`. Carrinho/data persistidos em localStorage via StoreContext.
- Design: "Organic Warm Gourmet" — creme quente + terracota, fontes Plus Jakarta Sans / DM Sans / JetBrains Mono.

## Implementado (2026-06)
- Catálogo com 8 lanches, filtro por categoria e busca
- Carrinho (drawer) com steppers +/- e remoção, subtotal
- Checkout em 3 passos: dados de entrega → agendamento (calendário + horário) → pagamento (Pix/Crédito/Débito/Vale) → confirmação com código #ENC-xxxx
- Painel admin protegido por senha (lanche123): aba Encomendas (ver pedidos + mudar status) e Cardápio (criar/editar/excluir lanches)
- Testado end-to-end (iteration_1): 100% backend e frontend

## Credenciais
- Admin: senha `lanche123` (backend/.env ADMIN_PASSWORD)

## Backlog (P1/P2)
- Pagamento real (Stripe/Mercado Pago) quando o usuário quiser cobrar de verdade
- Notificação WhatsApp automática de status do pedido
- Cálculo de taxa de entrega por bairro/CEP
- Cupons de desconto
- Quantidade mínima para combos de festa
