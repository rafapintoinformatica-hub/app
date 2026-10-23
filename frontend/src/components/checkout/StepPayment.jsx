import { useState } from "react";
import { Wallet, Tag, X, Globe, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { validateCoupon, formatBRL } from "@/lib/api";
import { toast } from "sonner";
import { PluxeeCardForm } from "@/components/checkout/PluxeeCardForm";

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");

const CouponBox = ({ subtotal, coupon, setCoupon }) => {
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);

  const apply = async () => {
    if (!input.trim()) return;
    setChecking(true);
    try {
      const res = await validateCoupon(input.trim(), subtotal);
      if (res.valid) {
        setCoupon({ code: input.trim().toUpperCase(), discount: res.discount });
        toast.success("Cupom aplicado!", { description: `Desconto de ${formatBRL(res.discount)}` });
      } else toast.error(res.message || "Cupom inválido");
    } catch {
      toast.error("Erro ao validar cupom");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-amber-200/60 p-3">
      <Label className="flex items-center gap-1.5 mb-2 text-amber-900"><Tag className="h-3.5 w-3.5" /> Cupom de desconto</Label>
      {coupon ? (
        <div className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2">
          <span className="font-mono font-bold text-emerald-700 text-sm">{coupon.code}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-emerald-600 font-semibold">- {formatBRL(coupon.discount)}</span>
            <button data-testid="remove-coupon-button" onClick={() => { setCoupon(null); setInput(""); }} className="text-emerald-700 hover:text-destructive"><X className="h-4 w-4" /></button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input data-testid="coupon-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite o código" className="uppercase" />
          <Button data-testid="apply-coupon-button" onClick={apply} disabled={checking} variant="outline" className="rounded-lg shrink-0">{checking ? "..." : "Aplicar"}</Button>
        </div>
      )}
    </div>
  );
};

const MethodGroup = ({ title, icon: Icon, methods, payment, setPayment }) =>
  methods.length > 0 && (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {title}</p>
      <div className="grid grid-cols-2 gap-2">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            data-testid={`checkout-payment-${slug(m.name)}`}
            onClick={() => setPayment(m.name)}
            className={`rounded-xl border p-3 text-left font-semibold text-sm text-amber-950 transition-colors ${
              payment === m.name ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-amber-200/60 bg-white hover:border-primary/40"
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );

export const StepPayment = ({ methods, payment, setPayment, subtotal, coupon, setCoupon, change, setChange, notes, setNotes, card, setCard }) => {
  const selected = methods.find((m) => m.name === payment);
  return (
    <div className="space-y-4 animate-float-up">
      <h3 className="font-heading font-bold text-amber-950">3. Cupom & Forma de Pagamento</h3>
      <CouponBox subtotal={subtotal} coupon={coupon} setCoupon={setCoupon} />
      <div className="space-y-4">
        <Label className="flex items-center gap-1.5 text-amber-900"><Wallet className="h-3.5 w-3.5" /> Forma de pagamento</Label>
        <MethodGroup title="Pagar agora (online)" icon={Globe} methods={methods.filter((m) => m.mode === "online" || m.mode === "pluxee")} payment={payment} setPayment={setPayment} />
        <MethodGroup title="Pagar na entrega" icon={Truck} methods={methods.filter((m) => m.mode === "entrega")} payment={payment} setPayment={setPayment} />
        {selected?.mode === "online" && (
          <p className="text-xs text-zinc-600 bg-amber-50 rounded-lg px-3 py-2" data-testid="online-payment-notice">
            Você será levado ao checkout seguro da InfinitePay (Pix ou cartão). Depois de pagar, volte para enviar o pedido no WhatsApp.
          </p>
        )}
        {selected?.mode === "pluxee" && <PluxeeCardForm card={card} setCard={setCard} />}
        {selected?.allows_change && (
          <div className="bg-white rounded-xl border border-amber-200/60 p-3 space-y-3" data-testid="checkout-change-box">
            <div className="flex items-center justify-between">
              <Label htmlFor="need-change">Precisa de troco?</Label>
              <Switch id="need-change" data-testid="checkout-need-change-switch" checked={change.need} onCheckedChange={(v) => setChange({ ...change, need: v })} />
            </div>
            {change.need && (
              <div className="space-y-1.5">
                <Label>Troco para quanto? (R$)</Label>
                <Input data-testid="checkout-change-input" inputMode="decimal" value={change.value} onChange={(e) => setChange({ ...change, value: e.target.value })} placeholder="Ex: 50,00" />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Observações (opcional)</Label>
        <Textarea data-testid="checkout-notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: escrever 'Parabéns' no bolo..." rows={2} />
      </div>
    </div>
  );
};
