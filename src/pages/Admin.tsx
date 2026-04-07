import { useState, useEffect } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Users, Star, Settings, LogOut, Plus, Search, Filter, MoreHorizontal, ChevronRight, TrendingUp, DollarSign, PackageCheck, AlertCircle, Trash2, X, Image as ImageIcon, Save, ArrowLeft, Calendar, ArrowUp, ArrowDown, Menu } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency, slugify } from "@/src/lib/utils";
import { useAuth } from "@/src/lib/FirebaseProvider";
import { auth, db, OperationType, handleFirestoreError } from "@/src/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, setDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const productSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  categoria: z.string().min(1, "Selecione uma categoria"),
  genero: z.enum(["masculino", "feminino", "unissex"]),
  preco: z.number().min(0.01, "Preço deve ser maior que zero"),
  preco_promocional: z.number().optional(),
  peso: z.number().min(0.01, "Peso deve ser maior que zero"),
  dimensoes: z.object({
    comprimento: z.number().min(1),
    largura: z.number().min(1),
    altura: z.number().min(1),
  }),
  ativo: z.boolean(),
  imagens: z.array(z.string().url("URL de imagem inválida")).min(1, "Adicione pelo menos uma imagem"),
  variacoes: z.array(z.object({
    tamanho: z.string().min(1, "Tamanho obrigatório"),
    cor: z.string().min(1, "Cor obrigatória"),
    estoque: z.number().min(0, "Estoque não pode ser negativo"),
    sku: z.string().min(1, "SKU obrigatório"),
  })).min(1, "Adicione pelo menos uma variação"),
});

type ProductFormData = z.infer<typeof productSchema>;

const bannerSchema = z.object({
  titulo: z.string().optional(),
  subtitulo: z.string().optional(),
  imagem_url: z.string().url("URL de imagem inválida"),
  link: z.string().optional(),
  ativo: z.boolean(),
  ordem: z.number().int().min(0),
});

type BannerFormData = z.infer<typeof bannerSchema>;

const menuSchema = z.object({
  label: z.string().min(1, "Rótulo é obrigatório"),
  url: z.string().min(1, "URL é obrigatória"),
  parentId: z.string().optional().nullable(),
  ativo: z.boolean(),
  ordem: z.number().int().min(0),
});

type MenuFormData = z.infer<typeof menuSchema>;

export default function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      // Check if user is admin (wilkergcintra@gmail.com is hardcoded as admin in rules too)
      if (user.email === "wilkergcintra@gmail.com") {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
  }, [user]);

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
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-sm font-bold uppercase tracking-widest text-gray-400 animate-pulse">
          Carregando...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="bg-white p-12 rounded-3xl shadow-xl max-w-md w-full text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold uppercase tracking-tighter">Painel Admin</h1>
            <p className="text-gray-500">Faça login para gerenciar sua loja.</p>
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
          <button onClick={() => navigate("/")} className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors">
            Voltar para a Loja
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="bg-white p-12 rounded-3xl shadow-xl max-w-md w-full text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold uppercase tracking-tighter text-red-600">Acesso Negado</h1>
            <p className="text-gray-500">Você não tem permissão de administrador.</p>
            <p className="text-xs text-gray-400 font-mono">{user.email}</p>
          </div>
          <div className="space-y-4">
            <button
              onClick={handleLogout}
              className="w-full rounded-full border border-gray-200 py-4 text-sm font-bold text-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Sair da Conta
            </button>
            <button onClick={() => navigate("/")} className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors">
              Voltar para a Loja
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-100 flex flex-col sticky top-0 h-screen">
        <div className="p-8">
          <Link to="/" className="text-xl font-bold uppercase tracking-tighter block mb-12">Dove Vinha <span className="text-xs text-gray-400 ml-2">Admin</span></Link>
          
          <nav className="space-y-2">
            <Link
              to="/admin/dashboard"
              className={cn(
                "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
                isActive("dashboard") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/admin/produtos"
              className={cn(
                "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
                isActive("produtos") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <Package className="h-5 w-5" />
              <span>Produtos</span>
            </Link>
            <Link
              to="/admin/pedidos"
              className={cn(
                "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
                isActive("pedidos") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <ShoppingCart className="h-5 w-5" />
              <span>Pedidos</span>
            </Link>
            <Link
              to="/admin/clientes"
              className={cn(
                "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
                isActive("clientes") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <Users className="h-5 w-5" />
              <span>Clientes</span>
            </Link>
            <Link
              to="/admin/avaliacoes"
              className={cn(
                "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
                isActive("avaliacoes") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <Star className="h-5 w-5" />
              <span>Avaliações</span>
            </Link>
            <Link
              to="/admin/banners"
              className={cn(
                "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
                isActive("banners") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <ImageIcon className="h-5 w-5" />
              <span>Banners</span>
            </Link>
            <Link
              to="/admin/menus"
              className={cn(
                "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
                isActive("menus") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <Menu className="h-5 w-5" />
              <span>Menus</span>
            </Link>
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-gray-100">
          <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors">
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="produtos" element={<ProductsManagement />} />
          <Route path="pedidos" element={<OrdersManagement />} />
          <Route path="banners" element={<BannersManagement />} />
          <Route path="menus" element={<MenusManagement />} />
          <Route path="clientes" element={<div className="text-2xl font-bold uppercase tracking-tighter">Gestão de Clientes</div>} />
          <Route path="avaliacoes" element={<div className="text-2xl font-bold uppercase tracking-tighter">Gestão de Avaliações</div>} />
        </Routes>
      </main>
    </div>
  );
}

function Dashboard() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [activeFilter, setActiveFilter] = useState("7d");
  const [showCustomDate, setShowCustomDate] = useState(false);

  const handleQuickFilter = (filter: string) => {
    setActiveFilter(filter);
    const end = new Date();
    let start = new Date();

    if (filter === "today") {
      start = new Date();
    } else if (filter === "7d") {
      start.setDate(end.getDate() - 7);
    } else if (filter === "30d") {
      start.setDate(end.getDate() - 30);
    } else if (filter === "custom") {
      setShowCustomDate(true);
      return;
    }

    setShowCustomDate(false);
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  };

  const stats = [
    { name: "Vendas no Período", value: "R$ 12.450,00", icon: DollarSign, trend: "+12%", color: "bg-green-100 text-green-600" },
    { name: "Pedidos Pendentes", value: "24", icon: ShoppingCart, trend: "-5%", color: "bg-blue-100 text-blue-600" },
    { name: "Novos Clientes", value: "12", icon: Users, trend: "+8%", color: "bg-purple-100 text-purple-600" },
    { name: "Estoque Baixo", value: "3", icon: AlertCircle, trend: "Ação Necessária", color: "bg-red-100 text-red-600" },
  ];

  return (
    <div className="space-y-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Visão Geral</h2>
          <h3 className="text-4xl font-bold uppercase tracking-tighter">Dashboard</h3>
        </div>
        
        <div className="flex flex-col space-y-4">
          <div className="flex items-center bg-white border border-gray-100 p-1 rounded-full shadow-sm">
            <button 
              onClick={() => handleQuickFilter("today")}
              className={cn(
                "px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                activeFilter === "today" ? "bg-black text-white shadow-md" : "text-gray-400 hover:text-black"
              )}
            >
              Hoje
            </button>
            <button 
              onClick={() => handleQuickFilter("7d")}
              className={cn(
                "px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                activeFilter === "7d" ? "bg-black text-white shadow-md" : "text-gray-400 hover:text-black"
              )}
            >
              7 Dias
            </button>
            <button 
              onClick={() => handleQuickFilter("30d")}
              className={cn(
                "px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                activeFilter === "30d" ? "bg-black text-white shadow-md" : "text-gray-400 hover:text-black"
              )}
            >
              30 Dias
            </button>
            <button 
              onClick={() => handleQuickFilter("custom")}
              className={cn(
                "px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                activeFilter === "custom" ? "bg-black text-white shadow-md" : "text-gray-400 hover:text-black"
              )}
            >
              Personalizado
            </button>
          </div>

          <AnimatePresence>
            {(showCustomDate || activeFilter === "custom") && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center space-x-2 bg-white border border-gray-100 p-4 rounded-3xl shadow-sm"
              >
                <div className="flex flex-col space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400 ml-2">Início</label>
                  <input 
                    type="date" 
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="text-xs font-bold border-0 focus:ring-0 p-0 ml-2"
                  />
                </div>
                <div className="h-8 w-[1px] bg-gray-100" />
                <div className="flex flex-col space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400 ml-2">Fim</label>
                  <input 
                    type="date" 
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="text-xs font-bold border-0 focus:ring-0 p-0 ml-2"
                  />
                </div>
                <Calendar className="h-4 w-4 text-gray-300 ml-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white p-8 rounded-3xl border border-gray-100 space-y-4">
              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", stat.color)}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{stat.name}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <p className={cn("text-[10px] font-bold uppercase tracking-widest", stat.trend.includes("+") ? "text-green-500" : "text-red-500")}>
                {stat.trend} <span className="text-gray-400 font-normal ml-1">vs ontem</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 space-y-8">
          <h4 className="text-lg font-bold uppercase tracking-tighter">Vendas Recentes</h4>
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xs">RM</div>
                  <div>
                    <p className="text-sm font-bold">Ricardo M.</p>
                    <p className="text-xs text-gray-400">ricardo@email.com</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">R$ 299,90</p>
                  <p className="text-[10px] uppercase tracking-widest text-green-500 font-bold">Pago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-8">
          <h4 className="text-lg font-bold uppercase tracking-tighter">Produtos Populares</h4>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-16 w-12 rounded-xl bg-gray-100 overflow-hidden">
                  <img src={`https://picsum.photos/seed/shoe${i}/200/300`} alt="Produto" className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold">Tênis Minimalist {i}</p>
                  <p className="text-xs text-gray-400">124 vendas</p>
                  <p className="text-xs font-bold mt-1 text-green-500">+15%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductsManagement() {
  const [isAdding, setIsAdding] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, "produtos"), orderBy("criado_em", "desc"));
        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, [isAdding]);

  if (isAdding) {
    return <ProductForm onCancel={() => setIsAdding(false)} onSuccess={() => setIsAdding(false)} />;
  }

  return (
    <div className="space-y-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Gestão</h2>
          <h3 className="text-4xl font-bold uppercase tracking-tighter">Produtos</h3>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="rounded-full bg-black px-8 py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 flex items-center"
        >
          <Plus className="mr-2 h-5 w-5" /> Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Buscar produtos..." className="w-full rounded-full border border-gray-100 pl-12 pr-6 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
          </div>
          <div className="flex space-x-4">
            <button className="flex items-center space-x-2 px-6 py-3 rounded-full border border-gray-100 text-xs font-bold uppercase tracking-widest hover:bg-gray-50">
              <Filter className="h-4 w-4" /> <span>Filtros</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 text-center text-gray-400">Carregando produtos...</div>
        ) : products.length === 0 ? (
          <div className="p-20 text-center text-gray-400">Nenhum produto cadastrado.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <th className="px-8 py-4">Produto</th>
                <th className="px-8 py-4">Categoria</th>
                <th className="px-8 py-4">Preço</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-10 rounded-lg bg-gray-100 overflow-hidden">
                        <img src={product.imagens?.[0] || "https://picsum.photos/seed/placeholder/200/300"} alt={product.nome} className="h-full w-full object-cover" />
                      </div>
                      <span className="text-sm font-bold text-gray-900">{product.nome}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm text-gray-500 uppercase tracking-widest text-xs">{product.categoria}</td>
                  <td className="px-8 py-6 text-sm font-bold text-gray-900">{formatCurrency(product.preco)}</td>
                  <td className="px-8 py-6">
                    <span className={cn("inline-block h-2 w-2 rounded-full mr-2", product.ativo ? "bg-green-500" : "bg-red-500")} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-widest", product.ativo ? "text-green-600" : "text-red-600")}>
                      {product.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <button className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ProductForm({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageInput, setImageInput] = useState("");

  const { register, control, handleSubmit, formState: { errors }, watch, setValue } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      genero: "unissex",
      ativo: true,
      imagens: [],
      variacoes: [{ tamanho: "", cor: "", estoque: 0, sku: "" }],
      dimensoes: { comprimento: 0, largura: 0, altura: 0 },
    }
  });

  const { fields: variationFields, append: appendVariation, remove: removeVariation } = useFieldArray({
    control,
    name: "variacoes",
  });

  const images = watch("imagens");

  const addImage = () => {
    if (imageInput && !images.includes(imageInput)) {
      setValue("imagens", [...images, imageInput]);
      setImageInput("");
    }
  };

  const removeImage = (url: string) => {
    setValue("imagens", images.filter(img => img !== url));
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    try {
      const productRef = doc(collection(db, "produtos"));
      const productId = productRef.id;
      const slug = slugify(data.nome);

      const batch = writeBatch(db);

      // Create product document
      batch.set(productRef, {
        ...data,
        id: productId,
        slug,
        criado_em: serverTimestamp(),
      });

      // Create variations subcollection
      data.variacoes.forEach((v) => {
        const varRef = doc(collection(db, `produtos/${productId}/variacoes`));
        batch.set(varRef, {
          ...v,
          id: varRef.id,
          produto_id: productId,
        });
      });

      await batch.commit();
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "produtos");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="flex items-center text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </button>
        <h3 className="text-2xl font-bold uppercase tracking-tighter">Novo Produto</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-8">
          {/* Basic Info */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Informações Básicas</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Nome do Produto</label>
                <input {...register("nome")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                {errors.nome && <p className="text-red-500 text-[10px] mt-1">{errors.nome.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Descrição</label>
                <textarea {...register("descricao")} rows={4} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                {errors.descricao && <p className="text-red-500 text-[10px] mt-1">{errors.descricao.message}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Categoria</label>
                <select {...register("categoria")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50">
                  <option value="">Selecione...</option>
                  <option value="tenis">Tênis</option>
                  <option value="botas">Botas</option>
                  <option value="social">Social</option>
                  <option value="sandalias">Sandálias</option>
                </select>
                {errors.categoria && <p className="text-red-500 text-[10px] mt-1">{errors.categoria.message}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Gênero</label>
                <select {...register("genero")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50">
                  <option value="unissex">Unissex</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                </select>
              </div>
            </div>
          </div>

          {/* Pricing & Logistics */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Preço e Logística</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Preço (R$)</label>
                <input type="number" step="0.01" {...register("preco", { valueAsNumber: true })} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                {errors.preco && <p className="text-red-500 text-[10px] mt-1">{errors.preco.message}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Preço Promocional (R$)</label>
                <input type="number" step="0.01" {...register("preco_promocional", { valueAsNumber: true })} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Peso (kg)</label>
                <input type="number" step="0.01" {...register("peso", { valueAsNumber: true })} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                {errors.peso && <p className="text-red-500 text-[10px] mt-1">{errors.peso.message}</p>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Comp. (cm)</label>
                  <input type="number" {...register("dimensoes.comprimento", { valueAsNumber: true })} className="w-full rounded-xl border border-gray-100 px-2 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Larg. (cm)</label>
                  <input type="number" {...register("dimensoes.largura", { valueAsNumber: true })} className="w-full rounded-xl border border-gray-100 px-2 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Alt. (cm)</label>
                  <input type="number" {...register("dimensoes.altura", { valueAsNumber: true })} className="w-full rounded-xl border border-gray-100 px-2 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                </div>
              </div>
            </div>
          </div>

          {/* Variations */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Variações (Tamanho/Cor)</h4>
              <button type="button" onClick={() => appendVariation({ tamanho: "", cor: "", estoque: 0, sku: "" })} className="text-[10px] font-bold uppercase tracking-widest text-black flex items-center">
                <Plus className="mr-1 h-3 w-3" /> Adicionar Variação
              </button>
            </div>
            <div className="space-y-4">
              {variationFields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 sm:grid-cols-5 gap-4 p-4 rounded-2xl bg-gray-50 relative group">
                  <div>
                    <label className="block text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">Tamanho</label>
                    <input {...register(`variacoes.${index}.tamanho`)} className="w-full rounded-lg border border-gray-100 px-3 py-2 text-xs focus:border-black focus:outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">Cor</label>
                    <input {...register(`variacoes.${index}.cor`)} className="w-full rounded-lg border border-gray-100 px-3 py-2 text-xs focus:border-black focus:outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">Estoque</label>
                    <input type="number" {...register(`variacoes.${index}.estoque`, { valueAsNumber: true })} className="w-full rounded-lg border border-gray-100 px-3 py-2 text-xs focus:border-black focus:outline-none bg-white" />
                  </div>
                  <div className="sm:col-span-2 pr-8">
                    <label className="block text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">SKU</label>
                    <input {...register(`variacoes.${index}.sku`)} className="w-full rounded-lg border border-gray-100 px-3 py-2 text-xs focus:border-black focus:outline-none bg-white" />
                  </div>
                  {variationFields.length > 1 && (
                    <button type="button" onClick={() => removeVariation(index)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {errors.variacoes && <p className="text-red-500 text-[10px]">{errors.variacoes.message}</p>}
            </div>
          </div>
        </div>

        {/* Sidebar Form */}
        <div className="lg:col-span-4 space-y-8">
          {/* Status */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Status</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Produto Ativo</span>
              <button
                type="button"
                onClick={() => setValue("ativo", !watch("ativo"))}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  watch("ativo") ? "bg-black" : "bg-gray-200"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                  watch("ativo") ? "left-7" : "left-1"
                )} />
              </button>
            </div>
          </div>

          {/* Images */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Imagens</h4>
            <div className="space-y-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  placeholder="URL da imagem"
                  className="flex-1 rounded-xl border border-gray-100 px-4 py-3 text-xs focus:border-black focus:outline-none bg-gray-50"
                />
                <button type="button" onClick={addImage} className="p-3 bg-black text-white rounded-xl hover:bg-gray-800">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {images.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                    <img src={url} alt="Preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-5 w-5 text-white" />
                    </button>
                  </div>
                ))}
                {images.length === 0 && (
                  <div className="col-span-2 aspect-video rounded-xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300">
                    <ImageIcon className="h-8 w-8 mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Sem imagens</span>
                  </div>
                )}
              </div>
              {errors.imagens && <p className="text-red-500 text-[10px]">{errors.imagens.message}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center disabled:bg-gray-400"
            >
              <Save className="mr-2 h-5 w-5" />
              {isSubmitting ? "Salvando..." : "Salvar Produto"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-full border border-gray-200 py-4 text-sm font-bold text-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function OrdersManagement() {
  return (
    <div className="space-y-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Gestão</h2>
          <h3 className="text-4xl font-bold uppercase tracking-tighter">Pedidos</h3>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <th className="px-8 py-4">Pedido</th>
              <th className="px-8 py-4">Cliente</th>
              <th className="px-8 py-4">Data</th>
              <th className="px-8 py-4">Total</th>
              <th className="px-8 py-4">Status</th>
              <th className="px-8 py-4">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-8 py-6 text-sm font-bold text-gray-900">#1234{i}</td>
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900">Ricardo M.</span>
                    <span className="text-xs text-gray-400">ricardo@email.com</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-sm text-gray-500">02 Abr 2026</td>
                <td className="px-8 py-6 text-sm font-bold text-gray-900">R$ 299,90</td>
                <td className="px-8 py-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                    Enviado
                  </span>
                </td>
                <td className="px-8 py-6">
                  <button className="flex items-center text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black">
                    Detalhes <ChevronRight className="ml-1 h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BannersManagement() {
  const [banners, setBanners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);

  const fetchBanners = async () => {
    try {
      const q = query(collection(db, "banners"), orderBy("ordem", "asc"));
      const querySnapshot = await getDocs(q);
      const bannersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBanners(bannersData);
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este banner?")) return;
    try {
      await deleteDoc(doc(db, "banners", id));
      fetchBanners();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `banners/${id}`);
    }
  };

  const handleToggleStatus = async (banner: any) => {
    try {
      await setDoc(doc(db, "banners", banner.id), { ...banner, ativo: !banner.ativo });
      fetchBanners();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `banners/${banner.id}`);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newBanners = [...banners];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const temp = newBanners[index];
    newBanners[index] = newBanners[targetIndex];
    newBanners[targetIndex] = temp;

    // Update orders
    const batch = writeBatch(db);
    newBanners.forEach((banner, i) => {
      const bannerRef = doc(db, "banners", banner.id);
      batch.update(bannerRef, { ordem: i });
    });

    try {
      await batch.commit();
      fetchBanners();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "banners");
    }
  };

  if (isAdding || editingBanner) {
    return (
      <BannerForm 
        banner={editingBanner} 
        onCancel={() => { setIsAdding(false); setEditingBanner(null); }} 
        onSuccess={() => { setIsAdding(false); setEditingBanner(null); fetchBanners(); }} 
        currentCount={banners.length}
      />
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Gestão</h2>
          <h3 className="text-4xl font-bold uppercase tracking-tighter">Banners Rotativos</h3>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          disabled={banners.length >= 5}
          className="rounded-full bg-black px-8 py-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" /> Novo Banner {banners.length}/5
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {banners.map((banner, index) => (
          <div key={banner.id} className="bg-white p-6 rounded-3xl border border-gray-100 flex items-center space-x-6 group">
            <div className="flex flex-col space-y-2">
              <button 
                onClick={() => handleMove(index, 'up')}
                disabled={index === 0}
                className="p-2 hover:bg-gray-50 rounded-lg disabled:opacity-20"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button 
                onClick={() => handleMove(index, 'down')}
                disabled={index === banners.length - 1}
                className="p-2 hover:bg-gray-50 rounded-lg disabled:opacity-20"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
            
            <div className="h-24 w-48 rounded-2xl bg-gray-100 overflow-hidden flex-shrink-0">
              <img src={banner.imagem_url} alt={banner.titulo} className="h-full w-full object-cover" />
            </div>

            <div className="flex-1">
              <h4 className="font-bold text-lg">{banner.titulo || "Sem título"}</h4>
              <p className="text-sm text-gray-400">{banner.subtitulo || "Sem subtítulo"}</p>
              <p className="text-[10px] font-mono text-gray-300 mt-1">{banner.link || "Sem link"}</p>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => handleToggleStatus(banner)}
                className={cn(
                  "px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors",
                  banner.ativo ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                )}
              >
                {banner.ativo ? "Ativo" : "Inativo"}
              </button>
              <button onClick={() => setEditingBanner(banner)} className="p-3 hover:bg-gray-50 rounded-xl transition-colors">
                <Settings className="h-5 w-5 text-gray-400" />
              </button>
              <button onClick={() => handleDelete(banner.id)} className="p-3 hover:bg-red-50 rounded-xl transition-colors group/del">
                <Trash2 className="h-5 w-5 text-gray-400 group-hover/del:text-red-500" />
              </button>
            </div>
          </div>
        ))}

        {banners.length === 0 && !isLoading && (
          <div className="bg-white p-20 rounded-3xl border border-dashed border-gray-200 text-center space-y-4">
            <ImageIcon className="h-12 w-12 text-gray-200 mx-auto" />
            <p className="text-gray-400 font-medium">Nenhum banner cadastrado ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BannerForm({ banner, onCancel, onSuccess, currentCount }: { banner?: any, onCancel: () => void, onSuccess: () => void, currentCount: number }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<BannerFormData>({
    resolver: zodResolver(bannerSchema),
    defaultValues: banner || {
      titulo: "",
      subtitulo: "",
      imagem_url: "",
      link: "",
      ativo: true,
      ordem: currentCount,
    }
  });

  const onSubmit = async (data: BannerFormData) => {
    setIsSubmitting(true);
    try {
      if (banner?.id) {
        await setDoc(doc(db, "banners", banner.id), {
          ...data,
          atualizado_em: serverTimestamp(),
        }, { merge: true });
      } else {
        const newBannerRef = doc(collection(db, "banners"));
        await setDoc(newBannerRef, {
          ...data,
          id: newBannerRef.id,
          criado_em: serverTimestamp(),
        });
      }
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, banner?.id ? OperationType.UPDATE : OperationType.CREATE, "banners");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="flex items-center space-x-4">
        <button onClick={onCancel} className="p-3 hover:bg-white rounded-full transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h3 className="text-4xl font-bold uppercase tracking-tighter">{banner ? "Editar Banner" : "Novo Banner"}</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Conteúdo</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Título (Opcional)</label>
                <input {...register("titulo")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Subtítulo (Opcional)</label>
                <input {...register("subtitulo")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Link de Destino (Opcional)</label>
                <input {...register("link")} placeholder="Ex: /produtos/tenis-minimalist" className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Imagem</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">URL da Imagem</label>
                <input {...register("imagem_url")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                {errors.imagem_url && <p className="text-red-500 text-[10px] mt-1">{errors.imagem_url.message}</p>}
              </div>
              {watch("imagem_url") && (
                <div className="aspect-video rounded-2xl overflow-hidden border border-gray-100">
                  <img src={watch("imagem_url")} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Configurações</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Banner Ativo</span>
              <button
                type="button"
                onClick={() => setValue("ativo", !watch("ativo"))}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  watch("ativo") ? "bg-black" : "bg-gray-200"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                  watch("ativo") ? "left-7" : "left-1"
                )} />
              </button>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Ordem de Exibição</label>
              <input type="number" {...register("ordem", { valueAsNumber: true })} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
            </div>
          </div>

          <div className="space-y-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center disabled:bg-gray-400"
            >
              <Save className="mr-2 h-5 w-5" />
              {isSubmitting ? "Salvando..." : "Salvar Banner"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-full border border-gray-200 py-4 text-sm font-bold text-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function MenusManagement() {
  const [menus, setMenus] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingMenu, setEditingMenu] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);

  const fetchMenus = async () => {
    try {
      const q = query(collection(db, "menus"), orderBy("ordem", "asc"));
      const querySnapshot = await getDocs(q);
      const menusData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenus(menusData);
    } catch (error) {
      console.error("Error fetching menus:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este item de menu?")) return;
    try {
      await deleteDoc(doc(db, "menus", id));
      fetchMenus();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `menus/${id}`);
    }
  };

  const handleToggleStatus = async (menu: any) => {
    try {
      await setDoc(doc(db, "menus", menu.id), { ...menu, ativo: !menu.ativo });
      fetchMenus();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `menus/${menu.id}`);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newMenus = [...menus];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= menus.length) return;

    const temp = newMenus[index];
    newMenus[index] = newMenus[targetIndex];
    newMenus[targetIndex] = temp;

    const batch = writeBatch(db);
    newMenus.forEach((menu, i) => {
      const menuRef = doc(db, "menus", menu.id);
      batch.update(menuRef, { ordem: i });
    });

    try {
      await batch.commit();
      fetchMenus();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "menus");
    }
  };

  if (isAdding || editingMenu) {
    return (
      <MenuForm 
        menu={editingMenu} 
        allMenus={menus}
        onCancel={() => { setIsAdding(false); setEditingMenu(null); }} 
        onSuccess={() => { setIsAdding(false); setEditingMenu(null); fetchMenus(); }} 
        currentCount={menus.length}
      />
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Gestão</h2>
          <h3 className="text-4xl font-bold uppercase tracking-tighter">Menus de Navegação</h3>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="rounded-full bg-black px-8 py-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-gray-800 flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" /> Novo Item
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {menus.filter(m => !m.parentId).map((menu, index) => {
          const submenus = menus.filter(m => m.parentId === menu.id);
          return (
            <div key={menu.id} className="space-y-2">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 flex items-center space-x-6">
                <div className="flex flex-col space-y-1">
                  <button 
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="p-1 hover:bg-gray-50 rounded-lg disabled:opacity-20"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === menus.filter(m => !m.parentId).length - 1}
                    className="p-1 hover:bg-gray-50 rounded-lg disabled:opacity-20"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="flex-1">
                  <h4 className="font-bold text-lg uppercase tracking-tighter">{menu.label}</h4>
                  <p className="text-xs font-mono text-gray-400">{menu.url}</p>
                </div>

                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleToggleStatus(menu)}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors",
                      menu.ativo ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                    )}
                  >
                    {menu.ativo ? "Ativo" : "Inativo"}
                  </button>
                  <button onClick={() => setEditingMenu(menu)} className="p-3 hover:bg-gray-50 rounded-xl transition-colors">
                    <Settings className="h-5 w-5 text-gray-400" />
                  </button>
                  <button onClick={() => handleDelete(menu.id)} className="p-3 hover:bg-red-50 rounded-xl transition-colors group/del">
                    <Trash2 className="h-5 w-5 text-gray-400 group-hover/del:text-red-500" />
                  </button>
                </div>
              </div>

              {/* Submenus */}
              {submenus.length > 0 && (
                <div className="ml-12 space-y-2 border-l-2 border-gray-100 pl-6">
                  {submenus.map((sub, subIndex) => (
                    <div key={sub.id} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center space-x-4">
                      <div className="flex-1">
                        <h5 className="font-bold text-sm uppercase tracking-tighter">{sub.label}</h5>
                        <p className="text-[10px] font-mono text-gray-400">{sub.url}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleStatus(sub)}
                          className={cn(
                            "px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest transition-colors",
                            sub.ativo ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                          )}
                        >
                          {sub.ativo ? "Ativo" : "Inativo"}
                        </button>
                        <button onClick={() => setEditingMenu(sub)} className="p-2 hover:bg-white rounded-lg transition-colors">
                          <Settings className="h-4 w-4 text-gray-400" />
                        </button>
                        <button onClick={() => handleDelete(sub.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors group/del">
                          <Trash2 className="h-4 w-4 text-gray-400 group-hover/del:text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {menus.length === 0 && !isLoading && (
          <div className="bg-white p-20 rounded-3xl border border-dashed border-gray-200 text-center space-y-4">
            <ImageIcon className="h-12 w-12 text-gray-200 mx-auto" />
            <p className="text-gray-400 font-medium">Nenhum item de menu cadastrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuForm({ menu, allMenus, onCancel, onSuccess, currentCount }: { menu?: any, allMenus: any[], onCancel: () => void, onSuccess: () => void, currentCount: number }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parentMenus = allMenus.filter(m => !m.parentId && m.id !== menu?.id);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<MenuFormData>({
    resolver: zodResolver(menuSchema),
    defaultValues: menu || {
      label: "",
      url: "",
      parentId: null,
      ativo: true,
      ordem: currentCount,
    }
  });

  const onSubmit = async (data: MenuFormData) => {
    setIsSubmitting(true);
    try {
      if (menu?.id) {
        await setDoc(doc(db, "menus", menu.id), {
          ...data,
          atualizado_em: serverTimestamp(),
        }, { merge: true });
      } else {
        const newMenuRef = doc(collection(db, "menus"));
        await setDoc(newMenuRef, {
          ...data,
          id: newMenuRef.id,
          criado_em: serverTimestamp(),
        });
      }
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, menu?.id ? OperationType.UPDATE : OperationType.CREATE, "menus");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12">
      <div className="flex items-center space-x-4">
        <button onClick={onCancel} className="p-3 hover:bg-white rounded-full transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h3 className="text-4xl font-bold uppercase tracking-tighter">{menu ? "Editar Item" : "Novo Item de Menu"}</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded-3xl border border-gray-100 space-y-8">
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Rótulo (Texto do Menu)</label>
            <input {...register("label")} placeholder="Ex: Feminino" className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
            {errors.label && <p className="text-red-500 text-[10px] mt-1">{errors.label.message}</p>}
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">URL / Link</label>
            <input {...register("url")} placeholder="Ex: /catalogo?genero=feminino" className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
            {errors.url && <p className="text-red-500 text-[10px] mt-1">{errors.url.message}</p>}
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Menu Pai (Opcional)</label>
            <select 
              {...register("parentId")} 
              className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50 appearance-none"
            >
              <option value="">Nenhum (Menu Principal)</option>
              {parentMenus.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Selecione um menu se este for um submenu.</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Item Ativo</span>
            <button
              type="button"
              onClick={() => setValue("ativo", !watch("ativo"))}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative",
                watch("ativo") ? "bg-black" : "bg-gray-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                watch("ativo") ? "left-7" : "left-1"
              )} />
            </button>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Ordem</label>
            <input type="number" {...register("ordem", { valueAsNumber: true })} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
          </div>
        </div>

        <div className="pt-4 space-y-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center disabled:bg-gray-400"
          >
            <Save className="mr-2 h-5 w-5" />
            {isSubmitting ? "Salvando..." : "Salvar Item"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-full border border-gray-200 py-4 text-sm font-bold text-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
