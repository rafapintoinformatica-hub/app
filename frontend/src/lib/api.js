import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const getProducts = () => api.get("/products").then((r) => r.data);
export const createProduct = (data) => api.post("/products", data).then((r) => r.data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data).then((r) => r.data);
export const deleteProduct = (id) => api.delete(`/products/${id}`).then((r) => r.data);

export const createOrder = (data) => api.post("/orders", data).then((r) => r.data);
export const getOrders = () => api.get("/orders").then((r) => r.data);
export const updateOrderStatus = (id, status) =>
  api.patch(`/orders/${id}/status`, { status }).then((r) => r.data);

export const updateOrderPayment = (id, data) => api.patch(`/orders/${id}/payment`, data).then((r) => r.data);

export const adminLogin = (password) => api.post("/admin/login", { password }).then((r) => r.data);

export const getCoupons = () => api.get("/coupons").then((r) => r.data);
export const createCoupon = (data) => api.post("/coupons", data).then((r) => r.data);
export const deleteCoupon = (id) => api.delete(`/coupons/${id}`).then((r) => r.data);
export const validateCoupon = (code, subtotal) =>
  api.post("/coupons/validate", { code, subtotal }).then((r) => r.data);

export const getSettings = () => api.get("/settings").then((r) => r.data);
export const updateSettings = (data) => api.put("/settings", data).then((r) => r.data);

export const waUrl = (phone, text) => {
  const digits = (phone || "").replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
};

export const formatBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
