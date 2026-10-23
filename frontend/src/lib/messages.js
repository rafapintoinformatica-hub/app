import { formatBRL } from "@/lib/api";

export const STATUS_COLORS = {
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  purple: "bg-purple-100 text-purple-800",
  orange: "bg-orange-100 text-orange-800",
  emerald: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-800",
  zinc: "bg-zinc-200 text-zinc-800",
  pink: "bg-pink-100 text-pink-800",
};

export const COLOR_NAMES = {
  amber: "Amarelo", blue: "Azul", purple: "Roxo", orange: "Laranja",
  emerald: "Verde", red: "Vermelho", zinc: "Cinza", pink: "Rosa",
};

const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
const itemLine = (i) => `• ${i.quantity}x ${i.name}${i.flavor ? ` (${i.flavor})` : ""} - ${formatBRL(i.price * i.quantity)}`;

export const paymentLine = (o) => {
  if (o.payment_status === "Pago") return `${o.payment_method} - PAGO ✅`;
  const troco = o.change_for ? ` (troco para ${formatBRL(o.change_for)})` : o.payment_method === "Dinheiro" ? " (sem troco)" : "";
  return o.payment_mode === "online" ? `${o.payment_method} - aguardando pagamento online` : `${o.payment_method} na entrega${troco}`;
};

export const orderMessage = (o, storeName) =>
  [
    `Olá! Novo pedido #${o.order_code} - ${storeName}`,
    "",
    ...o.items.map(itemLine),
    "",
    o.discount > 0 ? `Desconto (${o.coupon_code}): -${formatBRL(o.discount)}` : null,
    `Total: ${formatBRL(o.total)}`,
    `Pagamento: ${paymentLine(o)}`,
    `Entrega: ${fmtDate(o.delivery_date)}`,
    "",
    `Nome: ${o.customer_name}`,
    `Telefone: ${o.customer_phone}`,
    `Local de entrega: ${o.address}${o.complement ? ` - ${o.complement}` : ""}`,
    o.notes ? `Obs: ${o.notes}` : null,
  ].filter((l) => l !== null).join("\n");

export const chargeMessage = (o, pixKey, storeName) =>
  [
    `Olá ${o.customer_name}! Aqui é da ${storeName}.`,
    `Seu pedido #${o.order_code} foi entregue. Segue a cobrança:`,
    "",
    ...o.items.map(itemLine),
    "",
    `Valor a pagar: ${formatBRL(o.total)} (${o.payment_method})`,
    pixKey ? `Chave Pix: ${pixKey}` : null,
    "",
    "Assim que pagar, envie o comprovante por aqui. Obrigado!",
  ].filter((l) => l !== null).join("\n");

export const statusMessage = (o, storeName) =>
  `Olá ${o.customer_name}! Aqui é da ${storeName}. Seu pedido #${o.order_code} (entrega ${fmtDate(o.delivery_date)}) está com o status: ${o.status}.`;
