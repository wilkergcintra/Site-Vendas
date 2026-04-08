import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ArrowRight, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency, slugify } from "@/src/lib/utils";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, getDocs, query, where, limit, orderBy } from "firebase/firestore";

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Banners
        const bannersQuery = query(
          collection(db, "banners"),
          where("ativo", "==", true),
          orderBy("ordem", "asc"),
          limit(5)
        );
        const bannersSnapshot = await getDocs(bannersQuery);
        const bannersData = bannersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBanners(bannersData);

        // Fetch Categories (Catalogos)
        const categoriesQuery = query(
          collection(db, "categorias"),
          where("ativo", "==", true),
          orderBy("ordem", "asc")
        );
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const categoriesData = categoriesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((cat: any) => !cat.parent_id) // Client-side filter for top-level
          .slice(0, 6);
        setCategories(categoriesData);

        // Fetch Featured Products
        const productsQuery = query(
          collection(db, "produtos"),
          where("ativo", "==", true),
          limit(4)
        );
        const productsSnapshot = await getDocs(productsQuery);
        const productsData = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          slug: doc.data().slug || slugify(doc.data().nome)
        }));
        setProducts(productsData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "home_data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const nextBanner = useCallback(() => {
    if (banners.length === 0) return;
    setCurrentBanner((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevBanner = useCallback(() => {
    if (banners.length === 0) return;
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(nextBanner, 3000);
    return () => clearInterval(interval);
  }, [banners.length, nextBanner]);

  return (
    <div className="space-y-20">
      {/* Hero Section / Banner Carousel */}
      <section className="relative h-[80vh] overflow-hidden bg-gray-100">
        <AnimatePresence mode="wait">
          {banners.length > 0 ? (
            <motion.div
              key={banners[currentBanner].id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <img
                src={banners[currentBanner].imagem_url}
                alt={banners[currentBanner].titulo || "Banner"}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30" />
              
              <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-center px-4 sm:px-6 lg:px-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="max-w-xl text-white"
                >
                  <h1 className="text-5xl font-bold uppercase tracking-tighter sm:text-7xl">
                    {banners[currentBanner].titulo || "Essencial para o seu passo."}
                  </h1>
                  <p className="mt-6 text-lg text-gray-200 leading-relaxed">
                    {banners[currentBanner].subtitulo || "Descubra a nova coleção Dove Vinha. Design minimalista, conforto excepcional e durabilidade premium."}
                  </p>
                  <div className="mt-10 flex space-x-4">
                    <Link
                      to={banners[currentBanner].link || "/catalogo"}
                      className="rounded-full bg-white px-8 py-4 text-sm font-bold text-black uppercase tracking-widest hover:bg-gray-100 transition-colors"
                    >
                      Ver Coleção
                    </Link>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            // Fallback static hero if no banners
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0"
            >
              <img
                src="https://picsum.photos/seed/hero/1920/1080"
                alt="Hero"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30" />
              <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-center px-4 sm:px-6 lg:px-8">
                <div className="max-w-xl text-white">
                  <h1 className="text-5xl font-bold uppercase tracking-tighter sm:text-7xl">
                    Essencial para o seu passo.
                  </h1>
                  <p className="mt-6 text-lg text-gray-200 leading-relaxed">
                    Descubra a nova coleção Dove Vinha. Design minimalista, conforto excepcional e durabilidade premium.
                  </p>
                  <div className="mt-10 flex space-x-4">
                    <Link
                      to="/catalogo"
                      className="rounded-full bg-white px-8 py-4 text-sm font-bold text-black uppercase tracking-widest hover:bg-gray-100 transition-colors"
                    >
                      Ver Coleção
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Carousel Controls */}
        {banners.length > 1 && (
          <>
            <button 
              onClick={prevBanner}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button 
              onClick={nextBanner}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            
            {/* Indicators */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex space-x-2">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentBanner(i)}
                  className={cn(
                    "h-1 rounded-full transition-all",
                    currentBanner === i ? "w-8 bg-white" : "w-2 bg-white/40"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Dynamic Catalogos Section */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Coleções</h2>
              <h3 className="text-4xl font-bold uppercase tracking-tighter">Nossos Catálogos</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <Link key={cat.id} to={`/catalogo?categoria=${cat.slug}`} className="group block">
                <div className="aspect-square overflow-hidden rounded-2xl bg-gray-100 mb-4 relative">
                  <img
                    src={cat.imagem_url}
                    alt={cat.nome}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                  <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
                    <h4 className="text-white text-lg font-bold uppercase tracking-tighter leading-tight">{cat.nome}</h4>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Destaques</h2>
            <h3 className="text-4xl font-bold uppercase tracking-tighter">Mais Vendidos</h3>
          </div>
          <Link to="/catalogo" className="text-sm font-bold uppercase tracking-widest flex items-center hover:underline">
            Ver tudo <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-4 animate-pulse">
                <div className="aspect-[3/4] rounded-2xl bg-gray-100" />
                <div className="h-4 w-2/3 bg-gray-100 rounded" />
                <div className="h-4 w-1/3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
            {products.map((product) => (
              <motion.div
                key={product.id}
                whileHover={{ y: -8 }}
                className="group"
              >
                <Link to={`/produto/${product.slug}`} className="block">
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-gray-100 mb-4 shadow-sm">
                    <img
                      src={product.imagens?.[0] || "https://picsum.photos/seed/placeholder/600/800"}
                      alt={product.nome}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{product.categoria}</p>
                    <h4 className="text-sm font-medium text-gray-900 uppercase tracking-tight">{product.nome}</h4>
                    <p className="text-sm font-bold">{formatCurrency(product.preco_promocional || product.preco)}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhum produto em destaque no momento.</p>
          </div>
        )}
      </section>

      {/* Brand Story / Minimalist Banner */}
      <section className="bg-black py-24 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-xs font-bold uppercase tracking-[0.5em] text-gray-500 mb-8">Nossa Filosofia</h2>
          <p className="text-2xl sm:text-3xl font-light leading-relaxed tracking-tight">
            "Acreditamos que a verdadeira elegância reside na simplicidade. Cada par Dove Vinha é desenhado para durar, não apenas uma estação, mas uma vida inteira de passos significativos."
          </p>
          <div className="mt-12 h-px w-20 bg-gray-800 mx-auto" />
        </div>
      </section>
    </div>
  );
}
