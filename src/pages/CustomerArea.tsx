import { useState, useEffect } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { User as UserIcon, Package, MapPin, LogOut, ChevronRight, Settings, Mail, Lock, Phone, CreditCard, Home as HomeIcon, X, Truck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency } from "@/src/lib/utils";
import { useAuth } from "@/src/lib/FirebaseProvider";
import { auth, db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection, addDoc, getDocs, query, where, getDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const addressSchema = z.object({
  cep: z.string().min(8, "CEP inválido"),
  logradouro: z.string().min(3, "Endereço inválido"),
  numero: z.string().min(1, "Obrigatório"),
  complemento: z.string(),
  bairro: z.string().min(2, "Bairro inválido"),
  cidade: z.string().min(2, "Cidade inválida"),
  estado: z.string().length(2, "UF inválida"),
  principal: z.boolean(),
});

type AddressFormData = z.infer<typeof addressSchema>;

const registerSchema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  telefone: z.string().min(10, "Telefone inválido"),
  cpf: z.string().min(11, "CPF inválido"),
  cep: z.string().min(8, "CEP inválido"),
  logradouro: z.string().min(3, "Endereço inválido"),
  numero: z.string().min(1, "Obrigatório"),
  complemento: z.string().optional(),
  bairro: z.string().min(2, "Bairro inválido"),
  cidade: z.string().min(2, "Cidade inválida"),
  estado: z.string().length(2, "UF inválida"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "Senha inválida"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function CustomerArea() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const handleGoogleLogin = async () => {
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
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl font-bold uppercase tracking-tighter">
              {authMode === "login" ? "Acesse sua Conta" : "Crie sua Conta"}
            </h1>
            <p className="text-gray-500">
              {authMode === "login" 
                ? "Bem-vindo de volta! Entre para gerenciar seus pedidos." 
                : "Cadastre-se para uma experiência de compra completa."}
            </p>
          </div>

          <div className="bg-white rounded-[40px] border border-gray-100 p-8 sm:p-12 shadow-sm">
            <AnimatePresence mode="wait">
              {authMode === "login" ? (
                <LoginForm key="login" onToggle={() => setAuthMode("register")} onGoogle={handleGoogleLogin} />
              ) : (
                <RegisterForm key="register" onToggle={() => setAuthMode("login")} />
              )}
            </AnimatePresence>
          </div>
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
            <div className="h-12 w-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-xl mb-4 uppercase">
              {user.displayName ? user.displayName[0] : user.email ? user.email[0] : "?"}
            </div>
            <h2 className="text-sm font-bold uppercase tracking-widest truncate">{user.displayName || "Cliente"}</h2>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>

          <Link
            to="/cliente/pedidos"
            className={cn(
              "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
              isActive("pedidos") || location.pathname === "/cliente" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
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

function LoginForm({ onToggle, onGoogle }: { onToggle: () => void, onGoogle: () => void }) {
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await signInWithEmailAndPassword(auth, data.email, data.senha);
    } catch (err: any) {
      setError("E-mail ou senha incorretos.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
              <input
                {...register("email")}
                type="email"
                className="w-full rounded-2xl border border-gray-100 bg-gray-50 pl-12 pr-4 py-4 text-sm focus:border-black focus:bg-white focus:outline-none transition-all"
                placeholder="seu@email.com"
              />
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-500 font-bold">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
              <input
                {...register("senha")}
                type="password"
                className="w-full rounded-2xl border border-gray-100 bg-gray-50 pl-12 pr-4 py-4 text-sm focus:border-black focus:bg-white focus:outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
            {errors.senha && <p className="mt-1 text-xs text-red-500 font-bold">{errors.senha.message}</p>}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 font-bold text-center">{error}</p>}

        <button
          disabled={isSubmitting}
          type="submit"
          className="w-full rounded-full bg-black py-5 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50"
        >
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
        <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold"><span className="bg-white px-4 text-gray-400">ou</span></div>
      </div>

      <button
        onClick={onGoogle}
        className="w-full rounded-full border border-gray-100 py-5 text-sm font-bold text-gray-600 uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center"
      >
        <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Entrar com Google
      </button>

      <p className="text-center text-sm text-gray-500">
        Não tem uma conta?{" "}
        <button onClick={onToggle} className="font-bold text-black underline">Cadastre-se</button>
      </p>
    </motion.div>
  );
}

function RegisterForm({ onToggle }: { onToggle: () => void }) {
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.senha);
      const user = userCredential.user;

      // 2. Update Auth Profile
      await updateProfile(user, { displayName: data.nome });

      // 3. Create User Document in Firestore
      const userRef = doc(db, "usuarios", user.uid);
      await setDoc(userRef, {
        id: user.uid,
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        cpf: data.cpf,
        role: "cliente",
        criado_em: serverTimestamp(),
        atualizado_em: serverTimestamp()
      });

      // 4. Create Initial Address
      const addressRef = collection(db, "usuarios", user.uid, "enderecos");
      await addDoc(addressRef, {
        id: crypto.randomUUID(),
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento || "",
        bairro: data.bairro,
        cidade: data.cidade,
        estado: data.estado,
        principal: true,
        criado_em: serverTimestamp()
      });

    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail já está em uso.");
      } else {
        setError("Ocorreu um erro ao criar sua conta. Tente novamente.");
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Dados Pessoais */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <UserIcon className="h-4 w-4" /> Dados Pessoais
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nome Completo</label>
              <input {...register("nome")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="Ex: João Silva" />
              {errors.nome && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.nome.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">E-mail</label>
              <input {...register("email")} type="email" className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="seu@email.com" />
              {errors.email && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Senha</label>
              <input {...register("senha")} type="password" className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="Mín. 6 caracteres" />
              {errors.senha && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.senha.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Telefone</label>
              <input {...register("telefone")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="(00) 00000-0000" />
              {errors.telefone && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.telefone.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">CPF</label>
              <input {...register("cpf")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="000.000.000-00" />
              {errors.cpf && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.cpf.message}</p>}
            </div>
          </div>
        </div>

        {/* Endereço de Entrega */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Endereço de Entrega
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">CEP</label>
              <input {...register("cep")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="00000-000" />
              {errors.cep && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.cep.message}</p>}
            </div>
            <div className="sm:col-span-4">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Logradouro</label>
              <input {...register("logradouro")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="Rua, Avenida..." />
              {errors.logradouro && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.logradouro.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Número</label>
              <input {...register("numero")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="123" />
              {errors.numero && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.numero.message}</p>}
            </div>
            <div className="sm:col-span-4">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Complemento</label>
              <input {...register("complemento")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="Apto, Bloco..." />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Bairro</label>
              <input {...register("bairro")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="Bairro" />
              {errors.bairro && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.bairro.message}</p>}
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Cidade</label>
              <input {...register("cidade")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="Cidade" />
              {errors.cidade && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.cidade.message}</p>}
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">UF</label>
              <input {...register("estado")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="SP" maxLength={2} />
              {errors.estado && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.estado.message}</p>}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 font-bold text-center">{error}</p>}

        <button
          disabled={isSubmitting}
          type="submit"
          className="w-full rounded-full bg-black py-5 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50"
        >
          {isSubmitting ? "Criando Conta..." : "Finalizar Cadastro"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Já tem uma conta?{" "}
        <button onClick={onToggle} className="font-bold text-black underline">Faça Login</button>
      </p>
    </motion.div>
  );
}

function OrdersList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, "pedidos"), where("usuario_id", "==", user.uid));
        const snapshot = await getDocs(q);
        const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(ordersData.sort((a: any, b: any) => {
          const dateA = a.criado_em?.toDate ? a.criado_em.toDate() : 0;
          const dateB = b.criado_em?.toDate ? b.criado_em.toDate() : 0;
          return dateB - dateA;
        }));
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user]);

  if (loading) return <div className="text-center py-12 text-gray-400 animate-pulse">Carregando pedidos...</div>;

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold uppercase tracking-tighter">Meus Pedidos</h2>
      {orders.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 rounded-[40px] space-y-4">
          <Package className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="text-gray-500">Você ainda não realizou nenhum pedido.</p>
          <Link to="/catalogo" className="inline-block rounded-full bg-black px-8 py-3 text-sm font-bold text-white uppercase tracking-widest">
            Ir para a Loja
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div 
              key={order.id} 
              onClick={() => setSelectedOrder(order)}
              className="p-6 rounded-3xl border border-gray-100 flex items-center justify-between hover:border-black transition-colors group cursor-pointer"
            >
              <div className="flex items-center space-x-6">
                <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <Package className="h-6 w-6 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pedido #{order.id.slice(-5)}</p>
                  <p className="text-sm font-bold">
                    {order.criado_em?.toDate ? order.criado_em.toDate().toLocaleDateString('pt-BR') : "Data indisponível"}
                  </p>
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
                    order.status === "pago" || order.status === "entregue" ? "bg-green-100 text-green-700" : 
                    order.status === "cancelado" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {order.status}
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-black transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold uppercase tracking-tighter">Detalhes do Pedido</h3>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">ID: #{selectedOrder.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-8 space-y-12">
                {/* Status and Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status do Pedido</p>
                    <div className="flex items-center space-x-3">
                      <span className={cn(
                        "text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full",
                        selectedOrder.status === "pago" || selectedOrder.status === "entregue" ? "bg-green-100 text-green-700" : 
                        selectedOrder.status === "cancelado" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {selectedOrder.status}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Data da Compra</p>
                    <p className="text-sm font-bold">
                      {selectedOrder.criado_em?.toDate ? selectedOrder.criado_em.toDate().toLocaleString('pt-BR') : "Data indisponível"}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-6">
                  <h4 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Package className="h-4 w-4" /> Itens do Pedido
                  </h4>
                  <div className="space-y-4">
                    {selectedOrder.itens?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center space-x-4 p-4 rounded-2xl bg-gray-50">
                        <div className="h-16 w-16 rounded-xl overflow-hidden bg-white flex-shrink-0">
                          <img src={item.imagem} alt={item.nome} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{item.nome}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                            Tam: {item.tamanho} | Cor: {item.cor} | Qtd: {item.quantidade}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{formatCurrency(item.preco * item.quantidade)}</p>
                          <p className="text-[10px] text-gray-400">{formatCurrency(item.preco)} un.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery and Payment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h4 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Entrega
                    </h4>
                    <div className="text-sm space-y-1">
                      <p className="font-bold">{selectedOrder.cliente?.nome}</p>
                      <p className="text-gray-600">{selectedOrder.endereco?.logradouro}, {selectedOrder.endereco?.numero}</p>
                      {selectedOrder.endereco?.complemento && <p className="text-gray-600">{selectedOrder.endereco.complemento}</p>}
                      <p className="text-gray-600">{selectedOrder.endereco?.bairro}</p>
                      <p className="text-gray-600">{selectedOrder.endereco?.cidade} - {selectedOrder.endereco?.estado}</p>
                      <p className="text-gray-600 font-mono">{selectedOrder.endereco?.cep}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> Pagamento
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Método</p>
                        <p className="text-sm font-bold uppercase">{selectedOrder.metodo_pagamento?.replace('_', ' ')}</p>
                      </div>
                      <div className="pt-4 border-t border-gray-100 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Subtotal</span>
                          <span className="font-bold">{formatCurrency(selectedOrder.total - (selectedOrder.frete_valor || 0))}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Frete ({selectedOrder.frete_modalidade?.toUpperCase()})</span>
                          <span className="font-bold">{formatCurrency(selectedOrder.frete_valor || 0)}</span>
                        </div>
                        <div className="flex justify-between text-base pt-2">
                          <span className="font-bold uppercase tracking-tighter">Total</span>
                          <span className="font-bold text-xl tracking-tighter">{formatCurrency(selectedOrder.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tracking Info if available */}
                {selectedOrder.codigo_rastreamento && (
                  <div className="p-6 rounded-3xl bg-black text-white space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                      <Truck className="h-4 w-4" /> Rastreamento
                    </h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Código</p>
                        <p className="text-lg font-mono font-bold">{selectedOrder.codigo_rastreamento}</p>
                      </div>
                      <button className="px-6 py-2 bg-white text-black rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors">
                        Rastrear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileEdit({ user }: { user: any }) {
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    cpf: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // 1. Try fetching by UID (Standard)
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          console.log("User data fetched by UID:", data);
          setFormData({
            nome: data.nome || user.displayName || "",
            telefone: data.telefone || "",
            cpf: data.cpf || ""
          });
          return;
        }

        // 2. Fallback: Try fetching by Email (in case of UID mismatch)
        if (user.email) {
          const q = query(collection(db, "usuarios"), where("email", "==", user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            console.log("User data fetched by Email fallback:", data);
            setFormData({
              nome: data.nome || user.displayName || "",
              telefone: data.telefone || "",
              cpf: data.cpf || ""
            });
            
            // Optional: Link this UID to the existing document if it's missing the ID
            // But for now, just show the data
            return;
          }
        }

        // 3. No data found: Initialize with Auth defaults
        console.log("No user document found in Firestore for UID or Email.");
        setFormData({
          nome: user.displayName || "",
          telefone: "",
          cpf: ""
        });

      } catch (error) {
        console.error("Error fetching user data:", error);
        try {
          handleFirestoreError(error, OperationType.GET, `usuarios/${user.uid}`);
        } catch (e) {
          // Error already logged
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!formData.nome || !formData.telefone || !formData.cpf) {
        alert("Por favor, preencha todos os campos obrigatórios.");
        return;
      }

      await setDoc(doc(db, "usuarios", user.uid), {
        ...formData,
        email: user.email,
        id: user.uid,
        atualizado_em: serverTimestamp()
      }, { merge: true });

      alert("Dados atualizados com sucesso!");
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Erro ao salvar os dados. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400 animate-pulse">Carregando seus dados...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Meus Dados</h2>
        <p className="text-sm text-gray-500">Mantenha suas informações de contato atualizadas.</p>
      </div>

      <div className="bg-white rounded-[40px] p-8 sm:p-12 max-w-2xl border border-gray-100 shadow-sm">
        <form onSubmit={handleSave} className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Nome Completo</label>
              <input 
                name="nome" 
                type="text" 
                required
                value={formData.nome}
                onChange={handleInputChange}
                className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-6 py-4 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" 
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">E-mail (Não pode ser alterado)</label>
              <input 
                type="email" 
                value={user.email || ""} 
                disabled 
                className="w-full rounded-2xl border border-gray-100 bg-gray-100 px-6 py-4 text-sm cursor-not-allowed opacity-60" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Telefone</label>
              <input 
                name="telefone" 
                type="text" 
                required
                value={formData.telefone}
                onChange={handleInputChange}
                className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-6 py-4 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" 
                placeholder="(00) 00000-0000" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">CPF</label>
              <input 
                name="cpf" 
                type="text" 
                required
                value={formData.cpf}
                onChange={handleInputChange}
                className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-6 py-4 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" 
                placeholder="000.000.000-00" 
              />
            </div>
          </div>
          
          <div className="pt-4">
            <button 
              disabled={saving}
              type="submit"
              className="w-full sm:w-auto rounded-full bg-black px-12 py-5 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50 shadow-lg shadow-black/10"
            >
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddressesList() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const { user } = useAuth();

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      principal: false,
      complemento: ""
    }
  });

  const fetchAddresses = async () => {
    if (!user) return;
    try {
      const snapshot = await getDocs(collection(db, "usuarios", user.uid, "enderecos"));
      setAddresses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching addresses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, [user]);

  const handleEdit = (addr: any) => {
    setEditingAddress(addr);
    setValue("cep", addr.cep);
    setValue("logradouro", addr.logradouro);
    setValue("numero", addr.numero);
    setValue("complemento", addr.complemento || "");
    setValue("bairro", addr.bairro);
    setValue("cidade", addr.cidade);
    setValue("estado", addr.estado);
    setValue("principal", addr.principal || false);
    setIsModalOpen(true);
  };

  const handleDelete = async (addrId: string) => {
    if (!user || !confirm("Tem certeza que deseja excluir este endereço?")) return;
    try {
      await deleteDoc(doc(db, "usuarios", user.uid, "enderecos", addrId));
      setAddresses(prev => prev.filter(a => a.id !== addrId));
      alert("Endereço excluído com sucesso!");
    } catch (error) {
      console.error("Error deleting address:", error);
      alert("Erro ao excluir endereço.");
    }
  };

  const onSubmit = async (data: AddressFormData) => {
    if (!user) return;
    try {
      // If setting as principal, unset others
      if (data.principal) {
        const principalAddr = addresses.find(a => a.principal);
        if (principalAddr && principalAddr.id !== editingAddress?.id) {
          await updateDoc(doc(db, "usuarios", user.uid, "enderecos", principalAddr.id), {
            principal: false
          });
        }
      }

      if (editingAddress) {
        await updateDoc(doc(db, "usuarios", user.uid, "enderecos", editingAddress.id), {
          ...data,
          atualizado_em: serverTimestamp()
        });
        alert("Endereço atualizado com sucesso!");
      } else {
        await addDoc(collection(db, "usuarios", user.uid, "enderecos"), {
          ...data,
          id: crypto.randomUUID(),
          criado_em: serverTimestamp()
        });
        alert("Endereço adicionado com sucesso!");
      }
      
      setIsModalOpen(false);
      setEditingAddress(null);
      reset();
      fetchAddresses();
    } catch (error) {
      console.error("Error saving address:", error);
      alert("Erro ao salvar endereço.");
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400 animate-pulse">Carregando endereços...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Meus Endereços</h2>
        <button 
          onClick={() => {
            setEditingAddress(null);
            reset();
            setIsModalOpen(true);
          }}
          className="text-sm font-bold uppercase tracking-widest underline hover:text-gray-500 transition-colors"
        >
          Adicionar novo
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 rounded-[40px] border border-dashed border-gray-200">
          <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Nenhum endereço cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {addresses.map((addr) => (
            <div key={addr.id} className="p-8 rounded-[40px] border border-gray-100 space-y-4 relative hover:border-black transition-all group">
              {addr.principal && (
                <span className="absolute top-8 right-8 text-[10px] font-bold uppercase tracking-widest bg-black text-white px-4 py-1.5 rounded-full">
                  Principal
                </span>
              )}
              <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold">{addr.logradouro}, {addr.numero}</p>
                {addr.complemento && <p className="text-xs text-gray-500">{addr.complemento}</p>}
                <p className="text-xs text-gray-500 mt-1">{addr.bairro}, {addr.cidade} - {addr.estado}</p>
                <p className="text-xs text-gray-500 font-mono">{addr.cep}</p>
              </div>
              <div className="flex space-x-6 pt-4">
                <button 
                  onClick={() => handleEdit(addr)}
                  className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
                >
                  Editar
                </button>
                <button 
                  onClick={() => handleDelete(addr.id)}
                  className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Address Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-2xl font-bold uppercase tracking-tighter">
                  {editingAddress ? "Editar Endereço" : "Novo Endereço"}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto max-h-[70vh]">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">CEP</label>
                      <input {...register("cep")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="00000-000" />
                      {errors.cep && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.cep.message}</p>}
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Logradouro</label>
                      <input {...register("logradouro")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="Rua, Avenida..." />
                      {errors.logradouro && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.logradouro.message}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Número</label>
                      <input {...register("numero")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="123" />
                      {errors.numero && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.numero.message}</p>}
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Complemento</label>
                      <input {...register("complemento")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="Apto, Bloco..." />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Bairro</label>
                      <input {...register("bairro")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="Bairro" />
                      {errors.bairro && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.bairro.message}</p>}
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Cidade</label>
                      <input {...register("cidade")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="Cidade" />
                      {errors.cidade && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.cidade.message}</p>}
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">UF</label>
                      <input {...register("estado")} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-black focus:bg-white focus:outline-none transition-all" placeholder="SP" maxLength={2} />
                      {errors.estado && <p className="mt-1 text-[10px] text-red-500 font-bold">{errors.estado.message}</p>}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input 
                      type="checkbox" 
                      id="principal" 
                      {...register("principal")}
                      className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                    />
                    <label htmlFor="principal" className="text-xs font-bold uppercase tracking-widest text-gray-500">Definir como endereço principal</label>
                  </div>

                  <button
                    disabled={isSubmitting}
                    type="submit"
                    className="w-full rounded-full bg-black py-5 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? "Salvando..." : editingAddress ? "Atualizar Endereço" : "Adicionar Endereço"}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
