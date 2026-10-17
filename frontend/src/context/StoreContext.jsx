import { createContext, useContext, useEffect, useState } from "react";

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const StoreProvider = ({ children }) => {
  const [cart, setCart] = useState(() => load("lanche_cart", []));
  const [deliveryDate, setDeliveryDate] = useState(() => load("lanche_date", null));

  useEffect(() => {
    localStorage.setItem("lanche_cart", JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    localStorage.setItem("lanche_date", JSON.stringify(deliveryDate));
  }, [deliveryDate]);

  const addToCart = (product, quantity = 1) => {
    setCart((prev) => {
      const found = prev.find((i) => i.product_id === product.id);
      if (found) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prev,
        { product_id: product.id, name: product.name, price: product.price, quantity, image_url: product.image_url },
      ];
    });
  };

  const setQuantity = (productId, quantity) => {
    if (quantity <= 0) return removeFromCart(productId);
    setCart((prev) => prev.map((i) => (i.product_id === productId ? { ...i, quantity } : i)));
  };

  const removeFromCart = (productId) =>
    setCart((prev) => prev.filter((i) => i.product_id !== productId));

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <StoreContext.Provider
      value={{
        cart,
        addToCart,
        setQuantity,
        removeFromCart,
        clearCart,
        subtotal,
        itemCount,
        deliveryDate,
        setDeliveryDate,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};
