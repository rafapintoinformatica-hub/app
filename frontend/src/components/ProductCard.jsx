import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/api";
import { useStore } from "@/context/StoreContext";
import { toast } from "sonner";

const slug = (name) =>
  name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const ProductCard = ({ product, index = 0 }) => {
  const { addToCart } = useStore();
  const id = slug(product.name);

  const handleAdd = () => {
    addToCart(product, 1);
    toast.success("Adicionado ao carrinho", { description: product.name });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      data-testid={`snack-card-${id}`}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-amber-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-amber-50">
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {product.badge && (
          <span className="absolute top-3 left-3 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary text-white shadow">
            {product.badge}
          </span>
        )}
        {!product.available && (
          <div className="absolute inset-0 bg-black/50 grid place-items-center">
            <span className="text-white font-bold uppercase tracking-wide text-sm">Indisponível</span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-5">
        <p className="text-[11px] uppercase tracking-wider text-amber-600 font-bold mb-1">
          {product.category}
        </p>
        <h3 className="font-heading font-bold text-amber-950 leading-snug">{product.name}</h3>
        <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed line-clamp-2 flex-1">
          {product.description}
        </p>
        <p className="text-[11px] text-amber-700/70 mt-2">
          Pronto em {product.lead_time_days} {product.lead_time_days > 1 ? "dias" : "dia"}
        </p>

        <div className="flex items-center justify-between mt-4">
          <span className="font-mono font-black text-xl text-primary">{formatBRL(product.price)}</span>
          <Button
            data-testid={`snack-add-to-cart-${id}`}
            onClick={handleAdd}
            disabled={!product.available}
            size="sm"
            className="rounded-full bg-amber-950 hover:bg-primary text-white px-4"
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
