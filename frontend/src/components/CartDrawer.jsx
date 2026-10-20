import { Minus, Plus, Trash2, CalendarClock, ShoppingBag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/StoreContext";
import { formatBRL } from "@/lib/api";

export const CartDrawer = ({ open, onOpenChange, onCheckout }) => {
  const { cart, setQuantity, removeFromCart, subtotal } = useStore();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col bg-[#FFFDF9] p-0" data-testid="cart-drawer">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-amber-200/60">
          <SheetTitle className="font-heading text-2xl text-amber-950 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> Seu Carrinho
          </SheetTitle>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex-1 grid place-items-center text-center px-6">
            <div>
              <div className="h-16 w-16 rounded-full bg-amber-100 grid place-items-center mx-auto mb-4">
                <ShoppingBag className="h-7 w-7 text-amber-500" />
              </div>
              <p className="font-heading font-bold text-amber-950">Carrinho vazio</p>
              <p className="text-sm text-zinc-500 mt-1">Adicione cucas e bolos deliciosos para começar.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {cart.map((item) => (
              <div
                key={item.key}
                data-testid={`cart-item-${item.key}`}
                className="flex gap-3 items-center bg-white rounded-xl border border-amber-200/60 p-3"
              >
                <img src={item.image_url} alt={item.name} className="h-16 w-16 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-amber-950 line-clamp-2">{item.name}</p>
                  {item.flavor && <p className="text-xs text-amber-700" data-testid={`cart-flavor-${item.key}`}>Sabor: {item.flavor}</p>}
                  <p className="font-mono text-primary font-bold text-sm mt-0.5">{formatBRL(item.price)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    data-testid={`cart-remove-${item.key}`}
                    onClick={() => removeFromCart(item.key)}
                    className="text-zinc-400 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-1 bg-amber-50 rounded-full p-0.5">
                    <button
                      data-testid={`cart-dec-${item.key}`}
                      onClick={() => setQuantity(item.key, item.quantity - 1)}
                      className="h-7 w-7 grid place-items-center rounded-full hover:bg-amber-200 text-amber-900"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-amber-950">{item.quantity}</span>
                    <button
                      data-testid={`cart-inc-${item.key}`}
                      onClick={() => setQuantity(item.key, item.quantity + 1)}
                      className="h-7 w-7 grid place-items-center rounded-full hover:bg-amber-200 text-amber-900"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <SheetFooter className="px-6 py-5 border-t border-amber-200/60 bg-white block space-y-4">
            <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              <CalendarClock className="h-4 w-4 shrink-0" />
              <span>A data da entrega será escolhida na próxima etapa.</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Subtotal</span>
              <span className="font-mono font-black text-xl text-amber-950" data-testid="cart-subtotal">
                {formatBRL(subtotal)}
              </span>
            </div>
            <Button
              data-testid="cart-drawer-checkout-button"
              onClick={onCheckout}
              className="w-full h-12 rounded-xl bg-primary hover:bg-[#C04917] text-white font-bold text-base shadow-lg shadow-primary/20"
            >
              Avançar para Agendamento
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};
