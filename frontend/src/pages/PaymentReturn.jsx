import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/StoreContext";
import { confirmInfinitePay, getPublicOrder, waUrl } from "@/lib/api";
import { orderMessage } from "@/lib/messages";
import { OrderSuccess } from "@/components/checkout/OrderSuccess";
import { PENDING_ORDER_KEY } from "@/components/CheckoutDialog";

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { site, clearCart } = useStore();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    const orderId = params.get("order_nsu") || localStorage.getItem(PENDING_ORDER_KEY);
    if (!orderId) return setError(true);
    const tx = params.get("transaction_nsu");
    const slug = params.get("slug");
    const req = tx && slug
      ? confirmInfinitePay({ order_id: orderId, transaction_nsu: tx, slug, receipt_url: params.get("receipt_url") })
      : getPublicOrder(orderId);
    req.then((o) => {
      setOrder(o);
      if (o.payment_status === "Pago") {
        clearCart();
        localStorage.removeItem(PENDING_ORDER_KEY);
      }
    }).catch(() => setError(true));
  }, []);

  const href = order && site ? waUrl(site.store_whatsapp, orderMessage(order, site.store_name)) : "#";

  useEffect(() => {
    if (order?.payment_status === "Pago" && site && !redirected.current && !sessionStorage.getItem(`wa_${order.id}`)) {
      redirected.current = true;
      sessionStorage.setItem(`wa_${order.id}`, "1");
      setSent(true);
      setTimeout(() => (window.location.href = href), 1500);
    }
  }, [order, site]);

  if (error)
    return (
      <div className="min-h-screen grid place-items-center bg-[#FFFDF9] p-6 text-center" data-testid="payment-return-error">
        <div>
          <XCircle className="h-14 w-14 text-red-500 mx-auto" />
          <p className="font-heading font-bold text-xl text-amber-950 mt-3">Não encontramos seu pedido</p>
          <Button className="mt-5" onClick={() => navigate("/")}>Voltar à loja</Button>
        </div>
      </div>
    );

  if (!order)
    return (
      <div className="min-h-screen grid place-items-center bg-[#FFFDF9]" data-testid="payment-return-loading">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );

  if (order.payment_status !== "Pago")
    return (
      <div className="min-h-screen grid place-items-center bg-[#FFFDF9] p-6 text-center" data-testid="payment-return-pending">
        <div className="max-w-sm">
          <XCircle className="h-14 w-14 text-amber-500 mx-auto" />
          <p className="font-heading font-bold text-xl text-amber-950 mt-3">Pagamento ainda não confirmado</p>
          <p className="text-sm text-zinc-600 mt-2">Se você já pagou, aguarde alguns segundos e atualize. Caso contrário, finalize o pagamento.</p>
          {order.checkout_url && (
            <Button data-testid="payment-retry-button" className="mt-5 w-full bg-primary text-white" onClick={() => (window.location.href = order.checkout_url)}>
              Ir para o pagamento
            </Button>
          )}
          <Button variant="outline" className="mt-3 w-full" onClick={() => window.location.reload()}>Atualizar</Button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen grid place-items-center bg-[#FFFDF9] p-4">
      <div className="max-w-lg w-full bg-[#FFFDF9] rounded-2xl border border-amber-200/60 shadow-xl">
        <OrderSuccess order={order} waHref={href} sent={sent} onSent={() => setSent(true)} onClose={() => navigate("/")} />
      </div>
    </div>
  );
}
