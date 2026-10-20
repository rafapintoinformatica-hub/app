import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, CalendarClock, Sparkles, ChefHat } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { ProductCard } from "@/components/ProductCard";
import { CartDrawer } from "@/components/CartDrawer";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { Input } from "@/components/ui/input";
import { getProducts } from "@/lib/api";
import { toast } from "sonner";

const CATEGORIES = [
  "Todos",
  "Cucas",
  "Bolos Caseiros",
  "Bolos Recheados",
  "Tortas Doces",
  "Bebidas",
];

export default function Store() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => toast.error("Erro ao carregar o cardápio"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = category === "Todos" || p.category === category;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, category, search]);

  const openCheckout = () => {
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9]">
      <Navbar onCartClick={() => setCartOpen(true)} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-amber-200/60">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-[#FFFDF9] to-orange-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Cucas & bolos feitos sob encomenda
            </span>
            <h1 className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight text-amber-950 leading-[1.05] mt-4">
              Cucas e bolos caseiros, <span className="text-primary">agendados</span> do seu jeito.
            </h1>
            <p className="text-base sm:text-lg text-amber-800/80 mt-4 max-w-lg">
              Escolha seus favoritos, marque o dia da entrega e pague na entrega com Pix, cartão de crédito, débito ou Pluxee Refeição. Tudo assado fresquinho para você.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <div className="flex items-center gap-2 text-sm text-amber-900 bg-white rounded-full px-4 py-2 border border-amber-200/60 shadow-sm">
                <CalendarClock className="h-4 w-4 text-primary" /> Você escolhe o dia da entrega
              </div>
              <div className="flex items-center gap-2 text-sm text-amber-900 bg-white rounded-full px-4 py-2 border border-amber-200/60 shadow-sm">
                <ChefHat className="h-4 w-4 text-primary" /> Pague só na entrega
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative hidden lg:block"
          >
            <img
              src="https://images.pexels.com/photos/5121948/pexels-photo-5121948.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
              alt="Bolo caseiro artesanal"
              className="rounded-3xl shadow-2xl object-cover aspect-[4/3] w-full rotate-1"
            />
            <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-xl p-4 border border-amber-200/60 rotate-[-3deg]">
              <p className="font-heading font-extrabold text-amber-950">+80 pedidos</p>
              <p className="text-xs text-zinc-500">entregues esta semana</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Catalog */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
          <div>
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-amber-950">Nosso Cardápio</h2>
            <p className="text-sm text-zinc-500 mt-1">Escolha e agende sua encomenda.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              data-testid="catalog-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cucas e bolos..."
              className="pl-9 rounded-full bg-white border-amber-200/60"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 mb-8 -mx-1 px-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              data-testid={`category-filter-${cat.split(" ")[0].toLowerCase()}`}
              onClick={() => setCategory(cat)}
              className={`whitespace-nowrap text-sm font-semibold px-4 py-2 rounded-full border transition-all ${
                category === cat
                  ? "bg-amber-950 text-white border-amber-950"
                  : "bg-white text-amber-900 border-amber-200/60 hover:border-primary/50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-amber-100/50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">Nenhum produto encontrado.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-amber-200/60 py-8 text-center text-sm text-zinc-500">
        <p className="font-heading font-bold text-amber-950">Deliciosas Cucas — Cucas & Bolos</p>
        <p className="mt-1">Pedidos agendados · Pagamento na entrega: Pix, Crédito, Débito e Pluxee Refeição</p>
      </footer>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} onCheckout={openCheckout} />
      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
}
