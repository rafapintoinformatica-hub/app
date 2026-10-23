import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { StoreProvider } from "@/context/StoreContext";
import Store from "@/pages/Store";
import Admin from "@/pages/Admin";
import PaymentReturn from "@/pages/PaymentReturn";

function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Store />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/pagamento/retorno" element={<PaymentReturn />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </StoreProvider>
  );
}

export default App;
