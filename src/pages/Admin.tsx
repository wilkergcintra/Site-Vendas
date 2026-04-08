import React, { useState, useEffect, useMemo } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Users, Star, Settings, LogOut, Plus, Search, Filter, MoreHorizontal, ChevronRight, TrendingUp, DollarSign, PackageCheck, AlertCircle, Trash2, X, Image as ImageIcon, Save, ArrowLeft, Calendar, ArrowUp, ArrowDown, Menu } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency, slugify } from "@/src/lib/utils";
import { useAuth } from "@/src/lib/FirebaseProvider";
import { auth, db, OperationType, handleFirestoreError } from "@/src/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, setDoc, writeBatch, deleteDoc, where, onSnapshot, updateDoc } from "firebase/firestore";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import ReactQuill from "react-quill-new";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { GripVertical, Trash, Edit2, Eye, EyeOff, Palette } from "lucide-react";

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

const brandSchema = z.object({
  nome: z.string().min(1, "Nome da marca é obrigatório"),
  descricao: z.string().optional(),
  logo_url: z.string().url("URL de logo inválida").or(z.literal("")).optional(),
  email_contato: z.string().email("E-mail inválido").or(z.literal("")).optional(),
  telefone_contato: z.string().optional(),
  instagram_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  facebook_url: z.string().url("URL inválida").or(z.literal("")).optional(),
});

type BrandFormData = z.infer<typeof brandSchema>;

const categorySchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  slug: z.string().min(1, "Slug é obrigatório"),
  imagem_url: z.string().url("URL de imagem inválida"),
  descricao: z.string().optional(),
  ordem: z.number().int().min(0),
  parent_id: z.string().optional().nullable(),
  ativo: z.boolean(),
  meta_titulo: z.string().optional(),
  meta_descricao: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

const attributeSchema = z.object({
  tipo: z.enum(["tamanho", "cor"]),
  valor: z.string().min(1, "Valor é obrigatório"),
  label: z.string().min(1, "Rótulo é obrigatório"),
  ativo: z.boolean(),
});

type AttributeFormData = z.infer<typeof attributeSchema>;

export default function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [brandConfig, setBrandConfig] = useState<BrandFormData | null>(null);

  useEffect(() => {
    const q = query(collection(db, "config"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        setBrandConfig(querySnapshot.docs[0].data() as BrandFormData);
      }
    }, (error) => {
      console.error("Error listening to brand config:", error);
    });
    return () => unsubscribe();
  }, []);

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
          <Link to="/" className="flex items-center space-x-2 mb-12 group">
            {brandConfig?.logo_url ? (
              <img 
                src={brandConfig.logo_url} 
                alt={brandConfig.nome} 
                className="h-8 w-auto object-contain" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <span className="text-xl font-bold uppercase tracking-tighter">{brandConfig?.nome || "Minha Loja"}</span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 group-hover:text-black transition-colors">Admin</span>
          </Link>
          
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
              to="/admin/categorias"
              className={cn(
                "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
                isActive("categorias") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <Filter className="h-5 w-5" />
              <span>Categorias</span>
            </Link>
            <Link
              to="/admin/atributos"
              className={cn(
                "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
                isActive("atributos") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <Settings className="h-5 w-5" />
              <span>Atributos</span>
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
            <Link
              to="/admin/marca"
              className={cn(
                "flex items-center space-x-3 px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors",
                isActive("marca") ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black"
              )}
            >
              <Settings className="h-5 w-5" />
              <span>Marca</span>
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
          <Route path="categorias" element={<CategoriesManagement />} />
          <Route path="atributos" element={<AttributesManagement />} />
          <Route path="pedidos" element={<OrdersManagement />} />
          <Route path="banners" element={<BannersManagement />} />
          <Route path="menus" element={<MenusManagement />} />
          <Route path="marca" element={<BrandManagement />} />
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
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    totalRevenue: 0,
    pendingOrders: 0,
    newCustomers: 0,
    lowStockItems: 0,
    recentOrders: [] as any[],
    popularProducts: [] as any[],
    revenueTrend: 0,
    ordersTrend: 0,
    customersTrend: 0
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Fetch all orders
        const ordersQuery = query(collection(db, "pedidos"), orderBy("criado_em", "desc"));
        const ordersSnapshot = await getDocs(ordersQuery);
        const allOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        // Fetch all users (customers)
        const usersQuery = query(collection(db, "usuarios"), where("role", "==", "cliente"));
        const usersSnapshot = await getDocs(usersQuery);
        const allCustomers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        // Fetch all products
        const productsQuery = query(collection(db, "produtos"));
        const productsSnapshot = await getDocs(productsQuery);
        const allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        // Filter orders by date range
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);

        const filteredOrders = allOrders.filter((order: any) => {
          const orderDate = order.criado_em?.toDate ? order.criado_em.toDate() : new Date(order.criado_em);
          return orderDate >= startDate && orderDate <= endDate;
        });

        // Calculate Revenue (only paid/delivered orders)
        const revenue = filteredOrders
          .filter((o: any) => ["pago", "enviado", "entregue"].includes(o.status))
          .reduce((acc: number, o: any) => acc + (o.total || 0), 0);

        // Pending Orders
        const pending = allOrders.filter((o: any) => o.status === "aguardando").length;

        // New Customers in period
        const newCustomers = allCustomers.filter((c: any) => {
          const createdDate = c.criado_em?.toDate ? c.criado_em.toDate() : new Date(c.criado_em);
          return createdDate >= startDate && createdDate <= endDate;
        }).length;

        // Low Stock (mocking for now as variations are in subcollections)
        // In a real app, you'd probably have a cloud function or a denormalized field
        const lowStock = 0; 

        // Recent Orders (last 5)
        const recent = allOrders.slice(0, 5).map((order: any) => {
          const customer = allCustomers.find((c: any) => c.id === order.usuario_id);
          return {
            ...order,
            customerName: customer?.nome || "Cliente Desconhecido",
            customerEmail: customer?.email || "N/A"
          };
        });

        // Calculate Popular Products from orders
        const productSales: { [key: string]: number } = {};
        allOrders.forEach((order: any) => {
          if (order.itens) {
            order.itens.forEach((item: any) => {
              productSales[item.produto_id] = (productSales[item.produto_id] || 0) + (item.quantidade || 1);
            });
          }
        });

        const popular = allProducts
          .map(p => ({ ...p, salesCount: productSales[p.id] || 0 }))
          .sort((a, b) => b.salesCount - a.salesCount)
          .slice(0, 3);

        setDashboardData({
          totalRevenue: revenue,
          pendingOrders: pending,
          newCustomers,
          lowStockItems: lowStock,
          recentOrders: recent,
          popularProducts: popular,
          revenueTrend: 12, // Mocking trends
          ordersTrend: -5,
          customersTrend: 8
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [dateRange]);

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
    { name: "Vendas no Período", value: formatCurrency(dashboardData.totalRevenue), icon: DollarSign, trend: `+${dashboardData.revenueTrend}%`, color: "bg-green-100 text-green-600" },
    { name: "Pedidos Pendentes", value: dashboardData.pendingOrders.toString(), icon: ShoppingCart, trend: `${dashboardData.ordersTrend}%`, color: "bg-blue-100 text-blue-600" },
    { name: "Novos Clientes", value: dashboardData.newCustomers.toString(), icon: Users, trend: `+${dashboardData.customersTrend}%`, color: "bg-purple-100 text-purple-600" },
    { name: "Estoque Baixo", value: dashboardData.lowStockItems.toString(), icon: AlertCircle, trend: "Ação Necessária", color: "bg-red-100 text-red-600" },
  ];

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-sm font-bold uppercase tracking-widest text-gray-400 animate-pulse">Carregando Dashboard...</div>
      </div>
    );
  }

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
            {dashboardData.recentOrders.length > 0 ? (
              dashboardData.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xs uppercase">
                      {order.customerName.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{order.customerName}</p>
                      <p className="text-xs text-gray-400">{order.customerEmail}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(order.total)}</p>
                    <p className={cn(
                      "text-[10px] uppercase tracking-widest font-bold",
                      order.status === "pago" || order.status === "entregue" ? "text-green-500" : "text-blue-500"
                    )}>{order.status}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-12 text-gray-400 text-sm">Nenhuma venda recente.</p>
            )}
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-8">
          <h4 className="text-lg font-bold uppercase tracking-tighter">Produtos Populares</h4>
          <div className="space-y-6">
            {dashboardData.popularProducts.length > 0 ? (
              dashboardData.popularProducts.map((product) => (
                <div key={product.id} className="flex items-center space-x-4">
                  <div className="h-16 w-12 rounded-xl bg-gray-100 overflow-hidden">
                    <img src={product.imagens?.[0] || `https://picsum.photos/seed/${product.id}/200/300`} alt={product.nome} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{product.nome}</p>
                    <p className="text-xs text-gray-400 uppercase tracking-widest">{product.categoria}</p>
                    <p className="text-xs font-bold mt-1 text-green-500">{product.salesCount || 0} vendas</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-12 text-gray-400 text-sm">Nenhum produto encontrado.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductsManagement() {
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const [targetCategory, setTargetCategory] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

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

  const fetchCategories = async () => {
    try {
      const q = query(collection(db, "categorias"), where("ativo", "==", true), orderBy("ordem", "asc"));
      const snapshot = await getDocs(q);
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [isAdding, editingProduct]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.slug?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !filterCategory || p.categoria === filterCategory;
      const matchesStatus = filterStatus === "all" || 
                           (filterStatus === "active" && p.ativo) || 
                           (filterStatus === "inactive" && !p.ativo);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchTerm, filterCategory, filterStatus]);

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleBulkMove = async () => {
    if (!targetCategory) return;
    const categoryName = categories.find(c => c.slug === targetCategory)?.nome || targetCategory;
    if (!confirm(`Deseja mover ${selectedProducts.length} produtos para a categoria "${categoryName}"?`)) return;
    
    setIsBulkMoving(true);
    try {
      const batch = writeBatch(db);
      selectedProducts.forEach(productId => {
        const productRef = doc(db, "produtos", productId);
        batch.update(productRef, { 
          categoria: targetCategory,
          atualizado_em: serverTimestamp()
        });
      });
      await batch.commit();
      setSelectedProducts([]);
      setTargetCategory("");
      await fetchProducts();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "produtos_bulk");
    } finally {
      setIsBulkMoving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${selectedProducts.length} produtos? Esta ação é irreversível.`)) return;
    
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      selectedProducts.forEach(productId => {
        batch.delete(doc(db, "produtos", productId));
      });
      await batch.commit();
      setSelectedProducts([]);
      await fetchProducts();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "produtos_bulk");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleProductStatus = async (product: any) => {
    try {
      await updateDoc(doc(db, "produtos", product.id), {
        ativo: !product.ativo,
        atualizado_em: serverTimestamp()
      });
      await fetchProducts();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "produtos_status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
      await deleteDoc(doc(db, "produtos", id));
      await fetchProducts();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "produtos");
    }
  };

  if (isAdding || editingProduct) {
    return (
      <ProductForm 
        product={editingProduct} 
        onCancel={() => {
          setIsAdding(false);
          setEditingProduct(null);
        }} 
        onSuccess={() => {
          setIsAdding(false);
          setEditingProduct(null);
        }} 
      />
    );
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
          className="rounded-full bg-black px-8 py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 flex items-center transition-colors"
        >
          <Plus className="mr-2 h-5 w-5" /> Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden relative">
        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedProducts.length > 0 && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-0 inset-x-0 z-10 bg-black text-white p-4 flex items-center justify-between"
            >
              <div className="flex items-center space-x-6">
                <span className="text-xs font-bold uppercase tracking-widest">{selectedProducts.length} selecionados</span>
                <div className="h-4 w-[1px] bg-gray-700" />
                <div className="flex items-center space-x-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Mover para:</span>
                  <select 
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-white"
                  >
                    <option value="">Selecione...</option>
                    {categories.filter(c => !c.parent_id).map(parent => (
                      <optgroup key={parent.id} label={parent.nome}>
                        <option value={parent.slug}>{parent.nome}</option>
                        {categories.filter(c => c.parent_id === parent.id).map(child => (
                          <option key={child.id} value={child.slug}>
                            &nbsp;&nbsp;— {child.nome}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button 
                    onClick={handleBulkMove}
                    disabled={!targetCategory || isBulkMoving}
                    className="bg-white text-black px-4 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-100 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
                  >
                    {isBulkMoving ? "Movendo..." : "Aplicar"}
                  </button>
                </div>
                <div className="h-4 w-[1px] bg-gray-700" />
                <button 
                  onClick={handleBulkDelete}
                  className="text-red-500 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center"
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Excluir
                </button>
              </div>
              <button onClick={() => setSelectedProducts([])} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar produtos..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-full border border-gray-100 pl-12 pr-6 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" 
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Categoria:</span>
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-full border border-gray-100 px-4 py-2 text-xs focus:border-black focus:outline-none bg-gray-50 uppercase tracking-widest font-bold"
              >
                <option value="">Todas</option>
                {categories.filter(c => !c.parent_id).map(parent => (
                  <optgroup key={parent.id} label={parent.nome}>
                    <option value={parent.slug}>{parent.nome}</option>
                    {categories.filter(c => c.parent_id === parent.id).map(child => (
                      <option key={child.id} value={child.slug}>
                        &nbsp;&nbsp;— {child.nome}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status:</span>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="rounded-full border border-gray-100 px-4 py-2 text-xs focus:border-black focus:outline-none bg-gray-50 uppercase tracking-widest font-bold"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 text-center text-gray-400">Carregando produtos...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-20 text-center text-gray-400">Nenhum produto encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <th className="px-8 py-4 w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-black focus:ring-black"
                    />
                  </th>
                  <th className="px-8 py-4">Produto</th>
                  <th className="px-8 py-4">Categoria</th>
                  <th className="px-8 py-4">Preço</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className={cn(
                    "hover:bg-gray-50/50 transition-colors group",
                    selectedProducts.includes(product.id) && "bg-gray-50"
                  )}>
                    <td className="px-8 py-6">
                      <input 
                        type="checkbox" 
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => toggleSelectProduct(product.id)}
                        className="rounded border-gray-300 text-black focus:ring-black"
                      />
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="h-14 w-12 rounded-xl bg-gray-100 overflow-hidden border border-gray-100">
                          <img 
                            src={product.imagens?.[0] || "https://picsum.photos/seed/placeholder/200/300"} 
                            alt={product.nome} 
                            className="h-full w-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-gray-900 block">{product.nome}</span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest">{product.genero}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm text-gray-500 uppercase tracking-widest text-xs">
                      {categories.find(c => c.slug === product.categoria)?.nome || product.categoria}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(product.preco)}</span>
                        {product.preco_promocional && (
                          <span className="text-[10px] text-green-600 font-bold uppercase tracking-widest">Promo: {formatCurrency(product.preco_promocional)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <button 
                        onClick={() => toggleProductStatus(product)}
                        className={cn(
                          "flex items-center space-x-2 px-3 py-1 rounded-full border transition-colors",
                          product.ativo 
                            ? "bg-green-50 text-green-600 border-green-100 hover:bg-green-100" 
                            : "bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", product.ativo ? "bg-green-500" : "bg-red-500")} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          {product.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </button>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingProduct(product)}
                          className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductForm({ product, onCancel, onSuccess }: { product?: any; onCancel: () => void; onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageInput, setImageInput] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [globalAttributes, setGlobalAttributes] = useState<any[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      const q = query(collection(db, "categorias"), where("ativo", "==", true), orderBy("ordem", "asc"));
      const snapshot = await getDocs(q);
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    const fetchAttributes = async () => {
      const q = query(collection(db, "atributos"), where("ativo", "==", true), orderBy("label", "asc"));
      const snapshot = await getDocs(q);
      setGlobalAttributes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCategories();
    fetchAttributes();
  }, []);

  const { register, control, handleSubmit, formState: { errors }, watch, setValue } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product || {
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

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(images);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setValue("imagens", items);
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    try {
      const productId = product?.id || doc(collection(db, "produtos")).id;
      const slug = slugify(data.nome);

      const productRef = doc(db, "produtos", productId);
      
      await setDoc(productRef, {
        ...data,
        id: productId,
        slug,
        [product ? "atualizado_em" : "criado_em"]: serverTimestamp(),
      }, { merge: true });

      onSuccess();
    } catch (error) {
      handleFirestoreError(error, product ? OperationType.UPDATE : OperationType.WRITE, "produtos");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="p-3 hover:bg-white rounded-full transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h3 className="text-4xl font-bold uppercase tracking-tighter">{product ? "Editar Produto" : "Novo Produto"}</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-8">
          {/* Basic Info */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-8">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-1 bg-black rounded-full" />
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Informações Básicas</h4>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Nome do Produto</label>
                <input {...register("nome")} placeholder="Ex: Tênis Air Max 90" className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                {errors.nome && <p className="text-red-500 text-[10px] mt-1">{errors.nome.message}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Descrição Detalhada</label>
                <div className="rounded-xl overflow-hidden border border-gray-100">
                  <Controller
                    name="descricao"
                    control={control}
                    render={({ field }) => (
                      <ReactQuill 
                        theme="snow" 
                        value={field.value} 
                        onChange={field.onChange}
                        className="bg-gray-50 min-h-[200px]"
                      />
                    )}
                  />
                </div>
                {errors.descricao && <p className="text-red-500 text-[10px] mt-1">{errors.descricao.message}</p>}
              </div>
            </div>
          </div>

          {/* Variations */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-1 bg-black rounded-full" />
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Variações (Tamanho & Cor)</h4>
              </div>
              <button 
                type="button" 
                onClick={() => appendVariation({ tamanho: "", cor: "", estoque: 0, sku: "" })}
                className="text-[10px] font-bold uppercase tracking-widest text-black hover:underline"
              >
                + Adicionar Variação
              </button>
            </div>

            <div className="space-y-4">
              {variationFields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 relative group">
                  <div>
                    <label className="block text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">Tamanho</label>
                    <input {...register(`variacoes.${index}.tamanho`)} placeholder="Ex: 40" className="w-full rounded-lg border border-gray-100 px-3 py-2 text-xs focus:border-black focus:outline-none bg-white" list={`sizes-${index}`} />
                    <datalist id={`sizes-${index}`}>
                      {globalAttributes.filter(a => a.tipo === "tamanho").map(a => (
                        <option key={a.id} value={a.label} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">Cor</label>
                    <input {...register(`variacoes.${index}.cor`)} placeholder="Ex: Preto" className="w-full rounded-lg border border-gray-100 px-3 py-2 text-xs focus:border-black focus:outline-none bg-white" list={`colors-${index}`} />
                    <datalist id={`colors-${index}`}>
                      {globalAttributes.filter(a => a.tipo === "cor").map(a => (
                        <option key={a.id} value={a.label} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">Estoque</label>
                    <input type="number" {...register(`variacoes.${index}.estoque`, { valueAsNumber: true })} className="w-full rounded-lg border border-gray-100 px-3 py-2 text-xs focus:border-black focus:outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">SKU</label>
                    <input {...register(`variacoes.${index}.sku`)} placeholder="SKU-001" className="w-full rounded-lg border border-gray-100 px-3 py-2 text-xs focus:border-black focus:outline-none bg-white" />
                  </div>
                  {variationFields.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeVariation(index)}
                      className="absolute -right-2 -top-2 p-1 bg-white text-red-500 rounded-full border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {errors.variacoes && <p className="text-red-500 text-[10px]">{errors.variacoes.message}</p>}
            </div>
          </div>

          {/* Images */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-8">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-1 bg-black rounded-full" />
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Fotos do Produto</h4>
            </div>

            <div className="space-y-6">
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  placeholder="Cole a URL da imagem aqui..." 
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" 
                />
                <button 
                  type="button" 
                  onClick={addImage}
                  className="bg-black text-white px-6 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
                >
                  Adicionar
                </button>
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="images" direction="horizontal">
                  {(provided) => (
                    <div 
                      {...provided.droppableProps} 
                      ref={provided.innerRef}
                      className="flex flex-wrap gap-4"
                    >
                      {images.map((url, index) => (
                        <Draggable key={url} draggableId={url} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="relative h-32 w-24 rounded-xl bg-gray-100 border border-gray-100 overflow-hidden group"
                            >
                              <img src={url} alt={`Preview ${index}`} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              <button 
                                type="button" 
                                onClick={() => removeImage(url)}
                                className="absolute top-1 right-1 p-1 bg-white/80 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash className="h-3 w-3" />
                              </button>
                              <div className="absolute bottom-0 inset-x-0 bg-black/50 text-[8px] text-white text-center py-0.5 font-bold uppercase tracking-widest">
                                {index === 0 ? "Capa" : `#${index + 1}`}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              {errors.imagens && <p className="text-red-500 text-[10px]">{errors.imagens.message}</p>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          {/* Status & Category */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-8">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Status</span>
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

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Categoria</label>
                <select {...register("categoria")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50">
                  <option value="">Selecione...</option>
                  {categories.filter(c => !c.parent_id).map(parent => (
                    <optgroup key={parent.id} label={parent.nome}>
                      <option value={parent.slug}>{parent.nome}</option>
                      {categories.filter(c => c.parent_id === parent.id).map(child => (
                        <option key={child.id} value={child.slug}>
                          &nbsp;&nbsp;— {child.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {errors.categoria && <p className="text-red-500 text-[10px] mt-1">{errors.categoria.message}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Gênero</label>
                <select {...register("genero")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50">
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="unissex">Unissex</option>
                </select>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-1 bg-black rounded-full" />
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Preços</h4>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Preço de Venda (R$)</label>
                <input type="number" step="0.01" {...register("preco", { valueAsNumber: true })} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                {errors.preco && <p className="text-red-500 text-[10px] mt-1">{errors.preco.message}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Preço Promocional (Opcional)</label>
                <input type="number" step="0.01" {...register("preco_promocional", { valueAsNumber: true })} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              </div>
            </div>
          </div>

          {/* Logistics */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-1 bg-black rounded-full" />
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Logística</h4>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Peso (Gramas)</label>
                <input type="number" {...register("peso", { valueAsNumber: true })} placeholder="Ex: 500" className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                {errors.peso && <p className="text-red-500 text-[10px] mt-1">{errors.peso.message}</p>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">Comp. (cm)</label>
                  <input type="number" {...register("dimensoes.comprimento", { valueAsNumber: true })} className="w-full rounded-lg border border-gray-100 px-2 py-2 text-xs focus:border-black focus:outline-none bg-gray-50" />
                </div>
                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">Larg. (cm)</label>
                  <input type="number" {...register("dimensoes.largura", { valueAsNumber: true })} className="w-full rounded-lg border border-gray-100 px-2 py-2 text-xs focus:border-black focus:outline-none bg-gray-50" />
                </div>
                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">Alt. (cm)</label>
                  <input type="number" {...register("dimensoes.altura", { valueAsNumber: true })} className="w-full rounded-lg border border-gray-100 px-2 py-2 text-xs focus:border-black focus:outline-none bg-gray-50" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center disabled:bg-gray-400"
            >
              <Save className="mr-2 h-5 w-5" />
              {isSubmitting ? "Salvando..." : product ? "Atualizar Produto" : "Salvar Produto"}
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
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const q = query(collection(db, "pedidos"), orderBy("criado_em", "desc"));
        const querySnapshot = await getDocs(q);
        const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch user info for each order
        const usersSnapshot = await getDocs(collection(db, "usuarios"));
        const usersData = usersSnapshot.docs.reduce((acc: any, doc) => {
          acc[doc.id] = doc.data();
          return acc;
        }, {});

        const enrichedOrders = ordersData.map((order: any) => ({
          ...order,
          customerName: usersData[order.usuario_id]?.nome || "Cliente Desconhecido",
          customerEmail: usersData[order.usuario_id]?.email || "N/A"
        }));

        setOrders(enrichedOrders);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  return (
    <div className="space-y-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Gestão</h2>
          <h3 className="text-4xl font-bold uppercase tracking-tighter">Pedidos</h3>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-20 text-center text-gray-400">Carregando pedidos...</div>
        ) : orders.length === 0 ? (
          <div className="p-20 text-center text-gray-400">Nenhum pedido encontrado.</div>
        ) : (
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
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-6 text-sm font-bold text-gray-900">#{order.id.slice(-6).toUpperCase()}</td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">{order.customerName}</span>
                      <span className="text-xs text-gray-400">{order.customerEmail}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm text-gray-500">
                    {order.criado_em?.toDate ? order.criado_em.toDate().toLocaleDateString('pt-BR') : new Date(order.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-8 py-6 text-sm font-bold text-gray-900">{formatCurrency(order.total)}</td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full",
                      order.status === "pago" ? "bg-green-100 text-green-700" :
                      order.status === "aguardando" ? "bg-yellow-100 text-yellow-700" :
                      order.status === "enviado" ? "bg-blue-100 text-blue-700" :
                      order.status === "entregue" ? "bg-gray-100 text-gray-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {order.status}
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
        )}
      </div>
    </div>
  );
}

function AttributesManagement() {
  const [attributes, setAttributes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAttribute, setEditingAttribute] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);

  const fetchAttributes = async () => {
    try {
      const q = query(collection(db, "atributos"), orderBy("tipo", "asc"), orderBy("label", "asc"));
      const querySnapshot = await getDocs(q);
      const attributesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttributes(attributesData);
    } catch (error) {
      console.error("Error fetching attributes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttributes();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este atributo?")) return;
    try {
      await deleteDoc(doc(db, "atributos", id));
      fetchAttributes();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `atributos/${id}`);
    }
  };

  const handleToggleStatus = async (attribute: any) => {
    try {
      await updateDoc(doc(db, "atributos", attribute.id), { ativo: !attribute.ativo });
      fetchAttributes();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `atributos/${attribute.id}`);
    }
  };

  if (isAdding || editingAttribute) {
    return (
      <AttributeForm 
        attribute={editingAttribute} 
        onCancel={() => { setIsAdding(false); setEditingAttribute(null); }} 
        onSuccess={() => { setIsAdding(false); setEditingAttribute(null); fetchAttributes(); }} 
      />
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Gestão</h2>
          <h3 className="text-4xl font-bold uppercase tracking-tighter">Atributos Globais</h3>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="rounded-full bg-black px-8 py-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-gray-800 flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" /> Novo Atributo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Tamanhos */}
        <div className="space-y-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center">
            <Package className="mr-2 h-4 w-4" /> Tamanhos
          </h4>
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <th className="px-6 py-4">Rótulo</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attributes.filter(a => a.tipo === "tamanho").map((attr) => (
                  <tr key={attr.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold">{attr.label}</td>
                    <td className="px-6 py-4 text-xs text-gray-400 font-mono">{attr.valor}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleToggleStatus(attr)}
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                          attr.ativo ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                        )}
                      >
                        {attr.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingAttribute(attr)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                          <Edit2 className="h-4 w-4 text-gray-400" />
                        </button>
                        <button onClick={() => handleDelete(attr.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cores */}
        <div className="space-y-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center">
            <Palette className="mr-2 h-4 w-4" /> Cores
          </h4>
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <th className="px-6 py-4">Cor</th>
                  <th className="px-6 py-4">Rótulo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attributes.filter(a => a.tipo === "cor").map((attr) => (
                  <tr key={attr.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-6 w-6 rounded-full border border-gray-100" style={{ backgroundColor: attr.valor }} />
                        <span className="text-xs font-mono text-gray-400">{attr.valor}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">{attr.label}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleToggleStatus(attr)}
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                          attr.ativo ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                        )}
                      >
                        {attr.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingAttribute(attr)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                          <Edit2 className="h-4 w-4 text-gray-400" />
                        </button>
                        <button onClick={() => handleDelete(attr.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttributeForm({ attribute, onCancel, onSuccess }: { attribute?: any, onCancel: () => void, onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<AttributeFormData>({
    resolver: zodResolver(attributeSchema),
    defaultValues: attribute || {
      tipo: "tamanho",
      valor: "",
      label: "",
      ativo: true,
    }
  });

  const tipo = watch("tipo");

  const onSubmit = async (data: AttributeFormData) => {
    setIsSubmitting(true);
    try {
      if (attribute?.id) {
        await updateDoc(doc(db, "atributos", attribute.id), {
          ...data,
          atualizado_em: serverTimestamp(),
        });
      } else {
        const newAttrRef = doc(collection(db, "atributos"));
        await setDoc(newAttrRef, {
          ...data,
          id: newAttrRef.id,
          criado_em: serverTimestamp(),
        });
      }
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, attribute?.id ? OperationType.UPDATE : OperationType.CREATE, "atributos");
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
        <h3 className="text-4xl font-bold uppercase tracking-tighter">{attribute ? "Editar Atributo" : "Novo Atributo"}</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded-3xl border border-gray-100 space-y-8">
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Tipo de Atributo</label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setValue("tipo", "tamanho")}
                className={cn(
                  "flex-1 py-3 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all",
                  tipo === "tamanho" ? "bg-black text-white border-black" : "bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100"
                )}
              >
                Tamanho
              </button>
              <button
                type="button"
                onClick={() => setValue("tipo", "cor")}
                className={cn(
                  "flex-1 py-3 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all",
                  tipo === "cor" ? "bg-black text-white border-black" : "bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100"
                )}
              >
                Cor
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              {tipo === "cor" ? "Nome da Cor (Ex: Preto)" : "Rótulo (Ex: 40, P, M, G)"}
            </label>
            <input {...register("label")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
            {errors.label && <p className="text-red-500 text-[10px] mt-1">{errors.label.message}</p>}
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              {tipo === "cor" ? "Valor Hexadecimal (Ex: #000000)" : "Valor (Geralmente igual ao rótulo)"}
            </label>
            <div className="flex space-x-2">
              <input {...register("valor")} className="flex-1 rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              {tipo === "cor" && (
                <input 
                  type="color" 
                  value={watch("valor").startsWith("#") ? watch("valor") : "#000000"}
                  onChange={(e) => setValue("valor", e.target.value)}
                  className="h-12 w-12 rounded-xl border border-gray-100 p-1 bg-gray-50 cursor-pointer" 
                />
              )}
            </div>
            {errors.valor && <p className="text-red-500 text-[10px] mt-1">{errors.valor.message}</p>}
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Atributo Ativo</span>
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

        <div className="pt-4 space-y-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center disabled:bg-gray-400"
          >
            <Save className="mr-2 h-5 w-5" />
            {isSubmitting ? "Salvando..." : "Salvar Atributo"}
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
  const [categories, setCategories] = useState<any[]>([]);

  const parentMenus = allMenus.filter(m => !m.parentId && m.id !== menu?.id);

  useEffect(() => {
    const fetchCategories = async () => {
      const q = query(collection(db, "categorias"), where("ativo", "==", true), orderBy("ordem", "asc"));
      const snapshot = await getDocs(q);
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCategories();
  }, []);

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
            <div className="space-y-2">
              <select 
                value={watch("url")}
                onChange={(e) => setValue("url", e.target.value)}
                className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50 appearance-none"
              >
                <option value="">Selecione um destino...</option>
                <optgroup label="Páginas Principais">
                  <option value="/">Página Inicial</option>
                  <option value="/catalogo">Todos os Produtos</option>
                </optgroup>
                <optgroup label="Categorias">
                  {categories.filter(c => !c.parent_id).map(parent => (
                    <React.Fragment key={parent.id}>
                      <option value={`/catalogo?categoria=${parent.slug}`}>{parent.nome}</option>
                      {categories.filter(c => c.parent_id === parent.id).map(child => (
                        <option key={child.id} value={`/catalogo?categoria=${child.slug}`}>
                          &nbsp;&nbsp;— {child.nome}
                        </option>
                      ))}
                    </React.Fragment>
                  ))}
                </optgroup>
                <option value="custom">Outro (Digitar Manualmente)</option>
              </select>
              
              {(watch("url") === "custom" || (!["/", "/catalogo"].includes(watch("url")) && !watch("url").startsWith("/catalogo?categoria="))) && (
                <input 
                  {...register("url")} 
                  placeholder="Ex: /contato ou https://..." 
                  className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" 
                />
              )}
            </div>
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

function BrandManagement() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BrandFormData>({
    resolver: zodResolver(brandSchema),
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const q = query(collection(db, "config"));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0];
          setConfigId(docData.id);
          reset(docData.data() as BrandFormData);
        }
      } catch (error) {
        console.error("Error fetching brand config:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, [reset]);

  const onSubmit = async (data: BrandFormData) => {
    setIsSubmitting(true);
    try {
      const configRef = configId ? doc(db, "config", configId) : doc(collection(db, "config"));
      await setDoc(configRef, {
        ...data,
        atualizado_em: serverTimestamp(),
      }, { merge: true });
      
      if (!configId) setConfigId(configRef.id);
      alert("Configurações da marca salvas com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "config");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-20 text-center text-gray-400">Carregando configurações...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Configurações</h2>
        <h3 className="text-4xl font-bold uppercase tracking-tighter">Identidade da Marca</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6 md:col-span-2">
          <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Informações Gerais</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Nome da Marca</label>
              <input {...register("nome")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              {errors.nome && <p className="text-red-500 text-[10px] mt-1">{errors.nome.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Descrição da Marca (Footer)</label>
              <textarea {...register("descricao")} rows={3} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">URL do Logo (Opcional)</label>
              <input {...register("logo_url")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              {errors.logo_url && <p className="text-red-500 text-[10px] mt-1">{errors.logo_url.message}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Contato</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">E-mail de Contato</label>
              <input {...register("email_contato")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              {errors.email_contato && <p className="text-red-500 text-[10px] mt-1">{errors.email_contato.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Telefone de Contato</label>
              <input {...register("telefone_contato")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Redes Sociais</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Instagram URL</label>
              <input {...register("instagram_url")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              {errors.instagram_url && <p className="text-red-500 text-[10px] mt-1">{errors.instagram_url.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Facebook URL</label>
              <input {...register("facebook_url")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              {errors.facebook_url && <p className="text-red-500 text-[10px] mt-1">{errors.facebook_url.message}</p>}
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:bg-gray-400 flex items-center justify-center"
          >
            <Save className="mr-2 h-5 w-5" />
            {isSubmitting ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CategoriesManagement() {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, "categorias"), orderBy("ordem", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(items);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "categorias");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    try {
      await deleteDoc(doc(db, "categorias", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "categorias");
    }
  };

  if (isAdding || editingCategory) {
    return (
      <CategoryForm
        category={editingCategory}
        onCancel={() => {
          setIsAdding(false);
          setEditingCategory(null);
        }}
        onSuccess={() => {
          setIsAdding(false);
          setEditingCategory(null);
        }}
        currentCount={categories.length}
        allCategories={categories}
      />
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Gestão</h2>
          <h3 className="text-4xl font-bold uppercase tracking-tighter">Categorias / Catálogos</h3>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center space-x-2 bg-black text-white px-8 py-4 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nova Categoria</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoading ? (
          <div className="col-span-full py-20 text-center text-gray-400">Carregando categorias...</div>
        ) : categories.map((cat) => (
          <div key={cat.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden group">
            <div className="aspect-[16/9] relative bg-gray-100">
              <img src={cat.imagem_url} alt={cat.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                <button
                  onClick={() => setEditingCategory(cat)}
                  className="p-3 bg-white rounded-full hover:bg-gray-100 transition-colors"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(cat.id)}
                  className="p-3 bg-white text-red-500 rounded-full hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              {!cat.ativo && (
                <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Inativo
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-lg font-bold uppercase tracking-tighter">{cat.nome}</h4>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ordem: {cat.ordem}</span>
              </div>
              {cat.parent_id && (
                <div className="mb-2">
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-gray-400 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                    Sub de: {categories.find(c => c.id === cat.parent_id)?.nome || "Categoria Pai"}
                  </span>
                </div>
              )}
              <p className="text-xs text-gray-500 line-clamp-2">{cat.descricao || "Sem descrição"}</p>
              <div className="flex items-center justify-between mt-4">
                <p className="text-[10px] text-gray-400 font-mono">{cat.slug}</p>
                <div className="flex items-center space-x-2">
                  <span className={cn("text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border", cat.meta_titulo ? "bg-green-50 text-green-600 border-green-100" : "bg-gray-50 text-gray-400 border-gray-100")}>
                    Title
                  </span>
                  <span className={cn("text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border", cat.meta_descricao ? "bg-green-50 text-green-600 border-green-100" : "bg-gray-50 text-gray-400 border-gray-100")}>
                    Desc
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {categories.length === 0 && !isLoading && (
          <div className="col-span-full bg-white p-20 rounded-3xl border border-dashed border-gray-200 text-center space-y-4">
            <ImageIcon className="h-12 w-12 text-gray-200 mx-auto" />
            <p className="text-gray-400 font-medium">Nenhuma categoria cadastrada.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryForm({ category, onCancel, onSuccess, currentCount, allCategories }: { category?: any, onCancel: () => void, onSuccess: () => void, currentCount: number, allCategories: any[] }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: category || {
      nome: "",
      slug: "",
      imagem_url: "",
      descricao: "",
      ativo: true,
      ordem: currentCount,
      parent_id: null,
      meta_titulo: "",
      meta_descricao: "",
    }
  });

  // Filter out the current category from the parent list to avoid self-referencing
  const parentOptions = allCategories.filter(c => c.id !== category?.id && !c.parent_id);

  const onSubmit = async (data: CategoryFormData) => {
    setIsSubmitting(true);
    try {
      if (category?.id) {
        await setDoc(doc(db, "categorias", category.id), {
          ...data,
          atualizado_em: serverTimestamp(),
        }, { merge: true });
      } else {
        const newCatRef = doc(collection(db, "categorias"));
        await setDoc(newCatRef, {
          ...data,
          id: newCatRef.id,
          criado_em: serverTimestamp(),
        });
      }
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, category?.id ? OperationType.UPDATE : OperationType.CREATE, "categorias");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nome = e.target.value;
    setValue("nome", nome);
    if (!category) {
      setValue("slug", slugify(nome));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12">
      <div className="flex items-center space-x-4">
        <button onClick={onCancel} className="p-3 hover:bg-white rounded-full transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h3 className="text-4xl font-bold uppercase tracking-tighter">{category ? "Editar Categoria" : "Nova Categoria"}</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded-3xl border border-gray-100 space-y-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Nome da Categoria</label>
              <input {...register("nome")} onChange={handleNomeChange} placeholder="Ex: Tênis de Corrida" className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              {errors.nome && <p className="text-red-500 text-[10px] mt-1">{errors.nome.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Slug (URL)</label>
              <input {...register("slug")} placeholder="Ex: tenis-de-corrida" className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              {errors.slug && <p className="text-red-500 text-[10px] mt-1">{errors.slug.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">URL da Imagem de Capa</label>
              <input {...register("imagem_url")} placeholder="https://exemplo.com/imagem.jpg" className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
              {errors.imagem_url && <p className="text-red-500 text-[10px] mt-1">{errors.imagem_url.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Categoria Pai (Opcional)</label>
              <select {...register("parent_id")} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50">
                <option value="">Nenhuma (Categoria Principal)</option>
                {parentOptions.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nome}</option>
                ))}
              </select>
              <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-widest">Transforme esta categoria em uma subcategoria selecionando um pai.</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Descrição (Opcional)</label>
              <textarea {...register("descricao")} rows={3} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
            </div>

            <div className="md:col-span-2 pt-4 border-t border-gray-100">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">Configurações de SEO</h4>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Meta Título (Opcional)</label>
                  <input {...register("meta_titulo")} placeholder="Título para buscadores" className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                  <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-widest">Recomendado: até 60 caracteres.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Meta Descrição (Opcional)</label>
                  <textarea {...register("meta_descricao")} rows={2} placeholder="Descrição para buscadores" className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
                  <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-widest">Recomendado: até 160 caracteres.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Ordem</label>
              <input type="number" {...register("ordem", { valueAsNumber: true })} className="w-full rounded-xl border border-gray-100 px-4 py-3 text-sm focus:border-black focus:outline-none bg-gray-50" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Categoria Ativa</span>
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
        </div>

        <div className="pt-4 space-y-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center disabled:bg-gray-400"
          >
            <Save className="mr-2 h-5 w-5" />
            {isSubmitting ? "Salvando..." : "Salvar Categoria"}
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
