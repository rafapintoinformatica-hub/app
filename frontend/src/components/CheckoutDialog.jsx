import { useEffect, useState } from "react";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useStore } from "@/context/StoreContext";
import { createOrder, formatBRL, waUrl } from "@/lib/api";
import { orderMessage } from "@/lib/messages";
import { StepCustomer } from "@/components/checkout/StepCustomer";
import { StepPayment } from "@/components/checkout/StepPayment";
import { OrderSuccess } from "@/components/checkout/OrderSuccess";
import { toast } from "sonner";

const emptyForm = { customer_name: "", customer_phone: "", address: "", details: [] };
export const PENDING_ORDER_KEY = "pending_online_order";

export const CheckoutDialog = ({ open, onOpenChange }) => {
  const { cart, subtotal, clearCart, site, config } = useStore();
  const methods = config.payment_methods.filter((m) => m.active);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [date, setDate] = useState(null);
  const [payment, setPayment] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [change, setChange] = useState({ need: false, value: "" });
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!payment && methods.length) setPayment(methods[0].name);
  }, [methods, payment]);

  const place = config.places.find((p) => p.name === form.address);
  const method = methods.find((m) => m.name === payment);
  const discount = coupon?.discount || 0;
  const total = Math.max(subtotal - discount, 0);
  const changeValue = parseFloat(String(change.value).replace(",", "."));
  const storeName = site?.store_name || "";

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const validStep1 =
    form.customer_name.trim() && form.customer_phone.trim() && place && place.fields.every((_, i) => (form.details[i] || "").trim());

  const resetAll = () => {
    setStep(1);
    setConfirmed(null);
    setSent(false);
    setDate(null);
    setCoupon(null);
    setChange({ need: false, value: "" });
    setNotes("");
    setForm(emptyForm);
  };

  const close = () => {
    if (confirmed && !sent) return toast.error("Envie o pedido pelo WhatsApp para concluir");
    onOpenChange(false);
    if (confirmed) {
      clearCart();
      setTimeout(resetAll, 300);
    }
  };

  const buildPayload = () => ({
    customer_name: form.customer_name.trim(),
    customer_phone: form.customer_phone.trim(),
    address: place.name,
    complement: place.fields.map((f, i) => `${f.label}: ${form.details[i].trim()}`).join(" · "),
    notes,
    delivery_date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    items: cart.map((i) => ({ product_id: i.product_id, name: i.name, flavor: i.flavor || null, price: i.price, quantity: i.quantity })),
    payment_method: payment,
    change_for: method?.allows_change && change.need ? changeValue : null,
    coupon_code: coupon?.code || null,
    origin_url: window.location.origin,
  });

  const handleSubmit = async () => {
    if (!date) return toast.error("Escolha a data da entrega");
    if (!method) return toast.error("Escolha a forma de pagamento");
    if (method.allows_change && change.need && !(changeValue >= total))
      return toast.error("Informe um valor de troco maior ou igual ao total");
    setSubmitting(true);
    const online = method.mode === "online";
    const win = online ? null : window.open("", "_blank");
    try {
      const order = await createOrder(buildPayload());
      if (online) {
        localStorage.setItem(PENDING_ORDER_KEY, order.id);
        window.location.href = order.checkout_url;
        return;
      }
      setConfirmed(order);
      const url = waUrl(site.store_whatsapp, orderMessage(order, storeName));
      if (win) win.location.href = url;
      else window.location.href = url;
      setSent(true);
    } catch (e) {
      if (win) win.close();
      toast.error("Erro ao enviar pedido", { description: e?.response?.data?.detail || "Tente novamente" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-lg bg-[#FFFDF9] p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col" data-testid="checkout-dialog">
        {confirmed ? (
          <OrderSuccess order={confirmed} waHref={waUrl(site?.store_whatsapp, orderMessage(confirmed, storeName))} sent={sent} onSent={() => setSent(true)} onClose={close} />
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
              {step === 1 && <StepCustomer form={form} setForm={setForm} places={config.places} />}
              {step === 2 && (
                <div className="space-y-4 animate-float-up">
                  <h3 className="font-heading font-bold text-amber-950 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> 2. Dia da Entrega</h3>
                  <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">Feito sob encomenda. A entrega começa a partir de amanhã.</p>
                  <div className="flex justify-center bg-white rounded-xl border border-amber-200/60 p-2" data-testid="checkout-delivery-date-calendar">
                    <Calendar locale={ptBR} mode="single" selected={date} onSelect={setDate} disabled={(d) => d < tomorrow} className="rounded-md" />
                  </div>
                </div>
              )}
              {step === 3 && (
                <StepPayment methods={methods} payment={payment} setPayment={setPayment} subtotal={subtotal} coupon={coupon} setCoupon={setCoupon}
                  change={change} setChange={setChange} notes={notes} setNotes={setNotes} />
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
                {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 rounded-xl" data-testid="checkout-back-button">Voltar</Button>}
                {step < 3 ? (
                  <Button data-testid="checkout-next-button" onClick={() => setStep(step + 1)} disabled={(step === 1 && !validStep1) || (step === 2 && !date)}
                    className="flex-1 rounded-xl bg-primary hover:bg-[#C04917] text-white font-bold">Continuar</Button>
                ) : (
                  <Button data-testid="checkout-submit-order-button" onClick={handleSubmit} disabled={submitting} className="flex-1 rounded-xl bg-primary hover:bg-[#C04917] text-white font-bold">
                    {submitting ? "Enviando..." : method?.mode === "online" ? "Ir para pagamento" : "Confirmar Encomenda"}
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
