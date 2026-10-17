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
import {
  adminLogin,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  updateOrderStatus,
  formatBRL,
} from "@/lib/api";
import { toast } from "sonner";

const CATEGORIES = [
  "Salgados & Coxinhas",
  "Hambúrgueres Artesanais",
  "Combos Sob Encomenda",
  "Doces & Sobremesas",
  "Bebidas Naturais",
];

const STATUSES = ["Pendente", "Em Preparo", "Pronto", "Em Rota", "Entregue"];
const STATUS_COLOR = {
  Pendente: "bg-amber-100 text-amber-800",
  "Em Preparo": "bg-blue-100 text-blue-800",
  Pronto: "bg-purple-100 text-purple-800",
  "Em Rota": "bg-orange-100 text-orange-800",
  Entregue: "bg-emerald-100 text-emerald-800",
};

const emptyForm = {
  name: "",
  description: "",
  price: "",
  category: CATEGORIES[0],
  image_url: "",
  badge: "",
  lead_time_days: 1,
  available: true,
};

export default function Admin() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = () => {
    getProducts().then(setProducts);
    getOrders().then(setOrders);
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
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...p, badge: p.badge || "" });
    setDialogOpen(true);
  };

  const saveProduct = async () => {
    if (!form.name || !form.price) return toast.error("Preencha nome e preço");
    const payload = {
      ...form,
      price: parseFloat(form.price),
      lead_time_days: parseInt(form.lead_time_days) || 1,
      badge: form.badge || null,
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

  const changeStatus = async (id, status) => {
    try {
      await updateOrderStatus(id, status);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      toast.success("Status atualizado");
    } catch {
      toast.error("Erro ao atualizar status");
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
          <span className="text-sm text-zinc-500 hidden sm:block">Dona Lanche</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="orders">
          <TabsList className="bg-amber-50 p-1">
            <TabsTrigger value="orders" data-testid="admin-orders-tab" className="data-[state=active]:bg-white gap-2">
              <Package className="h-4 w-4" /> Encomendas ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="menu" data-testid="admin-menu-tab" className="data-[state=active]:bg-white gap-2">
              <UtensilsCrossed className="h-4 w-4" /> Cardápio ({products.length})
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
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLOR[o.status]}`}>
                        {o.status}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5 text-sm text-zinc-600">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-amber-600" />
                        {new Date(o.delivery_date + "T00:00:00").toLocaleDateString("pt-BR")} · {o.time_slot}
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-amber-600" /> {o.customer_phone}
                      </p>
                      <p className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-amber-600 mt-0.5" />
                        {o.address}{o.neighborhood ? `, ${o.neighborhood}` : ""}{o.complement ? ` — ${o.complement}` : ""}
                      </p>
                    </div>

                    <div className="mt-3 border-t border-amber-100 pt-3 space-y-1">
                      {o.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-zinc-700">{it.quantity}× {it.name}</span>
                          <span className="font-mono text-zinc-500">{formatBRL(it.price * it.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    {o.notes && <p className="text-xs text-amber-700 mt-2 italic">Obs: {o.notes}</p>}

                    <div className="flex items-center justify-between mt-4">
                      <div>
                        <p className="text-xs text-zinc-500">{o.payment_method}</p>
                        <p className="font-mono font-black text-amber-950">{formatBRL(o.total)}</p>
                      </div>
                      <Select value={o.status} onValueChange={(v) => changeStatus(o.id, v)}>
                        <SelectTrigger className="w-36" data-testid={`admin-order-status-${o.order_code}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                <Plus className="h-4 w-4 mr-2" /> Novo Lanche
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
        </Tabs>
      </main>

      {/* Product form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-[#FFFDF9] max-h-[90vh] overflow-y-auto" data-testid="admin-product-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-amber-950">
              {editing ? "Editar Lanche" : "Novo Lanche"}
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
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>URL da Imagem</Label>
              <Input data-testid="admin-form-image" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
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
