import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

const TOKEN_KEY = "admin_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));
api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export const getProducts = () => api.get("/products").then((r) => r.data);
export const createProduct = (data) => api.post("/products", data).then((r) => r.data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data).then((r) => r.data);
export const deleteProduct = (id) => api.delete(`/products/${id}`).then((r) => r.data);

export const createOrder = (data) => api.post("/orders", data).then((r) => r.data);
export const getOrders = () => api.get("/orders").then((r) => r.data);
export const updateOrderStatus = (id, status, note = "") =>
  api.patch(`/orders/${id}/status`, { status, note }).then((r) => r.data);
export const markRefunded = (id) => api.patch(`/orders/${id}/refunded`).then((r) => r.data);
export const getIntegrations = () => api.get("/admin/integrations").then((r) => r.data);
export const updateIntegrations = (data) => api.put("/admin/integrations", data).then((r) => r.data);
export const testInfinitePay = () => api.post("/admin/integrations/infinitepay/test").then((r) => r.data);
export const testPluxee = () => api.post("/admin/integrations/pluxee/test").then((r) => r.data);
export const pluxeePay = (data) => api.post("/payments/pluxee/pay", data).then((r) => r.data);

export const updateOrderPayment = (id, data) => api.patch(`/orders/${id}/payment`, data).then((r) => r.data);

export const adminLogin = (password) =>
  api.post("/admin/login", { password }).then((r) => {
    setToken(r.data.token);
    return r.data;
  });
export const adminMe = () => api.get("/admin/me").then((r) => r.data);
export const changePassword = (current_password, new_password) =>
  api.put("/admin/password", { current_password, new_password }).then((r) => r.data);
export const getAdminSettings = () => api.get("/admin/settings").then((r) => r.data);
export const deleteOrder = (id) => api.delete(`/orders/${id}`).then((r) => r.data);

export const getConfig = (kind) => api.get(`/config/${kind}`).then((r) => r.data);
export const createConfig = (kind, data) => api.post(`/config/${kind}`, data).then((r) => r.data);
export const updateConfig = (kind, id, data) => api.put(`/config/${kind}/${id}`, data).then((r) => r.data);
export const deleteConfig = (kind, id) => api.delete(`/config/${kind}/${id}`).then((r) => r.data);

export const getPublicOrder = (id) => api.get(`/orders/${id}/public`).then((r) => r.data);
export const confirmInfinitePay = (data) => api.post("/payments/infinitepay/confirm", data).then((r) => r.data);

export const getPushKey = () => api.get("/push/public-key").then((r) => r.data.publicKey);
export const pushSubscribe = (sub) => api.post("/push/subscribe", sub).then((r) => r.data);
export const pushTest = () => api.post("/push/test").then((r) => r.data);
export const emailTest = () => api.post("/admin/test-email").then((r) => r.data);

export const getCoupons = () => api.get("/coupons").then((r) => r.data);
export const createCoupon = (data) => api.post("/coupons", data).then((r) => r.data);
export const deleteCoupon = (id) => api.delete(`/coupons/${id}`).then((r) => r.data);
export const validateCoupon = (code, subtotal) =>
  api.post("/coupons/validate", { code, subtotal }).then((r) => r.data);

export const getSettings = () => api.get("/settings").then((r) => r.data);
export const updateSettings = (data) => api.put("/admin/settings", data).then((r) => r.data);

export const waUrl = (phone, text) => {
  const digits = (phone || "").replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
};

export const formatBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
