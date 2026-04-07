import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import Product from "./pages/Product";
import Checkout from "./pages/Checkout";
import CustomerArea from "./pages/CustomerArea";
import OrderTracking from "./pages/OrderTracking";
import Admin from "./pages/Admin";
import { FirebaseProvider, ErrorBoundary } from "./lib/FirebaseProvider";

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalogo" element={<Catalog />} />
              <Route path="/produto/:slug" element={<Product />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/cliente/*" element={<CustomerArea />} />
              <Route path="/rastreamento" element={<OrderTracking />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route path="*" element={<div className="flex h-screen items-center justify-center">Página não encontrada</div>} />
            </Routes>
          </Layout>
        </Router>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
