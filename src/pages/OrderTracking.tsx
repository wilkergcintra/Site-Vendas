import { useState, useEffect } from "react";
import { Search, Package, Truck, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency } from "@/src/lib/utils";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";

const orderStatusSteps = [
  { id: "aguardando", name: "Aguardando Pagamento", icon: Clock },
  { id: "pago", name: "Pagamento Confirmado", icon: CheckCircle2 },
  { id: "separando", name: "Em Separação", icon: Package },
  { id: "enviado", name: "Pedido Enviado", icon: Truck },
  { id: "entregue", name: "Entregue", icon: CheckCircle2 },
];

export default function OrderTracking() {
  const [searchParams] = useSearchParams();
  const [orderIdInput, setOrderIdInput] = useState("");
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const orderRef = doc(db, "pedidos", id.replace("#", ""));
      const orderSnap = await getDoc(orderRef);

      if (orderSnap.exists()) {
        setTrackingData({ id: orderSnap.id, ...orderSnap.data() });
      } else {
        setError("Pedido não encontrado. Verifique o número e tente novamente.");
        setTrackingData(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "pedidos");
      setError("Ocorreu um erro ao buscar o pedido.");
    } finally {
      setIsLoading(false);
    }
  };

  const paymentStatus = searchParams.get("status");

  useEffect(() => {
    const idFromUrl = searchParams.get("orderId");
    if (idFromUrl) {
      setOrderIdInput(idFromUrl);
      fetchOrder(idFromUrl);
    }
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderIdInput) return;
    fetchOrder(orderIdInput);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold uppercase tracking-tighter">Rastrear Pedido</h1>
        <p className="text-gray-500 text-sm mt-2 uppercase tracking-widest">Acompanhe o status da sua entrega em tempo real</p>
      </div>

      {paymentStatus === "success" && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-6 rounded-3xl bg-green-50 border border-green-100 flex items-center space-x-4"
        >
          <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-green-800">Pagamento Recebido!</h3>
            <p className="text-xs text-green-600 mt-1 uppercase tracking-wider">Seu pedido já está sendo processado por nossa equipe.</p>
          </div>
        </motion.div>
      )}

      {paymentStatus === "pending" && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-6 rounded-3xl bg-blue-50 border border-blue-100 flex items-center space-x-4"
        >
          <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center text-white shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-blue-800">Pagamento em Processamento</h3>
            <p className="text-xs text-blue-600 mt-1 uppercase tracking-wider">Estamos aguardando a confirmação do Mercado Pago.</p>
          </div>
        </motion.div>
      )}

      <div className="bg-gray-50 rounded-3xl p-8 mb-12">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              placeholder="Número do pedido (ex: #12345)"
              className="w-full rounded-full border border-gray-200 pl-12 pr-6 py-4 text-sm focus:border-black focus:outline-none bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-full bg-black px-10 py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:bg-gray-400"
          >
            {isLoading ? "Buscando..." : "Rastrear"}
          </button>
        </form>
        {error && (
          <div className="mt-4 flex items-center text-red-500 text-xs font-bold uppercase tracking-widest">
            <AlertCircle className="mr-2 h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      <AnimatePresence>
        {trackingData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-12"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-2xl bg-black text-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pedido</p>
                <p className="text-lg font-bold uppercase tracking-tighter">#{trackingData.id}</p>
              </div>
              <div className="mt-4 sm:mt-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status Atual</p>
                <p className="text-lg font-bold uppercase tracking-tighter">{trackingData.status}</p>
              </div>
            </div>

            <div className="relative space-y-12 pl-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-gray-200">
              {orderStatusSteps.map((status, index) => {
                const Icon = status.icon;
                const isCompleted = orderStatusSteps.findIndex(s => s.id === trackingData.status) >= index;
                const isCurrent = status.id === trackingData.status;

                return (
                  <div key={status.id} className="relative">
                    <div
                      className={cn(
                        "absolute -left-8 top-0 h-6 w-6 rounded-full flex items-center justify-center z-10 transition-colors",
                        isCompleted ? "bg-black text-white" : "bg-white border-2 border-gray-100 text-gray-200"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className={cn("transition-opacity", !isCompleted && "opacity-40")}>
                      <h3 className={cn("text-sm font-bold uppercase tracking-widest", isCurrent && "text-black")}>
                        {status.name}
                        {isCurrent && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                      </h3>
                      {isCompleted && trackingData.criado_em && index === 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(trackingData.criado_em.seconds * 1000).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-8 rounded-3xl border border-gray-100 space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-widest">Detalhes do Pedido</h3>
              <div className="space-y-4">
                {trackingData.itens.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className="flex items-center space-x-4">
                      <img src={item.imagem} alt={item.nome} className="h-10 w-10 rounded object-cover" />
                      <div>
                        <p className="font-bold">{item.nome}</p>
                        <p className="text-xs text-gray-500">Tam: {item.tamanho} | Cor: {item.cor}</p>
                      </div>
                    </div>
                    <p className="font-bold">{formatCurrency(item.preco)} x {item.quantidade}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                <p className="text-sm font-bold uppercase tracking-widest">Total</p>
                <p className="text-lg font-bold">{formatCurrency(trackingData.total)}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
