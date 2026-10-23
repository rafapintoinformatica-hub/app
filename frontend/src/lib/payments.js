export const changeLabel = (o) => (o.change_for ? `troco para R$ ${Number(o.change_for).toFixed(2).replace(".", ",")}` : "");
