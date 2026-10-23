import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getIntegrations, updateIntegrations, testInfinitePay, testPluxee } from "@/lib/api";
import { useStore } from "@/context/StoreContext";
import { toast } from "sonner";

const TestResult = ({ result, testid }) =>
  result ? (
    <div data-testid={testid} className={`flex items-start gap-2 text-sm rounded-lg p-3 ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
      {result.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
      <span>{result.message}{result.at ? ` · ${new Date(result.at).toLocaleString("pt-BR")}` : ""}</span>
    </div>
  ) : null;

const Field = ({ k, label, form, setForm, secret, placeholder }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input data-testid={`integration-${k}`} type={secret ? "password" : "text"} value={form[k] || ""} placeholder={placeholder}
      onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
  </div>
);

const Card = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-amber-200/60 p-5 shadow-sm space-y-4">
    <h3 className="font-heading font-bold text-amber-950 flex items-center gap-2"><PlugZap className="h-4 w-4 text-primary" /> {title}</h3>
    {children}
  </div>
);

export const IntegrationsPanel = () => {
  const { reloadSite } = useStore();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    getIntegrations().then(setForm);
  }, []);

  const save = async () => {
    try {
      setForm(await updateIntegrations(form));
      reloadSite();
      toast.success("Integrações salvas");
      return true;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao salvar");
      return false;
    }
  };

  const runTest = async (name, fn, key) => {
    setBusy(name);
    if (await save()) {
      const r = await fn();
      setForm((f) => ({ ...f, [key]: r }));
      r.ok ? toast.success(r.message) : toast.error(r.message);
    }
    setBusy("");
  };

  if (!form) return null;
  return (
    <div className="space-y-5" data-testid="integrations-panel">
      <Card title="InfinitePay — Pix e cartão de crédito online">
        <ol className="text-sm text-zinc-600 list-decimal pl-5 space-y-1">
          <li>Tenha uma conta InfinitePay (app InfinitePay no celular).</li>
          <li>Copie sua <strong>InfiniteTag</strong> (nome de usuário no app, ex: $minhaloja) e cole abaixo sem o $.</li>
          <li>Clique em <strong>Salvar e testar</strong>: geramos um link de teste de R$ 1,00. Se aparecer "sucesso", está pronto.</li>
          <li>Para confirmar de ponta a ponta, faça um pedido real com "Pix Online" de valor baixo: o pedido deve virar "Pagamento Aprovado" e você recebe e-mail + notificação.</li>
        </ol>
        <Field k="infinitepay_handle" label="InfiniteTag" form={form} setForm={setForm} placeholder="ex: rafael-gomes-23d" />
        <Button data-testid="infinitepay-test-button" disabled={!!busy} onClick={() => runTest("ip", testInfinitePay, "infinitepay_last_test")} className="bg-primary hover:bg-[#C04917] text-white">
          {busy === "ip" ? "Testando..." : "Salvar e testar"}
        </Button>
        <TestResult result={form.infinitepay_last_test} testid="infinitepay-test-result" />
      </Card>

      <Card title="Pluxee Refeição — pagamento online">
        <ol className="text-sm text-zinc-600 list-decimal pl-5 space-y-1">
          <li>Ligue para o Pluxee Estabelecimentos (3003-5083, dias úteis 8h–18h) e peça as credenciais da <strong>API de E-commerce (M-PAL)</strong>.</li>
          <li>Você recebe primeiro as credenciais de <strong>teste (UAT)</strong>: Client ID, Client Secret, Merchant ID (MID), Subscription Key de Cartões e de Transações.</li>
          <li>Escolha o ambiente "Teste (UAT)", preencha os campos e clique em <strong>Salvar e testar conexão</strong>.</li>
          <li>Com a conexão OK, ligue a chave <strong>"Ativar na loja"</strong> e faça um pedido com o cartão de teste enviado pelo Pluxee.</li>
          <li>Quando o Pluxee liberar a produção, troque o ambiente para "Produção (PRD)", cole as novas credenciais e teste de novo.</li>
        </ol>
        <div className="space-y-1.5">
          <Label>Ambiente</Label>
          <Select value={form.pluxee_env} onValueChange={(v) => setForm({ ...form, pluxee_env: v })}>
            <SelectTrigger data-testid="integration-pluxee_env"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="uat">Teste (UAT)</SelectItem>
              <SelectItem value="prd">Produção (PRD)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field k="pluxee_client_id" label="Client ID" form={form} setForm={setForm} />
          <Field k="pluxee_client_secret" label="Client Secret" form={form} setForm={setForm} secret placeholder="não alterado" />
          <Field k="pluxee_mid" label="Merchant ID (MID)" form={form} setForm={setForm} />
          <Field k="pluxee_sub_key_cards" label="Subscription Key — Cartões" form={form} setForm={setForm} secret placeholder="não alterado" />
          <Field k="pluxee_sub_key_transaction" label="Subscription Key — Transações" form={form} setForm={setForm} secret placeholder="não alterado" />
        </div>
        <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2.5">
          <Label>Ativar "Pluxee Refeição Online" na loja</Label>
          <Switch data-testid="integration-pluxee_enabled" checked={form.pluxee_enabled} onCheckedChange={(v) => setForm({ ...form, pluxee_enabled: v })} />
        </div>
        <p className="text-xs text-zinc-500" data-testid="pluxee-config-status">
          {form.pluxee_configured ? "Credenciais completas." : "Credenciais incompletas — a opção não aparece para o cliente."}
          {form.pluxee_enabled && form.pluxee_configured ? " Ativo na loja." : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="pluxee-save-button" variant="outline" disabled={!!busy} onClick={save}>Salvar</Button>
          <Button data-testid="pluxee-test-button" disabled={!!busy} onClick={() => runTest("px", testPluxee, "pluxee_last_test")} className="bg-primary hover:bg-[#C04917] text-white">
            {busy === "px" ? "Testando..." : "Salvar e testar conexão"}
          </Button>
        </div>
        <TestResult result={form.pluxee_last_test} testid="pluxee-test-result" />
      </Card>
    </div>
  );
};
