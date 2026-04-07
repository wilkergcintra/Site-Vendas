import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Star, Truck, ShieldCheck, ArrowLeft, Plus, Minus, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency, cn } from "@/src/lib/utils";
import { useCartStore } from "@/src/store/cartStore";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, getDocs, query, where, limit } from "firebase/firestore";

export default function Product() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!slug) return;
      try {
        const q = query(collection(db, "produtos"), where("slug", "==", slug), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          const data = doc.data();
          setProduct({ id: doc.id, ...data });
          
          // Set default color if available
          if (data.variacoes && data.variacoes.length > 0) {
            setSelectedColor(data.variacoes[0].cor);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `produtos/${slug}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm font-bold uppercase tracking-widest text-gray-400 animate-pulse">
          Carregando produto...
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4">
        <p className="text-gray-500">Produto não encontrado</p>
        <button onClick={() => navigate("/catalogo")} className="text-sm font-bold uppercase tracking-widest underline">
          Voltar para a loja
        </button>
      </div>
    );
  }

  const availableSizes = Array.from(new Set(product.variacoes?.filter((v: any) => !selectedColor || v.cor === selectedColor).map((v: any) => v.tamanho) || [])).sort();
  const availableColors = Array.from(new Set(product.variacoes?.map((v: any) => v.cor) || []));

  const handleAddToCart = () => {
    if (!selectedSize) {
      alert("Por favor, selecione um tamanho");
      return;
    }

    setIsAdding(true);
    addItem({
      id: product.id,
      produto_id: product.id,
      variacao_id: `${product.id}-${selectedSize}-${selectedColor}`,
      nome: product.nome,
      tamanho: selectedSize,
      cor: selectedColor || "",
      preco: product.preco_promocional || product.preco,
      quantidade: quantity,
      imagem: product.imagens?.[0] || "",
    });

    setTimeout(() => {
      setIsAdding(false);
    }, 1000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-8 flex items-center text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
        {/* Product Images */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="aspect-[4/5] overflow-hidden rounded-3xl bg-gray-100 shadow-sm"
          >
            <img
              src={product.imagens?.[0] || "https://picsum.photos/seed/placeholder/800/1000"}
              alt={product.nome}
              className="h-full w-full object-cover"
            />
          </motion.div>
          {product.imagens && product.imagens.length > 1 && (
            <div className="grid grid-cols-4 gap-4">
              {product.imagens.map((img: string, i: number) => (
                <div key={i} className="aspect-square overflow-hidden rounded-xl bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity">
                  <img src={img} alt={`Thumbnail ${i}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex flex-col space-y-8">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={cn("h-4 w-4 fill-current", i >= 4 && "text-gray-200")} />
                ))}
              </div>
              <span className="text-xs font-medium text-gray-400">(Novo)</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{product.categoria} | {product.genero}</p>
            <h1 className="text-4xl font-bold uppercase tracking-tighter text-gray-900">{product.nome}</h1>
            <div className="mt-4 flex items-center space-x-4">
              <p className="text-2xl font-bold text-black">{formatCurrency(product.preco_promocional || product.preco)}</p>
              {product.preco_promocional && (
                <p className="text-lg text-gray-400 line-through">{formatCurrency(product.preco)}</p>
              )}
            </div>
          </div>

          <p className="text-gray-600 leading-relaxed text-sm">
            {product.descricao}
          </p>

          {/* Color Selector */}
          {availableColors.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Cor</h3>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((color: any) => (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(color);
                      setSelectedSize(null); // Reset size when color changes
                    }}
                    className={cn(
                      "px-4 py-2 border rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                      selectedColor === color
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-900 border-gray-200 hover:border-black"
                    )}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Selector */}
          {availableSizes.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest">Tamanho</h3>
                <button className="text-xs font-medium text-gray-400 underline">Guia de tamanhos</button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {availableSizes.map((size: any) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={cn(
                      "h-12 border rounded-xl text-sm font-medium transition-all",
                      selectedSize === size
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-900 border-gray-200 hover:border-black"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity and Add to Cart */}
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center justify-between border border-gray-200 rounded-full px-4 h-14 sm:w-32">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 hover:text-black text-gray-400">
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-bold">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="p-2 hover:text-black text-gray-400">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className={cn(
                "flex-1 rounded-full py-4 text-sm font-bold text-white uppercase tracking-widest transition-all h-14 flex items-center justify-center",
                isAdding ? "bg-green-500" : "bg-black hover:bg-gray-800"
              )}
            >
              {isAdding ? (
                "Adicionado!"
              ) : (
                <>
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Adicionar ao Carrinho
                </>
              )}
            </button>
          </div>

          {/* Shipping Simulator */}
          <div className="border-t border-gray-100 pt-8 space-y-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Simular Frete</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="00000-000"
                  className="flex-1 rounded-full border border-gray-200 px-6 py-3 text-sm focus:border-black focus:outline-none"
                />
                <button className="rounded-full bg-gray-100 px-8 py-3 text-sm font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors">
                  Calcular
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3 p-4 rounded-2xl bg-gray-50">
                <Truck className="h-5 w-5 text-gray-400" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest">Entrega Rápida</h4>
                  <p className="text-[10px] text-gray-500 mt-1">Receba em até 3 dias úteis após a postagem.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 rounded-2xl bg-gray-50">
                <ShieldCheck className="h-5 w-5 text-gray-400" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest">Compra Segura</h4>
                  <p className="text-[10px] text-gray-500 mt-1">Garantia de troca e devolução em até 7 dias.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
