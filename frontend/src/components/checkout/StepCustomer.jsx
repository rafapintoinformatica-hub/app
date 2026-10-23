import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const StepCustomer = ({ form, setForm, places }) => {
  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const place = places.find((p) => p.name === form.address);

  return (
    <div className="space-y-4 animate-float-up">
      <h3 className="font-heading font-bold text-amber-950">1. Dados da Entrega</h3>
      <div className="space-y-1.5">
        <Label>Nome completo</Label>
        <Input data-testid="checkout-customer-name-input" value={form.customer_name} onChange={update("customer_name")} placeholder="Ex: Maria Silva" />
      </div>
      <div className="space-y-1.5">
        <Label>Telefone (WhatsApp)</Label>
        <Input data-testid="checkout-customer-phone-input" value={form.customer_phone} onChange={update("customer_phone")} placeholder="(41) 99999-9999" />
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Local de entrega</Label>
        <div className="grid grid-cols-2 gap-2">
          {places.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`checkout-place-${p.name.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => setForm((f) => (f.address === p.name ? f : { ...f, address: p.name, details: p.fields.map(() => "") }))}
              className={`rounded-xl border p-4 text-center font-semibold text-sm text-amber-950 transition-colors ${
                form.address === p.name ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-amber-200/60 bg-white hover:border-primary/40"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      {place && place.fields.length > 0 && (
        <div className="grid grid-cols-2 gap-3 animate-float-up" data-testid="checkout-place-details">
          {place.fields.map((f, idx) => (
            <div key={f.label} className="space-y-1.5">
              <Label>{f.label}</Label>
              <Input
                data-testid={`checkout-place-detail-${idx + 1}`}
                value={form.details[idx] || ""}
                placeholder={f.placeholder}
                onChange={(e) => setForm((s) => ({ ...s, details: s.details.map((d, i) => (i === idx ? e.target.value : d)) }))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
