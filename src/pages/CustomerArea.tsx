import { useState } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { User as UserIcon, Package, MapPin, LogOut, ChevronRight, Settings } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency } from "@/src/lib/utils";
import { useAuth } from "@/src/lib/FirebaseProvider";
import { auth } from "@/src/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const orders = [
  { id: "#12345", data: "02 Abr 2026", total: 325.40, status: "Enviado", itens: 1 },
  { id: "#12344", data: "15 Mar 2026", total: 459.90, status: "Entregue", itens: 2 },
];

const addresses = [
  { id: "1", logradouro: "Rua das Palmeiras, 123", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01234-567", principal: true },
];

export default function CustomerArea() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const isActive = (path: string) => location.pathname.includes(path);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm font-bold uppercase tracking-widest text-gray-400 animate-pulse">
          Carregando...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold uppercase tracking-tighter">Minha Conta</h1>
            <p className="text-gray-500">Acesse seus pedidos e gerencie seus dados.</p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center"
          >
            <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Sidebar */}
        <aside className="lg:w-64 space-y-2">
          <div className="p-6 rounded-3xl bg-gray-50 mb-8">
            <div className="h-12 w-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-xl mb-4">
              {user.displayName ? user.displayName[0] : user.email ? user.email[0] : "?"}
            </div>
            <h2 className="text-sm font-bold uppercase tracking-widest truncate">{user.displayName || "Cliente"}</h2>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>

          <Link
            to="/cliente/pedidos"
            className={cn(
              "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
              isActive("pedidos") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
            )}
          >
            <Package className="h-5 w-5" />
            <span>Meus Pedidos</span>
          </Link>
          <Link
            to="/cliente/perfil"
            className={cn(
              "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
              isActive("perfil") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
            )}
          >
            <UserIcon className="h-5 w-5" />
            <span>Meus Dados</span>
          </Link>
          <Link
            to="/cliente/enderecos"
            className={cn(
              "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
              isActive("enderecos") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
            )}
          >
            <MapPin className="h-5 w-5" />
            <span>Endereços</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </button>
        </aside>

        {/* Content */}
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<OrdersList />} />
            <Route path="pedidos" element={<OrdersList />} />
            <Route path="perfil" element={<ProfileEdit user={user} />} />
            <Route path="enderecos" element={<AddressesList />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function OrdersList() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold uppercase tracking-tighter">Meus Pedidos</h2>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="p-6 rounded-3xl border border-gray-100 flex items-center justify-between hover:border-black transition-colors group cursor-pointer">
            <div className="flex items-center space-x-6">
              <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                <Package className="h-6 w-6 text-gray-400" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pedido {order.id}</p>
                <p className="text-sm font-bold">{order.data} • {order.itens} {order.itens === 1 ? "item" : "itens"}</p>
              </div>
            </div>
            <div className="flex items-center space-x-8">
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Total</p>
                <p className="text-sm font-bold">{formatCurrency(order.total)}</p>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Status</p>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full",
                  order.status === "Entregue" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                )}>
                  {order.status}
                </span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-black transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileEdit({ user }: { user: any }) {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold uppercase tracking-tighter">Meus Dados</h2>
      <div className="bg-gray-50 rounded-3xl p-8 max-w-2xl">
        <form className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Nome Completo</label>
              <input type="text" defaultValue={user.displayName} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none bg-white" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">E-mail</label>
              <input type="email" defaultValue={user.email} disabled className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-100 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Telefone</label>
              <input type="text" defaultValue={user.phoneNumber || ""} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none bg-white" />
            </div>
          </div>
          <button className="rounded-full bg-black px-10 py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors">
            Salvar Alterações
          </button>
        </form>
      </div>
    </div>
  );
}

function AddressesList() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Meus Endereços</h2>
        <button className="text-sm font-bold uppercase tracking-widest underline">Adicionar novo</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {addresses.map((addr) => (
          <div key={addr.id} className="p-8 rounded-3xl border border-gray-100 space-y-4 relative">
            {addr.principal && (
              <span className="absolute top-6 right-6 text-[10px] font-bold uppercase tracking-widest bg-black text-white px-3 py-1 rounded-full">
                Principal
              </span>
            )}
            <div className="h-10 w-10 rounded-2xl bg-gray-50 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-bold">{addr.logradouro}</p>
              <p className="text-xs text-gray-500 mt-1">{addr.bairro}, {addr.cidade} - {addr.estado}</p>
              <p className="text-xs text-gray-500">{addr.cep}</p>
            </div>
            <div className="flex space-x-4 pt-4">
              <button className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black">Editar</button>
              <button className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600">Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
