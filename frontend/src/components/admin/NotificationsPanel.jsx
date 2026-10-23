import { useState } from "react";
import { Bell, Mail, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPushKey, pushSubscribe, pushTest, emailTest, changePassword } from "@/lib/api";
import { toast } from "sonner";

const b64ToBytes = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const errMsg = (e, fallback) => e?.response?.data?.detail || e?.message || fallback;

export const NotificationsPanel = () => {
  const [status, setStatus] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  const enablePush = async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw new Error("No iPhone, adicione o painel à Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra por lá.");
      const perm = await Notification.requestPermission();
      setStatus(perm);
      if (perm !== "granted") throw new Error("Permissão de notificação negada no navegador");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const key = await getPushKey();
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      await pushSubscribe(sub.toJSON());
      toast.success("Notificações ativadas neste aparelho");
    } catch (e) {
      toast.error(errMsg(e, "Não foi possível ativar"));
    }
  };

  const testPush = async () => {
    try {
      const r = await pushTest();
      toast.success(`Notificação enviada para ${r.sent} aparelho(s)`);
    } catch (e) {
      toast.error(errMsg(e, "Erro ao testar"));
    }
  };

  const testEmail = async () => {
    try {
      await emailTest();
      toast.success("E-mail de teste enviado");
    } catch (e) {
      toast.error(errMsg(e, "Erro ao enviar e-mail"));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-amber-200/60 p-5 shadow-sm space-y-4" data-testid="notifications-panel">
      <h3 className="font-heading font-bold text-amber-950 flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notificações de pagamento aprovado</h3>
      <p className="text-sm text-zinc-600">
        Ative em cada celular/computador que deve receber o aviso, mesmo com o site fechado. No celular, instale o painel como app
        (menu do navegador → "Adicionar à tela inicial") e ative por lá.
      </p>
      <p className="text-xs text-zinc-500" data-testid="push-permission-status">Permissão neste aparelho: {status}</p>
      <div className="flex flex-wrap gap-2">
        <Button data-testid="push-enable-button" onClick={enablePush} className="bg-primary hover:bg-[#C04917] text-white"><Bell className="h-4 w-4 mr-1" /> Ativar neste aparelho</Button>
        <Button data-testid="push-test-button" variant="outline" onClick={testPush}>Testar notificação</Button>
        <Button data-testid="email-test-button" variant="outline" onClick={testEmail}><Mail className="h-4 w-4 mr-1" /> Testar e-mail</Button>
      </div>
    </div>
  );
};

export const PasswordForm = () => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  const save = async () => {
    try {
      await changePassword(current, next);
      toast.success("Senha alterada");
      setCurrent("");
      setNext("");
    } catch (e) {
      toast.error(errMsg(e, "Erro ao alterar senha"));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-amber-200/60 p-5 shadow-sm space-y-3" data-testid="password-form">
      <h3 className="font-heading font-bold text-amber-950 flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Senha do painel</h3>
      <div className="space-y-1.5"><Label>Senha atual</Label><Input data-testid="password-current-input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Nova senha (mín. 6 caracteres)</Label><Input data-testid="password-new-input" type="password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
      <Button data-testid="password-save-button" onClick={save} className="w-full bg-primary hover:bg-[#C04917] text-white">Alterar senha</Button>
    </div>
  );
};
