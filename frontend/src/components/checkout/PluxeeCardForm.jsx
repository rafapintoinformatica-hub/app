import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const F = ({ k, label, card, setCard, ...rest }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input data-testid={`pluxee-card-${k}`} value={card[k]} onChange={(e) => setCard({ ...card, [k]: e.target.value })} {...rest} />
  </div>
);

export const emptyCard = { card_number: "", owner_name: "", expiry_month: "", expiry_year: "", cvv: "", cpf: "" };

export const cardValid = (c) => {
  const d = (v) => v.replace(/\D/g, "");
  return d(c.card_number).length >= 13 && c.owner_name.trim() && d(c.expiry_month) && d(c.expiry_year).length >= 2 && d(c.cvv).length >= 3 && d(c.cpf).length === 11;
};

export const PluxeeCardForm = ({ card, setCard }) => (
  <div className="bg-white rounded-xl border border-amber-200/60 p-3 space-y-3" data-testid="pluxee-card-form">
    <p className="text-xs text-zinc-500">Dados do cartão Pluxee Refeição. O pagamento é aprovado na hora; não guardamos os dados do cartão.</p>
    <F k="card_number" label="Número do cartão" card={card} setCard={setCard} inputMode="numeric" placeholder="0000 0000 0000 0000" />
    <F k="owner_name" label="Nome impresso no cartão" card={card} setCard={setCard} />
    <div className="grid grid-cols-3 gap-2">
      <F k="expiry_month" label="Mês" card={card} setCard={setCard} inputMode="numeric" placeholder="MM" maxLength={2} />
      <F k="expiry_year" label="Ano" card={card} setCard={setCard} inputMode="numeric" placeholder="AAAA" maxLength={4} />
      <F k="cvv" label="CVV" card={card} setCard={setCard} inputMode="numeric" maxLength={4} type="password" />
    </div>
    <F k="cpf" label="CPF do titular" card={card} setCard={setCard} inputMode="numeric" placeholder="000.000.000-00" />
  </div>
);
