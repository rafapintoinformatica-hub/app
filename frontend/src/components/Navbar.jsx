import { ShoppingBag, UtensilsCrossed, Shield } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const Navbar = ({ onCartClick }) => {
  const { itemCount, site } = useStore();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-amber-200/60 bg-[#FFFDF9]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        <button
          data-testid="nav-brand-logo"
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 group"
        >
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-md group-hover:rotate-6 transition-transform">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div className="text-left leading-tight">
            <p data-testid="nav-store-name" className="font-heading font-extrabold text-lg text-amber-950">{site?.store_name}</p>
            <p className="text-[11px] uppercase tracking-widest text-amber-700/70 font-semibold -mt-0.5">
              {site?.store_tagline}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            data-testid="nav-admin-toggle"
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="text-amber-900 hover:text-primary hover:bg-amber-100/60"
          >
            <Shield className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Painel Admin</span>
          </Button>
          <Button
            data-testid="nav-cart-trigger"
            onClick={onCartClick}
            className="relative bg-primary hover:bg-[#C04917] text-white rounded-full px-5 shadow-lg shadow-primary/20"
          >
            <ShoppingBag className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Carrinho</span>
            {itemCount > 0 && (
              <span
                data-testid="nav-cart-count"
                className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-amber-500 text-white text-xs font-bold grid place-items-center border-2 border-[#FFFDF9]"
              >
                {itemCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};
