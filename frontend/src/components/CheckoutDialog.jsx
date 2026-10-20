import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  CheckCircle2,
  QrCode,
  Wallet,
  MessageCircle,
  CreditCard,
  Ticket,
  CalendarDays,
  Clock,
  Tag,
  X,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { createOrder, validateCoupon, formatBRL, getSettings, waUrl } from "@/lib/api";
import { toast } from "sonner";

const TIME_SLOTS = [
  { id: "manha", label: "Manhã", range: "09h - 12h" },
  { id: "tarde", label: "Tarde", range: "14h - 18h" },
  { id: "noite", label: "Noite", range: "18h - 21h" },
];

const PAYMENT_OPTIONS = [
  { id: "pix", label: "Pix", icon: QrCode },
  { id: "credito", label: "Cartão de Crédito", icon: CreditCard },
  { id: "debito", label: "Cartão de Débito", icon: CreditCard },
  { id: "pluxee", label: "Pluxee Refeição", icon: Ticket },
];

export const CheckoutDialog = ({ open, onOpenChange }) => {
  const { cart, subtotal, clearCart } = useStore();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    address: "",
    neighborhood: "",
    cep: "",
    complement: "",
    notes: "",
  });
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState("manha");
  const [payment, setPayment] = useState("pix");
  const [storePhone, setStorePhone] = useState("");

  useEffect(() => {
    if (open) getSettings().then((st) => setStorePhone(st.store_whatsapp));
  }, [open]);

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState(null); // { code, discount, total }
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const discount = coupon?.discount || 0;
  const total = Math.max(subtotal - discount, 0);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const resetAll = () => {
    setStep(1);
    setConfirmed(null);
    setDate(null);
    setCoupon(null);
    setCouponInput("");
    setPayment("pix");
    setForm({ customer_name: "", customer_phone: "", address: "", neighborhood: "", cep: "", complement: "", notes: "" });
  };

  const close = () => {
    onOpenChange(false);
    if (confirmed) {
      clearCart();
      setTimeout(resetAll, 300);
    }
  };

  const validStep1 = form.customer_name && form.customer_phone && form.address;

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCheckingCoupon(true);
    try {
      const res = await validateCoupon(couponInput.trim(), subtotal);
      if (res.valid) {
        setCoupon({ code: couponInput.trim().toUpperCase(), discount: res.discount, total: res.total });
        toast.success("Cupom aplicado!", { description: `Desconto de ${formatBRL(res.discount)}` });
      } else {
        setCoupon(null);
        toast.error(res.message || "Cupom inválido");
      }
    } catch {
      toast.error("Erro ao validar cupom");
    } finally {
      setCheckingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponInput("");
  };

  const buildPayload = () => ({
    ...form,
    delivery_date: date.toISOString().split("T")[0],
    time_slot: TIME_SLOTS.find((s) => s.id === slot).label,
    items: cart.map((i) => ({ product_id: i.product_id, name: i.name, flavor: i.flavor || null, price: i.price, quantity: i.quantity })),
    payment_method: PAYMENT_OPTIONS.find((p) => p.id === payment).label,
    coupon_code: coupon?.code || null,
  });

  const handleSubmit = async () => {
    if (!date) return toast.error("Escolha a data da entrega");
    setSubmitting(true);
    try {
      const order = await createOrder(buildPayload());
      setConfirmed(order);
      toast.success("Pedido confirmado!");
    } catch (e) {
      toast.error("Erro ao enviar pedido", { description: e?.response?.data?.detail || "Tente novamente" });
    } finally {
      setSubmitting(false);
    }
  };

  const orderMessage = (o) => {
    const lines = o.items.map((i) => `• ${i.quantity}x ${i.name}${i.flavor ? ` (${i.flavor})` : ""} - ${formatBRL(i.price * i.quantity)}`);
    return [
      `Olá! Novo pedido #${o.order_code} - Deliciosas Cucas`,
      "",
      ...lines,
      "",
      o.discount > 0 ? `Desconto (${o.coupon_code}): -${formatBRL(o.discount)}` : null,
      `Total: ${formatBRL(o.total)}`,
      `Pagamento na entrega: ${o.payment_method}`,
      `Entrega: ${new Date(o.delivery_date + "T00:00:00").toLocaleDateString("pt-BR")} - ${o.time_slot}`,
      "",
      `Nome: ${o.customer_name}`,
      `Telefone: ${o.customer_phone}`,
      `Endereço: ${o.address}${o.neighborhood ? `, ${o.neighborhood}` : ""}${o.complement ? ` - ${o.complement}` : ""}${o.cep ? ` - CEP ${o.cep}` : ""}`,
      o.notes ? `Obs: ${o.notes}` : null,
    ].filter((l) => l !== null).join("\n");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-lg bg-[#FFFDF9] p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col" data-testid="checkout-dialog">
        {confirmed ? (
          <div className="p-8 text-center overflow-y-auto" data-testid="order-confirmation">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
              <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto" />
            </motion.div>
            <h2 className="font-heading font-extrabold text-2xl text-amber-950 mt-4">Pedido Confirmado!</h2>
            <p className="text-zinc-600 text-sm mt-1">Seu pedido sob encomenda foi registrado.</p>
            <div className="mt-5 bg-white rounded-xl border border-amber-200/60 p-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Código</span>
                <span data-testid="order-confirmation-code" className="font-mono font-black text-primary text-lg">
                  #{confirmed.order_code}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Entrega</span>
                <span className="font-semibold text-amber-950 text-sm">
                  {new Date(confirmed.delivery_date + "T00:00:00").toLocaleDateString("pt-BR")} · {confirmed.time_slot}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Pagamento</span>
                <span className="font-semibold text-amber-950 text-sm" data-testid="order-confirmation-payment">{confirmed.payment_method} (na entrega)</span>
              </div>
              {confirmed.discount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Desconto</span>
                  <span className="font-semibold text-emerald-600 text-sm">- {formatBRL(confirmed.discount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-amber-100 pt-3">
                <span className="text-sm text-zinc-500">Total</span>
                <span className="font-mono font-black text-amber-950">{formatBRL(confirmed.total)}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 justify-center text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3" data-testid="pay-on-delivery-notice">
              <Wallet className="h-4 w-4 shrink-0" /> O pagamento será feito no momento da entrega.
            </div>
            <a
              data-testid="send-order-whatsapp-button"
              href={waUrl(storePhone, orderMessage(confirmed))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white font-bold transition-colors"
            >
              <MessageCircle className="h-5 w-5" /> Enviar pedido pelo WhatsApp
            </a>
            <p className="text-xs text-zinc-500 mt-2">Toque para enviar os detalhes do pedido à loja e garantir sua encomenda.</p>
            <Button
              data-testid="confirmation-close-button"
              onClick={close}
              variant="outline"
              className="w-full mt-4 h-11 rounded-xl font-bold"
            >
              Voltar à loja
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-3 border-b border-amber-200/60">
              <DialogTitle className="font-heading text-xl text-amber-950">Finalizar Encomenda</DialogTitle>
              <div className="flex gap-1.5 mt-3">
                {[1, 2, 3].map((s) => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-amber-100"}`} />
                ))}
              </div>
            </DialogHeader>

            <div className="overflow-y-auto px-6 py-5 flex-1">
              {step === 1 && (
                <div className="space-y-4 animate-float-up">
                  <h3 className="font-heading font-bold text-amber-950">1. Dados da Entrega</h3>
                  <div className="space-y-1.5">
                    <Label>Nome completo</Label>
                    <Input data-testid="checkout-customer-name-input" value={form.customer_name} onChange={update("customer_name")} placeholder="Ex: Maria Silva" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone (WhatsApp)</Label>
                    <Input data-testid="checkout-customer-phone-input" value={form.customer_phone} onChange={update("customer_phone")} placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Endereço (Rua e Número)</Label>
                    <Input data-testid="checkout-customer-address-input" value={form.address} onChange={update("address")} placeholder="Rua das Flores, 123" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Bairro</Label>
                      <Input data-testid="checkout-neighborhood-input" value={form.neighborhood} onChange={update("neighborhood")} placeholder="Centro" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CEP</Label>
                      <Input data-testid="checkout-cep-input" value={form.cep} onChange={update("cep")} placeholder="00000-000" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Complemento (opcional)</Label>
                    <Input data-testid="checkout-complement-input" value={form.complement} onChange={update("complement")} placeholder="Apto 42, bloco B" />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 animate-float-up">
                  <h3 className="font-heading font-bold text-amber-950 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" /> 2. Agendamento da Entrega
                  </h3>
                  <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                    Cucas e bolos feitos sob encomenda. A entrega começa a partir de amanhã.
                  </p>
                  <div className="flex justify-center bg-white rounded-xl border border-amber-200/60 p-2" data-testid="checkout-delivery-date-calendar">
                    <Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => d < tomorrow} className="rounded-md" />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5 mb-2"><Clock className="h-3.5 w-3.5" /> Faixa de horário</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {TIME_SLOTS.map((s) => (
                        <button
                          key={s.id}
                          data-testid={`time-slot-${s.id}`}
                          onClick={() => setSlot(s.id)}
                          className={`rounded-xl border p-3 text-center transition-all ${
                            slot === s.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-amber-200/60 bg-white hover:border-primary/40"
                          }`}
                        >
                          <p className="font-semibold text-sm text-amber-950">{s.label}</p>
                          <p className="text-[11px] text-zinc-500">{s.range}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-float-up">
                  <h3 className="font-heading font-bold text-amber-950">3. Cupom & Forma de Pagamento</h3>

                  {/* Coupon */}
                  <div className="bg-white rounded-xl border border-amber-200/60 p-3">
                    <Label className="flex items-center gap-1.5 mb-2 text-amber-900"><Tag className="h-3.5 w-3.5" /> Cupom de desconto</Label>
                    {coupon ? (
                      <div className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2">
                        <span className="font-mono font-bold text-emerald-700 text-sm">{coupon.code}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-emerald-600 font-semibold">- {formatBRL(coupon.discount)}</span>
                          <button data-testid="remove-coupon-button" onClick={removeCoupon} className="text-emerald-700 hover:text-destructive">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          data-testid="coupon-input"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          placeholder="Digite o código"
                          className="uppercase"
                        />
                        <Button data-testid="apply-coupon-button" onClick={applyCoupon} disabled={checkingCoupon} variant="outline" className="rounded-lg shrink-0">
                          {checkingCoupon ? "..." : "Aplicar"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="flex items-center gap-1.5 mb-1 text-amber-900"><Wallet className="h-3.5 w-3.5" /> Forma de pagamento</Label>
                    <p className="text-xs text-zinc-500 mb-3">Nada é cobrado agora. Você paga ao receber sua encomenda.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_OPTIONS.map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          data-testid={`checkout-payment-${id}`}
                          onClick={() => setPayment(id)}
                          className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
                            payment === id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-amber-200/60 bg-white hover:border-primary/40"
                          }`}
                        >
                          <Icon className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-sm text-amber-950">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Observações (opcional)</Label>
                    <Textarea data-testid="checkout-notes-input" value={form.notes} onChange={update("notes")} placeholder="Ex: escrever 'Parabéns' no bolo..." rows={2} />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-amber-200/60 bg-white">
              {discount > 0 && (
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="text-zinc-500">Subtotal</span>
                  <span className="font-mono text-zinc-500 line-through">{formatBRL(subtotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-600">Total</span>
                <span className="font-mono font-black text-lg text-amber-950" data-testid="checkout-total">{formatBRL(total)}</span>
              </div>
              <div className="flex gap-3">
                {step > 1 && (
                  <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 rounded-xl" data-testid="checkout-back-button">
                    Voltar
                  </Button>
                )}
                {step < 3 ? (
                  <Button
                    data-testid="checkout-next-button"
                    onClick={() => setStep(step + 1)}
                    disabled={step === 1 && !validStep1}
                    className="flex-1 rounded-xl bg-primary hover:bg-[#C04917] text-white font-bold"
                  >
                    Continuar
                  </Button>
                ) : (
                  <Button
                    data-testid="checkout-submit-order-button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-primary hover:bg-[#C04917] text-white font-bold"
                  >
                    {submitting ? "Enviando..." : "Confirmar Encomenda"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
