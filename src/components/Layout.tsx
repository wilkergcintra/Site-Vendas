import { ReactNode, useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShoppingBag, User, Search, Menu, X, ChevronRight, LogOut, ChevronDown } from "lucide-react";
import { useCartStore } from "@/src/store/cartStore";
import { formatCurrency } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/src/lib/FirebaseProvider";
import { auth, db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, where, orderBy, onSnapshot } from "firebase/firestore";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [brandConfig, setBrandConfig] = useState<any>(null);
  const { items, removeItem, updateQuantity, total } = useCartStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    // Menus
    const qMenus = query(
      collection(db, "menus"),
      where("ativo", "==", true),
      orderBy("ordem", "asc")
    );

    const unsubscribeMenus = onSnapshot(qMenus, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenuItems(items);
      setIsMenuLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "menus");
      setIsMenuLoading(false);
    });

    // Brand Config
    const qConfig = query(collection(db, "config"));
    const unsubscribeConfig = onSnapshot(qConfig, (snapshot) => {
      if (!snapshot.empty) {
        setBrandConfig(snapshot.docs[0].data());
      }
    });

    return () => {
      unsubscribeMenus();
      unsubscribeConfig();
    };
  }, []);

  const isAdminPath = location.pathname.startsWith("/admin");

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (isAdminPath) {
    return <div className="min-h-screen bg-white font-sans text-black">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-white font-sans text-black">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setIsMenuOpen(true)}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 lg:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>
              <Link to="/" className="flex items-center space-x-3">
                {brandConfig?.logo_url && (
                  <img src={brandConfig.logo_url} alt={brandConfig.nome} className="h-8 w-auto" referrerPolicy="no-referrer" />
                )}
                <span className="text-xl font-bold tracking-tighter uppercase">{brandConfig?.nome || "Dove Vinha"}</span>
              </Link>
            </div>

            <div className="hidden lg:flex lg:space-x-8">
              {!isMenuLoading && (
                menuItems.length > 0 ? (
                  menuItems.filter(m => !m.parentId).map((item) => {
                    const submenus = menuItems.filter(m => m.parentId === item.id);
                    if (submenus.length > 0) {
                      return (
                        <div key={item.id} className="relative group">
                          <button className="flex items-center space-x-1 text-sm font-medium text-gray-700 hover:text-black uppercase tracking-widest py-6">
                            <span>{item.label}</span>
                            <ChevronDown className="h-3 w-3 transition-transform group-hover:rotate-180" />
                          </button>
                          <div className="absolute left-0 top-full hidden group-hover:block w-48 bg-white border border-gray-100 shadow-xl rounded-xl py-2 z-50">
                            {submenus.map(sub => (
                              <Link 
                                key={sub.id} 
                                to={sub.url} 
                                className="block px-4 py-2 text-xs font-medium text-gray-600 hover:text-black hover:bg-gray-50 uppercase tracking-wider"
                              >
                                {sub.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <Link key={item.id} to={item.url} className="text-sm font-medium text-gray-700 hover:text-black uppercase tracking-widest flex items-center">{item.label}</Link>
                    );
                  })
                ) : (
                  <>
                    <Link to="/catalogo?genero=feminino" className="text-sm font-medium text-gray-700 hover:text-black">Feminino</Link>
                    <Link to="/catalogo?genero=masculino" className="text-sm font-medium text-gray-700 hover:text-black">Masculino</Link>
                    <Link to="/catalogo?categoria=tenis" className="text-sm font-medium text-gray-700 hover:text-black">Tênis</Link>
                    <Link to="/catalogo?categoria=botas" className="text-sm font-medium text-gray-700 hover:text-black">Botas</Link>
                  </>
                )
              )}
            </div>

            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-black">
                <Search className="h-5 w-5" />
              </button>
              <Link to="/cliente" className="p-2 text-gray-400 hover:text-black flex items-center space-x-2">
                {user ? (
                  <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold">
                    {user.displayName ? user.displayName[0] : user.email ? user.email[0] : "U"}
                  </div>
                ) : (
                  <User className="h-5 w-5" />
                )}
              </Link>
              <button
                onClick={() => setIsCartOpen(true)}
                className="group relative p-2 text-gray-400 hover:text-black"
              >
                <ShoppingBag className="h-5 w-5" />
                {items.length > 0 && (
                  <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
                    {items.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-[70] w-full max-w-xs bg-white p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-8">
                <span className="text-lg font-bold uppercase tracking-tighter">Menu</span>
                <button onClick={() => setIsMenuOpen(false)}>
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-6">
                {!isMenuLoading && (
                  menuItems.length > 0 ? (
                    menuItems.filter(m => !m.parentId).map((item) => {
                      const submenus = menuItems.filter(m => m.parentId === item.id);
                      return (
                        <div key={item.id} className="space-y-4">
                          <Link to={item.url} onClick={() => setIsMenuOpen(false)} className="block text-xl font-medium uppercase tracking-tighter">{item.label}</Link>
                          {submenus.length > 0 && (
                            <div className="ml-4 space-y-3 border-l border-gray-100 pl-4">
                              {submenus.map(sub => (
                                <Link 
                                  key={sub.id} 
                                  to={sub.url} 
                                  onClick={() => setIsMenuOpen(false)} 
                                  className="block text-sm font-medium text-gray-500 uppercase tracking-widest"
                                >
                                  {sub.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <>
                      <Link to="/catalogo?genero=feminino" onClick={() => setIsMenuOpen(false)} className="block text-xl font-medium">Feminino</Link>
                      <Link to="/catalogo?genero=masculino" onClick={() => setIsMenuOpen(false)} className="block text-xl font-medium">Masculino</Link>
                      <Link to="/catalogo?categoria=tenis" onClick={() => setIsMenuOpen(false)} className="block text-xl font-medium">Tênis</Link>
                      <Link to="/catalogo?categoria=botas" onClick={() => setIsMenuOpen(false)} className="block text-xl font-medium">Botas</Link>
                    </>
                  )
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 className="text-lg font-bold uppercase tracking-tighter">Carrinho</h2>
                <button onClick={() => setIsCartOpen(false)}>
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-4">
                    <ShoppingBag className="h-12 w-12 text-gray-200" />
                    <p className="text-gray-500">Seu carrinho está vazio</p>
                    <button
                      onClick={() => {
                        setIsCartOpen(false);
                        navigate("/catalogo");
                      }}
                      className="rounded-full bg-black px-8 py-3 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors"
                    >
                      Ver produtos
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {items.map((item) => (
                      <div key={item.variacao_id} className="flex space-x-4">
                        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                          <img src={item.imagem} alt={item.nome} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <div className="flex justify-between text-sm font-medium">
                              <h3>{item.nome}</h3>
                              <p>{formatCurrency(item.preco)}</p>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              Tamanho: {item.tamanho} | Cor: {item.cor}
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center border rounded-md">
                              <button
                                onClick={() => updateQuantity(item.variacao_id, item.quantidade - 1)}
                                className="px-2 py-1 hover:bg-gray-50"
                              >
                                -
                              </button>
                              <span className="px-2">{item.quantidade}</span>
                              <button
                                onClick={() => updateQuantity(item.variacao_id, item.quantidade + 1)}
                                className="px-2 py-1 hover:bg-gray-50"
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => removeItem(item.variacao_id)}
                              className="font-medium text-gray-400 hover:text-black"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="border-t px-6 py-6 space-y-4 bg-gray-50">
                  <div className="flex justify-between text-base font-medium text-gray-900">
                    <p>Subtotal</p>
                    <p>{formatCurrency(total())}</p>
                  </div>
                  <p className="text-xs text-gray-500">Frete e impostos calculados no checkout.</p>
                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      navigate("/checkout");
                    }}
                    className="w-full rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors"
                  >
                    Finalizar Compra
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 mt-20">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <span className="text-xl font-bold tracking-tighter uppercase mb-4 block">{brandConfig?.nome || "Dove Vinha"}</span>
              <p className="text-gray-500 max-w-xs text-sm leading-relaxed">
                {brandConfig?.descricao || "Qualidade premium, design minimalista e conforto absoluto. Dove Vinha é a escolha para quem busca o equilíbrio entre estilo e durabilidade."}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Loja</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                {!isMenuLoading && (
                  menuItems.length > 0 ? (
                    menuItems.filter(m => !m.parentId).map((item) => (
                      <li key={item.id}><Link to={item.url}>{item.label}</Link></li>
                    ))
                  ) : (
                    <>
                      <li><Link to="/catalogo?genero=feminino">Feminino</Link></li>
                      <li><Link to="/catalogo?genero=masculino">Masculino</Link></li>
                      <li><Link to="/catalogo?categoria=tenis">Tênis</Link></li>
                      <li><Link to="/catalogo?categoria=botas">Botas</Link></li>
                    </>
                  )
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Suporte</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/rastreamento">Rastrear Pedido</Link></li>
                <li><Link to="/faq">Perguntas Frequentes</Link></li>
                <li><Link to="/contato">Contato</Link></li>
                <li><Link to="/termos">Termos de Uso</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} {brandConfig?.nome || "Dove Vinha"}. Todos os direitos reservados.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              {/* Payment Icons Placeholder */}
              <div className="h-6 w-10 bg-gray-200 rounded"></div>
              <div className="h-6 w-10 bg-gray-200 rounded"></div>
              <div className="h-6 w-10 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
