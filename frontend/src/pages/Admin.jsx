import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Lock,
  Plus,
  Pencil,
  Trash2,
  Package,
  UtensilsCrossed,
  CalendarDays,
  Phone,
  MapPin,
  Ticket,
  MessageCircle,
  Settings as SettingsIcon,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { OrderPaymentEditor } from "@/components/OrderPaymentEditor";
import { AdminReports } from "@/components/AdminReports";
import {
  adminLogin,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  updateOrderStatus,
  getCoupons,
  createCoupon,
  deleteCoupon,
  formatBRL,
  waUrl,
  getToken,
  setToken,
  adminMe,
  getAdminSettings,
  deleteOrder,
  markRefunded,
} from "@/lib/api";
import { useStore } from "@/context/StoreContext";
import { STATUS_COLORS, chargeMessage, statusMessage } from "@/lib/messages";
import { ConfigListEditor } from "@/components/admin/ConfigListEditor";
import { StoreSettingsForm } from "@/components/admin/StoreSettingsForm";
import { NotificationsPanel, PasswordForm } from "@/components/admin/NotificationsPanel";
import { IntegrationsPanel } from "@/components/admin/IntegrationsPanel";
import { StatusChangeDialog, RefundDialog } from "@/components/admin/StatusDialogs";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  category: "",
  image_url: "",
  badge: "",
  lead_time_days: 1,
  available: true,
  flavors: "",
};

const emptyCoupon = {
  code: "",
  discount_type: "percent",
  discount_value: "",
  max_uses: 1,
  valid_until: "",
  active: true,
};

export default function Admin() {
  const navigate = useNavigate();
  const { config, site } = useStore();
  const storeName = site?.store_name || "";
  const statusOf = (name) => config.statuses.find((x) => x.name === name);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (getToken()) adminMe().then(() => setAuthed(true)).catch(() => setToken(null));
  }, []);

  const logout = () => {
    setToken(null);
    setAuthed(false);
  };

  const waLink = (o) =>
    statusOf(o.status)?.sends_charge && o.payment_status !== "Pago"
      ? waUrl(o.customer_phone, chargeMessage(o, settings.pix_key, storeName))
      : waUrl(o.customer_phone, statusMessage(o, storeName));
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState(emptyCoupon);
  const [settings, setSettings] = useState({ store_whatsapp: "", pix_key: "" });

  const loadData = () => {
    getProducts().then(setProducts);
    getOrders().then(setOrders);
    getCoupons().then(setCoupons);
    getAdminSettings().then(setSettings);
  };

  useEffect(() => {
    if (authed) loadData();
  }, [authed]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      await adminLogin(password);
      setAuthed(true);
      toast.success("Bem-vindo ao painel");
    } catch {
      toast.error("Senha incorreta");
    } finally {
      setLoggingIn(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, category: config.categories[0]?.name || "" });
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...p, badge: p.badge || "", flavors: (p.flavors || []).join(", ") });
    setDialogOpen(true);
  };

  const saveProduct = async () => {
    if (!form.name || !form.price) return toast.error("Preencha nome e preço");
    const payload = {
      ...form,
      price: parseFloat(form.price),
      lead_time_days: parseInt(form.lead_time_days) || 1,
      badge: form.badge || null,
      flavors: form.flavors.split(",").map((f) => f.trim()).filter(Boolean),
    };
    try {
      if (editing) {
        await updateProduct(editing.id, payload);
        toast.success("Produto atualizado");
      } else {
        await createProduct(payload);
        toast.success("Produto adicionado");
      }
      setDialogOpen(false);
      loadData();
    } catch {
      toast.error("Erro ao salvar produto");
    }
  };

  const removeProduct = async (id) => {
    try {
      await deleteProduct(id);
      toast.success("Produto removido");
      loadData();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const saveCoupon = async () => {
    if (!couponForm.code || !couponForm.discount_value) return toast.error("Preencha código e valor");
    try {
      await createCoupon({
        code: couponForm.code,
        discount_type: couponForm.discount_type,
        discount_value: parseFloat(couponForm.discount_value),
        max_uses: parseInt(couponForm.max_uses) || 1,
        active: couponForm.active,
        valid_until: couponForm.valid_until || null,
      });
      toast.success("Cupom criado");
      setCouponForm(emptyCoupon);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao criar cupom");
    }
  };

  const removeCoupon = async (id) => {
    try {
      await deleteCoupon(id);
      toast.success("Cupom removido");
      loadData();
    } catch {
      toast.error("Erro ao remover cupom");
    }
  };

  const [pendingStatus, setPendingStatus] = useState(null);
  const [refundOrder, setRefundOrder] = useState(null);
  const replaceOrder = (u) => setOrders((prev) => prev.map((o) => (o.id === u.id ? u : o)));

  const changeStatus = async (order, status, note) => {
    const win = status.sends_charge && order.payment_status !== "Pago"
      ? window.open(waUrl(order.customer_phone, chargeMessage(order, settings.pix_key, storeName)), "_blank") : null;
    try {
      const updated = await updateOrderStatus(order.id, status.name, note);
      replaceOrder(updated);
      setPendingStatus(null);
      toast.success("Status atualizado");
      if (updated.payment_status === "Estorno pendente") setRefundOrder(updated);
      if (updated.payment_status === "Estornado" && order.payment_status !== "Estornado") toast.success("Estorno realizado no Pluxee");
    } catch (e) {
      if (win) win.close();
      toast.error(e?.response?.data?.detail || "Erro ao atualizar status");
    }
  };

  const confirmRefund = async (order) => {
    try {
      replaceOrder(await markRefunded(order.id));
      setRefundOrder(null);
      toast.success("Estorno registrado");
    } catch {
      toast.error("Erro ao registrar estorno");
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] grid place-items-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white rounded-2xl border border-amber-200/60 shadow-lg p-8"
        >
          <div className="h-12 w-12 rounded-xl bg-primary text-white grid place-items-center mx-auto mb-4">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-heading font-extrabold text-2xl text-amber-950 text-center">Painel Admin</h1>
          <p className="text-sm text-zinc-500 text-center mt-1">Acesso restrito à loja.</p>
          <div className="space-y-2 mt-6">
            <Label>Senha</Label>
            <Input
              data-testid="admin-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button
            data-testid="admin-login-button"
            type="submit"
            disabled={loggingIn}
            className="w-full mt-5 h-11 rounded-xl bg-primary hover:bg-[#C04917] text-white font-bold"
          >
            {loggingIn ? "Entrando..." : "Entrar"}
          </Button>
          <button
            type="button"
            data-testid="admin-back-store"
            onClick={() => navigate("/")}
            className="w-full text-center text-sm text-zinc-500 hover:text-primary mt-4"
          >
            Voltar à loja
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9]">
      <header className="sticky top-0 z-40 border-b border-amber-200/60 bg-[#FFFDF9]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="admin-header-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-heading font-extrabold text-xl text-amber-950">Painel Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500 hidden sm:block">{storeName}</span>
            <Button data-testid="admin-logout-button" size="sm" variant="outline" onClick={logout}>Sair</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="orders">
          <TabsList className="bg-amber-50 p-1 flex-wrap h-auto">
            <TabsTrigger value="orders" data-testid="admin-orders-tab" className="data-[state=active]:bg-white gap-2">
              <Package className="h-4 w-4" /> Encomendas ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="admin-reports-tab" className="data-[state=active]:bg-white gap-2">
              <BarChart3 className="h-4 w-4" /> Relatórios
            </TabsTrigger>
            <TabsTrigger value="menu" data-testid="admin-menu-tab" className="data-[state=active]:bg-white gap-2">
              <UtensilsCrossed className="h-4 w-4" /> Cardápio ({products.length})
            </TabsTrigger>
            <TabsTrigger value="coupons" data-testid="admin-coupons-tab" className="data-[state=active]:bg-white gap-2">
              <Ticket className="h-4 w-4" /> Cupons ({coupons.length})
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="admin-settings-tab" className="data-[state=active]:bg-white gap-2">
              <SettingsIcon className="h-4 w-4" /> Configurações
            </TabsTrigger>
          </TabsList>

          {/* Orders */}
          <TabsContent value="orders" className="mt-6">
            {orders.length === 0 ? (
              <div className="text-center py-20 text-zinc-500">Nenhuma encomenda ainda.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    data-testid={`admin-order-${o.order_code}`}
                    className="bg-white rounded-2xl border border-amber-200/60 p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono font-black text-primary">#{o.order_code}</p>
                        <p className="font-semibold text-amber-950 mt-0.5">{o.customer_name}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[statusOf(o.status)?.color] || STATUS_COLORS.zinc}`}>
                        {o.status}
                      </span>
                    </div>
                    {o.status_note && <p data-testid={`admin-order-note-${o.order_code}`} className="text-xs text-zinc-500 mt-1 italic">Justificativa: {o.status_note}</p>}
                    {o.payment_status === "Estorno pendente" && (
                      <button data-testid={`admin-order-refund-${o.order_code}`} onClick={() => setRefundOrder(o)} className="mt-2 text-xs font-bold text-red-700 bg-red-50 rounded-lg px-2.5 py-1">
                        Estorno pendente — fazer agora
                      </button>
                    )}

                    <div className="mt-3 space-y-1.5 text-sm text-zinc-600">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-amber-600" />
                        {new Date(o.delivery_date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-amber-600" /> {o.customer_phone}
                      </p>
                      <p className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-amber-600 mt-0.5" />
                        <span data-testid={`admin-order-place-${o.order_code}`}>{o.address}{o.complement ? ` — ${o.complement}` : ""}</span>
                      </p>
                    </div>

                    <div className="mt-3 border-t border-amber-100 pt-3 space-y-1">
                      {o.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-zinc-700">{it.quantity}× {it.name}{it.flavor ? ` — ${it.flavor}` : ""}</span>
                          <span className="font-mono text-zinc-500">{formatBRL(it.price * it.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    {o.notes && <p className="text-xs text-amber-700 mt-2 italic">Obs: {o.notes}</p>}

                    <div className="flex items-center justify-between mt-4">
                      <div>
                        <OrderPaymentEditor order={o} onUpdated={(u) => setOrders((prev) => prev.map((x) => (x.id === u.id ? u : x)))} />
                        <span data-testid={`admin-order-paystatus-${o.order_code}`} className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full mt-1 ${o.payment_status === "Pago" ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-700"}`}>
                          {o.payment_status}
                        </span>
                        {o.receipt_url && <a href={o.receipt_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-[11px] text-primary underline">comprovante</a>}
                        <p className="font-mono font-black text-amber-950">{formatBRL(o.total)}</p>
                      </div>
                      <Select value={o.status} onValueChange={(v) => setPendingStatus({ order: o, status: statusOf(v) })}>
                        <SelectTrigger className="w-52" data-testid={`admin-order-status-${o.order_code}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {config.statuses.map((s) => (
                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <a
                      data-testid={`admin-whatsapp-${o.order_code}`}
                      href={waLink(o)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-2 w-full rounded-lg bg-[#25D366] hover:bg-[#1da851] text-white font-semibold text-sm py-2 transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" /> {statusOf(o.status)?.sends_charge && o.payment_status !== "Pago" ? "Enviar cobrança no WhatsApp" : "Avisar cliente no WhatsApp"}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Menu */}
          <TabsContent value="menu" className="mt-6">
            <div className="flex justify-end mb-5">
              <Button
                data-testid="admin-add-snack-button"
                onClick={openNew}
                className="rounded-full bg-primary hover:bg-[#C04917] text-white"
              >
                <Plus className="h-4 w-4 mr-2" /> Novo Produto
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  data-testid={`admin-product-${p.id}`}
                  className="bg-white rounded-2xl border border-amber-200/60 overflow-hidden shadow-sm"
                >
                  <div className="aspect-[16/9] bg-amber-50">
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-amber-950 text-sm leading-snug">{p.name}</p>
                      <span className="font-mono font-black text-primary text-sm shrink-0">{formatBRL(p.price)}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{p.category}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        data-testid={`admin-edit-${p.id}`}
                        onClick={() => openEdit(p)}
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-lg"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button
                        data-testid={`admin-delete-${p.id}`}
                        onClick={() => removeProduct(p.id)}
                        size="sm"
                        variant="outline"
                        className="rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Coupons */}
          <TabsContent value="reports" className="mt-6">
            <AdminReports orders={orders} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Tabs defaultValue="loja">
              <TabsList className="bg-amber-50 p-1 flex-wrap h-auto">
                {[["loja", "Loja"], ["statuses", "Status"], ["payment_methods", "Pagamentos"], ["places", "Locais"], ["categories", "Categorias"], ["integracoes", "Integrações"], ["avisos", "Notificações & Senha"], ["delivery_dates", "Agenda"]] .map(([v, l]) => (
                  <TabsTrigger key={v} value={v} data-testid={`settings-subtab-${v}`} className="data-[state=active]:bg-white">{l}</TabsTrigger>
                ))}
              </TabsList>
              <div className="mt-5 max-w-2xl">
                <TabsContent value="loja"><StoreSettingsForm onSaved={setSettings} /></TabsContent>
                {["statuses", "payment_methods", "places", "categories", "delivery_dates"].map((k) => (

                  <TabsContent key={k} value={k}><ConfigListEditor kind={k} /></TabsContent>
                ))}
                <TabsContent value="integracoes"><IntegrationsPanel /></TabsContent>
                <TabsContent value="avisos" className="space-y-5"><NotificationsPanel /><PasswordForm /></TabsContent>
              </div>
            </Tabs>
          </TabsContent>

          <TabsContent value="coupons" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1 bg-white rounded-2xl border border-amber-200/60 p-5 shadow-sm h-fit">
                <h3 className="font-heading font-bold text-amber-950 mb-4">Novo Cupom</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Código</Label>
                    <Input
                      data-testid="coupon-form-code"
                      value={couponForm.code}
                      onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                      placeholder="EX: BOLO10"
                      className="uppercase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tipo</Label>
                      <Select value={couponForm.discount_type} onValueChange={(v) => setCouponForm({ ...couponForm, discount_type: v })}>
                        <SelectTrigger data-testid="coupon-form-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Porcentagem (%)</SelectItem>
                          <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{couponForm.discount_type === "percent" ? "Desconto (%)" : "Desconto (R$)"}</Label>
                      <Input data-testid="coupon-form-value" type="number" step="0.01" value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Qtd. de usos</Label>
                      <Input data-testid="coupon-form-maxuses" type="number" min="1" value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Válido até</Label>
                      <Input data-testid="coupon-form-validuntil" type="date" value={couponForm.valid_until} onChange={(e) => setCouponForm({ ...couponForm, valid_until: e.target.value })} />
                    </div>
                  </div>
                  <Button data-testid="coupon-form-save" onClick={saveCoupon} className="w-full rounded-lg bg-primary hover:bg-[#C04917] text-white">
                    <Plus className="h-4 w-4 mr-1" /> Criar Cupom
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-3">
                {coupons.length === 0 ? (
                  <div className="text-center py-20 text-zinc-500">Nenhum cupom cadastrado.</div>
                ) : (
                  coupons.map((c) => (
                    <div
                      key={c.id}
                      data-testid={`admin-coupon-${c.code}`}
                      className="bg-white rounded-xl border border-amber-200/60 p-4 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-primary">{c.code}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            {c.discount_type === "percent" ? `${c.discount_value}%` : formatBRL(c.discount_value)}
                          </span>
                          {!c.active && <span className="text-xs text-zinc-400">(inativo)</span>}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">
                          Usos: {c.used_count}/{c.max_uses}
                          {c.valid_until ? ` · válido até ${new Date(c.valid_until + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                        </p>
                      </div>
                      <Button
                        data-testid={`admin-coupon-delete-${c.code}`}
                        onClick={() => removeCoupon(c.id)}
                        size="sm"
                        variant="outline"
                        className="rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <StatusChangeDialog key={pendingStatus ? `${pendingStatus.order.id}-${pendingStatus.status?.name}` : "none"} pending={pendingStatus?.status ? pendingStatus : null}
        onCancel={() => setPendingStatus(null)} onConfirm={changeStatus} />
      <RefundDialog order={refundOrder} onClose={() => setRefundOrder(null)} onRefunded={confirmRefund} />

      {/* Product form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-[#FFFDF9] max-h-[90vh] overflow-y-auto" data-testid="admin-product-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-amber-950">
              {editing ? "Editar Lanche" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input data-testid="admin-form-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea data-testid="admin-form-description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preço (R$)</Label>
                <Input data-testid="admin-form-price" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Prazo (dias)</Label>
                <Input data-testid="admin-form-leadtime" type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="admin-form-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {config.categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>URL da Imagem</Label>
              <Input data-testid="admin-form-image" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label>Sabores (separados por vírgula)</Label>
              <Input data-testid="admin-form-flavors" value={form.flavors} onChange={(e) => setForm({ ...form, flavors: e.target.value })} placeholder="Ex: Banana, Uva, Coco" />
            </div>
            <div className="space-y-1.5">
              <Label>Selo (opcional)</Label>
              <Input data-testid="admin-form-badge" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="Ex: Mais Pedidos, Novidade" />
            </div>
            <div className="flex items-center justify-between bg-white rounded-lg border border-amber-200/60 px-3 py-2.5">
              <Label className="cursor-pointer">Disponível</Label>
              <Switch data-testid="admin-form-available" checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-lg">Cancelar</Button>
            <Button data-testid="admin-form-save" onClick={saveProduct} className="rounded-lg bg-primary hover:bg-[#C04917] text-white">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
