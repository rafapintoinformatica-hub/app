import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/api";
import { PAYMENT_METHODS } from "@/lib/payments";

const qtyOf = (o) => o.items.reduce((s, i) => s + i.quantity, 0);

const Stat = ({ label, value, testid }) => (
  <div className="bg-white rounded-2xl border border-amber-200/60 p-5 shadow-sm">
    <p className="text-xs uppercase tracking-wider text-amber-600 font-bold">{label}</p>
    <p data-testid={testid} className="font-mono font-black text-2xl text-amber-950 mt-1">{value}</p>
  </div>
);

const Table = ({ title, head, rows, testid }) => (
  <div className="bg-white rounded-2xl border border-amber-200/60 p-5 shadow-sm overflow-x-auto" data-testid={testid}>
    <h3 className="font-heading font-bold text-amber-950 mb-3">{title}</h3>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-zinc-500 border-b border-amber-100">
          {head.map((h, i) => <th key={h} className={`py-2 font-semibold ${i ? "text-right" : ""}`}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={head.length} className="py-4 text-center text-zinc-400">Sem dados no período</td></tr>}
        {rows.map((r) => (
          <tr key={r[0]} className="border-b border-amber-50 last:border-0">
            {r.map((c, i) => <td key={i} className={`py-2 ${i ? "text-right font-mono" : "font-semibold text-amber-950"}`}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const AdminReports = ({ orders }) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () => orders.filter((o) => (!from || o.delivery_date >= from) && (!to || o.delivery_date <= to)),
    [orders, from, to]
  );

  const byDay = useMemo(() => {
    const m = {};
    filtered.forEach((o) => {
      const d = (m[o.delivery_date] ||= { orders: 0, qty: 0, total: 0 });
      d.orders += 1; d.qty += qtyOf(o); d.total += o.total;
    });
    return Object.entries(m).sort(([a], [b]) => b.localeCompare(a))
      .map(([day, d]) => [new Date(day + "T00:00:00").toLocaleDateString("pt-BR"), d.orders, d.qty, formatBRL(d.total)]);
  }, [filtered]);

  const byPayment = useMemo(() => {
    const m = {};
    filtered.forEach((o) => {
      const d = (m[o.payment_method] ||= { orders: 0, qty: 0, total: 0 });
      d.orders += 1; d.qty += qtyOf(o); d.total += o.total;
    });
    const keys = [...PAYMENT_METHODS, ...Object.keys(m).filter((k) => !PAYMENT_METHODS.includes(k))];
    return keys.filter((k) => m[k]).map((k) => [k, m[k].orders, m[k].qty, formatBRL(m[k].total)]);
  }, [filtered]);

  const total = filtered.reduce((s, o) => s + o.total, 0);
  const qty = filtered.reduce((s, o) => s + qtyOf(o), 0);
  const head = ["", "Pedidos", "Produtos", "Valor"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label>De (entrega)</Label><Input data-testid="reports-from-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" /></div>
        <div className="space-y-1"><Label>Até (entrega)</Label><Input data-testid="reports-to-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Pedidos" value={filtered.length} testid="reports-total-orders" />
        <Stat label="Produtos vendidos" value={qty} testid="reports-total-products" />
        <Stat label="Valor total" value={formatBRL(total)} testid="reports-total-value" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Table title="Vendas por forma de pagamento" head={["Forma", ...head.slice(1)]} rows={byPayment} testid="reports-by-payment" />
        <Table title="Vendas por dia de entrega" head={["Dia", ...head.slice(1)]} rows={byDay} testid="reports-by-day" />
      </div>
    </div>
  );
};
