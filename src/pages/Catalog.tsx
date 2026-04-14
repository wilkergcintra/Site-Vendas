import { useState, useMemo, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Filter, ChevronDown, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency, slugify } from "@/src/lib/utils";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";

const genders = [
  { id: "masculino", name: "Masculino" },
  { id: "feminino", name: "Feminino" },
  { id: "unissex", name: "Unissex" },
];

const colors = [
  { id: "branco", name: "Branco", hex: "#FFFFFF" },
  { id: "preto", name: "Preto", hex: "#000000" },
  { id: "bege", name: "Bege", hex: "#F5F5DC" },
  { id: "marrom", name: "Marrom", hex: "#8B4513" },
  { id: "cinza", name: "Cinza", hex: "#808080" },
];

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const activeCategory = searchParams.get("categoria");
  const activeGender = searchParams.get("genero");
  const activeColor = searchParams.get("cor");
  const activeSearch = searchParams.get("q");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Categories
        const categoriesQuery = query(collection(db, "categorias"), where("ativo", "==", true), orderBy("ordem", "asc"));
        const categoriesSnapshot = await getDocs(categoriesQuery);
        setCategories(categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch Products
        const q = query(collection(db, "produtos"), where("ativo", "==", true));
        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          slug: doc.data().slug || slugify(doc.data().nome)
        }));
        setProducts(productsData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "catalog_data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (activeCategory && categories.length > 0) {
      const category = categories.find(c => c.slug === activeCategory);
      if (category) {
        document.title = category.meta_titulo || `${category.nome} | Sua Loja`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute("content", category.meta_descricao || category.descricao || "");
        } else {
          const newMeta = document.createElement('meta');
          newMeta.name = "description";
          newMeta.content = category.meta_descricao || category.descricao || "";
          document.head.appendChild(newMeta);
        }
      }
    } else if (activeSearch) {
      document.title = `Busca: ${activeSearch} | Sua Loja`;
    } else {
      document.title = "Catálogo | Sua Loja";
    }
  }, [activeCategory, categories, activeSearch]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeSearch) {
        const searchLower = activeSearch.toLowerCase();
        const matchesName = p.nome.toLowerCase().includes(searchLower);
        const matchesCategory = p.categoria.toLowerCase().includes(searchLower);
        const matchesDescription = p.descricao?.toLowerCase().includes(searchLower);
        
        if (!matchesName && !matchesCategory && !matchesDescription) return false;
      }
      if (activeCategory) {
        const category = categories.find(c => c.slug === activeCategory);
        if (!category) return false;
        
        // If it's a parent category, show products from it and all its children
        const childCategories = categories.filter(c => c.parent_id === category.id);
        const childSlugs = childCategories.map(c => c.slug);
        
        const isMatch = p.categoria.toLowerCase() === activeCategory.toLowerCase() || 
                        childSlugs.some(slug => slug.toLowerCase() === p.categoria.toLowerCase());
        
        if (!isMatch) return false;
      }
      if (activeGender && p.genero.toLowerCase() !== activeGender.toLowerCase() && p.genero.toLowerCase() !== "unissex") return false;
      // Note: Color filtering might need adjustment depending on how colors are stored in Firestore
      // For now, assuming a simple string match
      if (activeColor && p.cor?.toLowerCase() !== activeColor.toLowerCase()) {
        // Check variations if color is not on top level
        const hasColorInVariations = p.variacoes?.some((v: any) => v.cor.toLowerCase() === activeColor.toLowerCase());
        if (!hasColorInVariations) return false;
      }
      return true;
    });
  }, [products, activeCategory, activeGender, activeColor, categories, activeSearch]);

  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-tighter">
            {activeSearch ? `Busca: ${activeSearch}` : "Coleção"}
          </h1>
          <p className="text-gray-500 text-sm mt-2 uppercase tracking-widest">
            {isLoading ? "Carregando..." : `${filteredProducts.length} ${filteredProducts.length === 1 ? "Produto" : "Produtos"} encontrados`}
          </p>
        </div>
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="flex items-center space-x-2 rounded-full border border-gray-200 px-6 py-2 text-sm font-bold uppercase tracking-widest hover:bg-gray-50"
        >
          <Filter className="h-4 w-4" />
          <span>Filtros</span>
          {(activeCategory || activeGender || activeColor) && (
            <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] text-white">
              {[activeCategory, activeGender, activeColor].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-100 mb-12"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 py-8">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Categoria</h3>
                <div className="space-y-4">
                  {categories.filter(c => !c.parent_id).map((parent) => (
                    <div key={parent.id} className="space-y-2">
                      <button
                        onClick={() => updateFilter("categoria", activeCategory === parent.slug ? null : parent.slug)}
                        className={`block text-sm uppercase tracking-tighter ${activeCategory === parent.slug ? "font-bold text-black" : "text-gray-500 hover:text-black"}`}
                      >
                        {parent.nome}
                      </button>
                      
                      {/* Subcategories */}
                      <div className="pl-4 space-y-1 border-l border-gray-100 ml-1">
                        {categories.filter(c => c.parent_id === parent.id).map((child) => (
                          <button
                            key={child.id}
                            onClick={() => updateFilter("categoria", activeCategory === child.slug ? null : child.slug)}
                            className={`block text-xs ${activeCategory === child.slug ? "font-bold text-black" : "text-gray-400 hover:text-black"}`}
                          >
                            {child.nome}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Gênero</h3>
                <div className="space-y-2">
                  {genders.map((gen) => (
                    <button
                      key={gen.id}
                      onClick={() => updateFilter("genero", activeGender === gen.id ? null : gen.id)}
                      className={`block text-sm ${activeGender === gen.id ? "font-bold text-black" : "text-gray-500 hover:text-black"}`}
                    >
                      {gen.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Cor</h3>
                <div className="flex flex-wrap gap-3">
                  {colors.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => updateFilter("cor", activeColor === color.id ? null : color.id)}
                      title={color.name}
                      className={`h-6 w-6 rounded-full border ${activeColor === color.id ? "ring-2 ring-black ring-offset-2" : "border-gray-200"}`}
                      style={{ backgroundColor: color.hex }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black flex items-center"
                >
                  Limpar todos <X className="ml-1 h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-4 animate-pulse">
              <div className="aspect-[3/4] rounded-2xl bg-gray-100" />
              <div className="h-4 w-2/3 bg-gray-100 rounded" />
              <div className="h-4 w-1/3 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
          {filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="group"
            >
              <Link to={`/produto/${product.slug}`} className="block">
                <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-gray-100 mb-6 relative shadow-sm">
                  <img
                    src={product.imagens?.[0] || "https://picsum.photos/seed/placeholder/600/800"}
                    alt={product.nome}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {product.preco_promocional && (
                    <span className="absolute top-4 left-4 rounded-full bg-black text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                      Oferta
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                        {product.categoria}
                      </p>
                      <h4 className="text-lg font-medium text-gray-900 uppercase tracking-tight">{product.nome}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(product.preco_promocional || product.preco)}</p>
                      {product.preco_promocional && (
                        <p className="text-xs text-gray-400 line-through">{formatCurrency(product.preco)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(product.variacoes?.map((v: any) => v.tamanho) || [])).sort().slice(0, 5).map((t: any) => (
                      <span key={t} className="text-[10px] text-gray-400 border border-gray-100 px-1.5 py-0.5 rounded uppercase">{t}</span>
                    ))}
                    {(product.variacoes?.length || 0) > 5 && <span className="text-[10px] text-gray-400">...</span>}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
          <Search className="h-12 w-12 text-gray-200 mb-2" />
          <p className="text-gray-500 max-w-xs">
            {activeSearch 
              ? `Não encontramos nenhum produto para "${activeSearch}". Tente usar termos mais genéricos.`
              : "Nenhum produto encontrado com os filtros selecionados."}
          </p>
          <button onClick={clearFilters} className="text-sm font-bold uppercase tracking-widest underline">
            Limpar Filtros
          </button>
        </div>
      )}
    </div>
  );
}
