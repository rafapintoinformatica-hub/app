import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateOrderPayment } from "@/lib/api";
import { changeLabel } from "@/lib/payments";
import { useStore } from "@/context/StoreContext";
import { toast } from "sonner";

export const OrderPaymentEditor = ({ order, onUpdated }) => {
  const { config } = useStore();
  const allowsChange = (name) => config.payment_methods.find((m) => m.name === name)?.allows_change;
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState(order.payment_method);
  const [change, setChange] = useState(order.change_for || "");
  const code = order.order_code;

  const save = async () => {
    try {
      const updated = await updateOrderPayment(order.id, {
        payment_method: method,
        change_for: allowsChange(method) && change ? parseFloat(String(change).replace(",", ".")) : null,
      });
      onUpdated(updated);
      setEditing(false);
      toast.success("Forma de pagamento atualizada");
    } catch {
      toast.error("Erro ao atualizar pagamento");
    }
  };

  if (!editing) {
    const troco = changeLabel(order);
    return (
      <button data-testid={`admin-order-payment-${code}`} onClick={() => setEditing(true)} className="text-xs text-zinc-500 hover:text-primary flex items-center gap-1 text-left">
        {order.payment_method}{troco ? ` (${troco})` : ""} · na entrega <Pencil className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-1">
      <Select value={method} onValueChange={setMethod}>
        <SelectTrigger className="h-8 w-40 text-xs" data-testid={`admin-order-payment-select-${code}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {config.payment_methods.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {allowsChange(method) && (
        <Input data-testid={`admin-order-change-input-${code}`} value={change} onChange={(e) => setChange(e.target.value)} placeholder="Troco p/ R$" className="h-8 w-24 text-xs" />
      )}
      <Button data-testid={`admin-order-payment-save-${code}`} size="icon" className="h-8 w-8 bg-primary text-white" onClick={save}><Check className="h-4 w-4" /></Button>
      <Button data-testid={`admin-order-payment-cancel-${code}`} size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
    </div>
  );
};
