import { useState } from "react";
import { Search, Package, Truck, CheckCircle2, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";

const orderStatus = [
  { id: "aguardando", name: "Aguardando Pagamento", icon: Clock, date: "02 Abr 2026, 14:30" },
  { id: "pago", name: "Pagamento Confirmado", icon: CheckCircle2, date: "02 Abr 2026, 14:35" },
  { id: "separando", name: "Em Separação", icon: Package, date: "03 Abr 2026, 09:15" },
  { id: "enviado", name: "Pedido Enviado", icon: Truck, date: "03 Abr 2026, 16:40" },
  { id: "entregue", name: "Entregue", icon: CheckCircle2, date: null },
];

export default function OrderTracking() {
  const [orderId, setOrderId] = useState("");
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;

    setIsLoading(true);
    // Mock search
    setTimeout(() => {
      setTrackingData({
        id: orderId,
        currentStatus: "enviado",
        codigo_rastreio: "BR123456789DV",
        items: [
          { nome: "Tênis Minimalist White", qtd: 1 },
        ],
      });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold uppercase tracking-tighter">Rastrear Pedido</h1>
        <p className="text-gray-500 text-sm mt-2 uppercase tracking-widest">Acompanhe o status da sua entrega em tempo real</p>
      </div>

      <div className="bg-gray-50 rounded-3xl p-8 mb-12">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
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
                <p className="text-lg font-bold uppercase tracking-tighter">{trackingData.id}</p>
              </div>
              <div className="mt-4 sm:mt-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Código de Rastreio</p>
                <p className="text-lg font-bold uppercase tracking-tighter">{trackingData.codigo_rastreio}</p>
              </div>
            </div>

            <div className="relative space-y-12 pl-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-gray-200">
              {orderStatus.map((status, index) => {
                const Icon = status.icon;
                const isCompleted = orderStatus.findIndex(s => s.id === trackingData.currentStatus) >= index;
                const isCurrent = status.id === trackingData.currentStatus;

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
                      {status.date && <p className="text-xs text-gray-500 mt-1">{status.date}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-8 rounded-3xl border border-gray-100 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest">Itens do Pedido</h3>
              {trackingData.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <p className="text-gray-600">{item.nome}</p>
                  <p className="font-bold">Qtd: {item.qtd}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
