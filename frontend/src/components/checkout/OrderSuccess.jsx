import { motion } from "framer-motion";
import { CheckCircle2, MessageCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/api";

const Row = ({ label, children, testid }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-zinc-500">{label}</span>
    <span data-testid={testid} className="font-semibold text-amber-950 text-sm text-right">{children}</span>
  </div>
);

export const OrderSuccess = ({ order, waHref, sent, onSent, onClose }) => {
  const paid = order.payment_status === "Pago";
  return (
    <div className="p-8 text-center overflow-y-auto" data-testid="order-confirmation">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
        <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto" />
      </motion.div>
      <h2 className="font-heading font-extrabold text-2xl text-amber-950 mt-4">{paid ? "Pagamento aprovado!" : "Pedido registrado!"}</h2>
      <p className="text-zinc-600 text-sm mt-1" data-testid="whatsapp-required-notice">
        Seu pedido só é confirmado após ser <strong>enviado no WhatsApp</strong> da loja. Abrimos o WhatsApp com a mensagem pronta — é só tocar em enviar.
      </p>
      <div className="mt-5 bg-white rounded-xl border border-amber-200/60 p-5 text-left space-y-3">
        <Row label="Código"><span data-testid="order-confirmation-code" className="font-mono font-black text-primary text-lg">#{order.order_code}</span></Row>
        <Row label="Entrega">{new Date(order.delivery_date + "T00:00:00").toLocaleDateString("pt-BR")}</Row>
        <Row label="Local">{order.address}</Row>
        <Row label="Pagamento" testid="order-confirmation-payment">
          {order.payment_method} {paid ? "(PAGO)" : order.payment_mode === "online" ? "(aguardando)" : "(na entrega)"}
        </Row>
        {order.discount > 0 && <Row label="Desconto"><span className="text-emerald-600">- {formatBRL(order.discount)}</span></Row>}
        <div className="border-t border-amber-100 pt-3"><Row label="Total"><span className="font-mono font-black">{formatBRL(order.total)}</span></Row></div>
      </div>
      {!paid && order.payment_mode !== "online" && (
        <div className="mt-4 flex items-center gap-2 justify-center text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3" data-testid="pay-on-delivery-notice">
          <Wallet className="h-4 w-4 shrink-0" /> O pagamento será feito no momento da entrega.
        </div>
      )}
      <a
        data-testid="send-order-whatsapp-button"
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onSent}
        className="mt-6 flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white font-bold transition-colors"
      >
        <MessageCircle className="h-5 w-5" /> {sent ? "Abrir WhatsApp novamente" : "Enviar pedido pelo WhatsApp"}
      </a>
      <p className="text-xs text-zinc-500 mt-2">Se o WhatsApp não abriu, toque no botão acima.</p>
      <Button data-testid="confirmation-close-button" onClick={onClose} disabled={!sent} variant="outline" className="w-full mt-4 h-11 rounded-xl font-bold">
        Voltar à loja
      </Button>
    </div>
  );
};
