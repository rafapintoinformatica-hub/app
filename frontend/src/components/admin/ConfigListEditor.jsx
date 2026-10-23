import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getConfig, createConfig, updateConfig, deleteConfig } from "@/lib/api";
import { STATUS_COLORS, COLOR_NAMES } from "@/lib/messages";
import { useStore } from "@/context/StoreContext";
import { toast } from "sonner";

const SCHEMAS = {
  statuses: {
    title: "Status dos pedidos",
    empty: { name: "", color: "amber", is_initial: false, marks_paid: false, sends_charge: false },
    fields: [
      { key: "name", label: "Nome do status", type: "text" },
      { key: "color", label: "Cor", type: "select", options: Object.entries(COLOR_NAMES) },
      { key: "is_initial", label: "Status inicial de todo pedido novo", type: "switch" },
      { key: "marks_paid", label: "Marca o pedido como PAGO", type: "switch" },
      { key: "sends_charge", label: "Envia cobrança no WhatsApp do cliente", type: "switch" },
    ],
    tags: (i) => [i.is_initial && "Inicial", i.marks_paid && "Marca pago", i.sends_charge && "Envia cobrança"],
  },
  payment_methods: {
    title: "Formas de pagamento",
    empty: { name: "", mode: "entrega", allows_change: false, active: true },
    fields: [
      { key: "name", label: "Nome", type: "text" },
      { key: "mode", label: "Tipo", type: "select", options: [["entrega", "Pago na entrega"], ["online", "Online (InfinitePay: Pix e cartão)"]] },
      { key: "allows_change", label: "Pergunta se precisa de troco (dinheiro)", type: "switch" },
      { key: "active", label: "Ativo na loja", type: "switch" },
    ],
    tags: (i) => [i.mode === "online" ? "Online" : "Na entrega", i.allows_change && "Troco", !i.active && "Inativo"],
  },
  places: {
    title: "Locais de entrega",
    empty: { name: "", fields: [{ label: "", placeholder: "" }] },
    fields: [
      { key: "name", label: "Nome do local", type: "text" },
      { key: "fields", label: "Informações que o cliente deve preencher", type: "placefields" },
    ],
    tags: (i) => i.fields.map((f) => f.label),
  },
  categories: {
    title: "Categorias do cardápio",
    empty: { name: "" },
    fields: [{ key: "name", label: "Nome da categoria", type: "text" }],
    tags: () => [],
  },
};

const PlaceFields = ({ value, onChange }) => (
  <div className="space-y-2">
    {value.map((f, idx) => (
      <div key={idx} className="flex gap-2">
        <Input data-testid={`place-field-label-${idx}`} value={f.label} placeholder="Ex: Bloco" onChange={(e) => onChange(value.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))} />
        <Input data-testid={`place-field-placeholder-${idx}`} value={f.placeholder} placeholder="Exemplo p/ cliente" onChange={(e) => onChange(value.map((x, i) => (i === idx ? { ...x, placeholder: e.target.value } : x)))} />
        <Button type="button" size="icon" variant="outline" onClick={() => onChange(value.filter((_, i) => i !== idx))}><X className="h-4 w-4" /></Button>
      </div>
    ))}
    <Button data-testid="place-field-add" type="button" size="sm" variant="outline" onClick={() => onChange([...value, { label: "", placeholder: "" }])}>
      <Plus className="h-3.5 w-3.5 mr-1" /> Campo
    </Button>
  </div>
);

const FieldInput = ({ field, value, onChange }) => {
  if (field.type === "switch")
    return (
      <div className="flex items-center justify-between bg-white rounded-lg border border-amber-200/60 px-3 py-2.5">
        <Label>{field.label}</Label>
        <Switch data-testid={`config-field-${field.key}`} checked={!!value} onCheckedChange={onChange} />
      </div>
    );
  return (
    <div className="space-y-1.5">
      <Label>{field.label}</Label>
      {field.type === "text" && <Input data-testid={`config-field-${field.key}`} value={value} onChange={(e) => onChange(e.target.value)} />}
      {field.type === "select" && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger data-testid={`config-field-${field.key}`}><SelectValue /></SelectTrigger>
          <SelectContent>{field.options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {field.type === "placefields" && <PlaceFields value={value} onChange={onChange} />}
    </div>
  );
};

export const ConfigListEditor = ({ kind }) => {
  const schema = SCHEMAS[kind];
  const { reloadSite } = useStore();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => getConfig(kind).then(setItems);
  useEffect(() => {
    load();
  }, [kind]);

  const save = async () => {
    const { id, ...data } = editing;
    if (!data.name?.trim()) return toast.error("Informe o nome");
    if (kind === "places") data.fields = data.fields.filter((f) => f.label.trim());
    try {
      if (id) await updateConfig(kind, id, data);
      else await createConfig(kind, { ...data, position: items.length });
      toast.success("Salvo");
      setEditing(null);
      load();
      reloadSite();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao salvar");
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    try {
      await deleteConfig(kind, item.id);
      toast.success("Excluído");
      load();
      reloadSite();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao excluir");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-amber-200/60 p-5 shadow-sm" data-testid={`config-list-${kind}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-bold text-amber-950">{schema.title}</h3>
        <Button data-testid={`config-add-${kind}`} size="sm" onClick={() => setEditing({ ...schema.empty })} className="rounded-full bg-primary hover:bg-[#C04917] text-white">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} data-testid={`config-item-${kind}-${it.name}`} className="flex items-center justify-between gap-2 border border-amber-100 rounded-xl px-3 py-2.5">
            <div className="min-w-0">
              <span className={`text-sm font-semibold ${kind === "statuses" ? `px-2 py-0.5 rounded-full ${STATUS_COLORS[it.color]}` : "text-amber-950"}`}>{it.name}</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {schema.tags(it).filter(Boolean).map((t) => <span key={t} className="text-[11px] bg-amber-50 text-amber-800 rounded px-1.5 py-0.5">{t}</span>)}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button data-testid={`config-edit-${kind}-${it.name}`} size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditing({ ...it })}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button data-testid={`config-delete-${kind}-${it.name}`} size="icon" variant="outline" className="h-8 w-8 text-destructive" onClick={() => remove(it)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md bg-[#FFFDF9]">
          <DialogHeader><DialogTitle className="font-heading text-amber-950">{editing?.id ? "Editar" : "Adicionar"} — {schema.title}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              {schema.fields.map((f) => (
                <FieldInput key={f.key} field={f} value={editing[f.key]} onChange={(v) => setEditing((e) => ({ ...e, [f.key]: v }))} />
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button data-testid={`config-save-${kind}`} onClick={save} className="bg-primary hover:bg-[#C04917] text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
