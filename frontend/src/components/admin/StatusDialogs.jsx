import { useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/api";

const paidOnline = (o) => o.payment_status === "Pago" && ["online", "pluxee"].includes(o.payment_mode);

export const StatusChangeDialog = ({ pending, onCancel, onConfirm }) => {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  if (!pending) return null;
  const { order, status } = pending;
  const refund = status.is_cancel && paidOnline(order);

  const confirm = async () => {
    setSaving(true);
    await onConfirm(order, status, note);
    setSaving(false);
    setNote("");
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md bg-[#FFFDF9]" data-testid="status-change-dialog">
        <DialogHeader><DialogTitle className="font-heading text-amber-950">Mudar #{order.order_code} para "{status.name}"</DialogTitle></DialogHeader>
        {refund && (
          <div className="flex gap-2 text-sm bg-red-50 text-red-800 rounded-lg p-3" data-testid="status-refund-warning">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Este pedido foi pago online ({order.payment_method}, {formatBRL(order.total)}).{" "}
              {order.payment_mode === "pluxee" ? "O estorno no Pluxee será feito automaticamente." : "Em seguida você será direcionado para fazer o estorno na InfinitePay."}
            </span>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Justificativa {status.requires_note ? "(obrigatória)" : "(opcional)"}</Label>
          <Textarea data-testid="status-note-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: cliente pediu para cancelar" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Voltar</Button>
          <Button data-testid="status-change-confirm" disabled={saving || (status.requires_note && !note.trim())} onClick={confirm} className="bg-primary hover:bg-[#C04917] text-white">
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const RefundDialog = ({ order, onClose, onRefunded }) => {
  if (!order) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#FFFDF9]" data-testid="refund-dialog">
        <DialogHeader><DialogTitle className="font-heading text-amber-950">Fazer estorno — #{order.order_code}</DialogTitle></DialogHeader>
        <div className="text-sm text-zinc-700 space-y-2">
          <p>Valor: <strong>{formatBRL(order.total)}</strong> · {order.payment_method}</p>
          {order.transaction_nsu && <p>Transação (NSU): <span className="font-mono text-xs">{order.transaction_nsu}</span></p>}
          <ol className="list-decimal pl-5 space-y-1">
            <li>Abra o app ou o site da InfinitePay.</li>
            <li>Vá em <strong>Vendas / Extrato</strong> e encontre a venda acima (use o comprovante abaixo).</li>
            <li>Toque em <strong>Estornar</strong> e confirme o valor total.</li>
            <li>Volte aqui e clique em "Já fiz o estorno".</li>
          </ol>
        </div>
        <div className="flex flex-wrap gap-2">
          <a data-testid="refund-open-infinitepay" href="https://app.infinitepay.io" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-primary rounded-lg px-3 py-2">
            Abrir InfinitePay <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {order.receipt_url && (
            <a href={order.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold border rounded-lg px-3 py-2">
              Ver comprovante <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fazer depois</Button>
          <Button data-testid="refund-done-button" onClick={() => onRefunded(order)} className="bg-emerald-600 hover:bg-emerald-700 text-white">Já fiz o estorno</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
