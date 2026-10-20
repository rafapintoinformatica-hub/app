export const PAYMENT_METHODS = ["Pix", "Cartão de Crédito", "Cartão de Débito", "Pluxee Refeição", "Dinheiro"];

export const changeLabel = (o) => (o.payment_method === "Dinheiro" && o.change_for ? `troco para R$ ${Number(o.change_for).toFixed(2).replace(".", ",")}` : "");
