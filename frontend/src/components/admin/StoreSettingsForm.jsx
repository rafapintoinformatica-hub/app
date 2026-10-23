import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAdminSettings, updateSettings } from "@/lib/api";
import { useStore } from "@/context/StoreContext";
import { toast } from "sonner";

const GROUPS = [
  ["Identidade da loja", [
    ["store_name", "Nome da loja"],
    ["store_tagline", "Slogan (abaixo do nome)"],
  ]],
  ["Página inicial", [
    ["hero_badge", "Selo do topo"],
    ["hero_title", "Título principal", "area"],
    ["hero_subtitle", "Texto de apresentação", "area"],
    ["hero_image", "URL da imagem principal"],
    ["footer_text", "Texto do rodapé"],
  ]],
  ["Contato, pagamentos e avisos", [
    ["store_whatsapp", "WhatsApp da loja (recebe os pedidos)"],
    ["pix_key", "Chave Pix (enviada nas cobranças)"],
    ["infinitepay_handle", "InfiniteTag da InfinitePay (pagamento online)"],
    ["notification_email", "E-mail que recebe aviso de pagamento aprovado"],
  ]],
];

export const StoreSettingsForm = ({ onSaved }) => {
  const { reloadSite } = useStore();
  const [s, setS] = useState(null);

  useEffect(() => {
    getAdminSettings().then(setS);
  }, []);

  const save = async () => {
    try {
      const saved = await updateSettings(s);
      setS(saved);
      onSaved?.(saved);
      reloadSite();
      toast.success("Configurações salvas");
    } catch {
      toast.error("Erro ao salvar configurações");
    }
  };

  if (!s) return null;
  return (
    <div className="bg-white rounded-2xl border border-amber-200/60 p-5 shadow-sm space-y-6" data-testid="store-settings-form">
      {GROUPS.map(([title, fields]) => (
        <div key={title} className="space-y-3">
          <h3 className="font-heading font-bold text-amber-950">{title}</h3>
          {fields.map(([key, label, type]) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              {type === "area" ? (
                <Textarea data-testid={`settings-${key}`} rows={2} value={s[key] || ""} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
              ) : (
                <Input data-testid={`settings-${key}`} value={s[key] || ""} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
      ))}
      <Button data-testid="settings-save-button" onClick={save} className="w-full rounded-lg bg-primary hover:bg-[#C04917] text-white">Salvar</Button>
    </div>
  );
};
