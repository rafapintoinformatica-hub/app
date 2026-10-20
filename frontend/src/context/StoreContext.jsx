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
  const [cart, setCart] = useState(() => load("lanche_cart", []).filter((i) => i.key));
  const [deliveryDate, setDeliveryDate] = useState(() => load("lanche_date", null));

  useEffect(() => {
    localStorage.setItem("lanche_cart", JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    localStorage.setItem("lanche_date", JSON.stringify(deliveryDate));
  }, [deliveryDate]);

  const addToCart = (product, quantity = 1, flavor = null) => {
    const key = `${product.id}|${flavor || ""}`;
    setCart((prev) => {
      const found = prev.find((i) => i.key === key);
      if (found) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [
        ...prev,
        { key, product_id: product.id, name: product.name, flavor, price: product.price, quantity, image_url: product.image_url },
      ];
    });
  };

  const setQuantity = (key, quantity) => {
    if (quantity <= 0) return removeFromCart(key);
    setCart((prev) => prev.map((i) => (i.key === key ? { ...i, quantity } : i)));
  };

  const removeFromCart = (key) => setCart((prev) => prev.filter((i) => i.key !== key));

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
