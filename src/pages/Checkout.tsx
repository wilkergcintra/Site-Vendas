import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, CreditCard, Truck, MapPin, CheckCircle2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCartStore } from "@/src/store/cartStore";
import { formatCurrency, cn } from "@/src/lib/utils";

const steps = [
  { id: "address", name: "Endereço", icon: MapPin },
  { id: "shipping", name: "Frete", icon: Truck },
  { id: "payment", name: "Pagamento", icon: CreditCard },
];

export default function Checkout() {
  const navigate = useNavigate();
  const { items, total, clearCart } = useCartStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    nome: "",
    sobrenome: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    frete: "pac",
  });

  const [isCEPLoading, setIsCEPLoading] = useState(false);
  const [cepError, setCEPError] = useState("");

  const handleCEPChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, "");
    setFormData({ ...formData, cep });
    setCEPError("");

    if (cep.length === 8) {
      setIsCEPLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (data.erro) {
          setCEPError("CEP não encontrado.");
        } else {
          setFormData((prev) => ({
            ...prev,
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            estado: data.uf,
          }));
        }
      } catch (error) {
        setCEPError("Erro ao buscar CEP.");
        console.error("CEP lookup error:", error);
      } finally {
        setIsCEPLoading(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  if (items.length === 0 && !isFinished) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4">
        <p className="text-gray-500">Seu carrinho está vazio</p>
        <button onClick={() => navigate("/catalogo")} className="text-sm font-bold uppercase tracking-widest underline">
          Voltar para a loja
        </button>
      </div>
    );
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Process payment mock
      setIsFinished(true);
      clearCart();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate(-1);
    }
  };

  if (isFinished) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center space-y-6"
        >
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold uppercase tracking-tighter">Pedido Confirmado!</h1>
          <p className="text-gray-500">
            Obrigado pela sua compra. Você receberá um e-mail com os detalhes do pedido e o código de rastreamento em breve.
          </p>
          <div className="pt-8 space-y-4 w-full">
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors"
            >
              Voltar para a Home
            </button>
            <button
              onClick={() => navigate("/rastreamento")}
              className="w-full rounded-full border border-gray-200 py-4 text-sm font-bold text-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Rastrear Pedido
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Checkout Steps */}
        <div className="lg:col-span-8 space-y-12">
          {/* Progress Bar */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex flex-col items-center flex-1 relative">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all z-10",
                      index <= currentStep ? "bg-black border-black text-white" : "bg-white border-gray-200 text-gray-300"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-[10px] font-bold uppercase tracking-widest",
                      index <= currentStep ? "text-black" : "text-gray-300"
                    )}
                  >
                    {step.name}
                  </span>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "absolute top-5 left-1/2 w-full h-[2px] -z-0",
                        index < currentStep ? "bg-black" : "bg-gray-100"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-gray-50 rounded-3xl p-8">
            <AnimatePresence mode="wait">
              {currentStep === 0 && (
                <motion.div
                  key="address"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold uppercase tracking-tighter">Dados de Entrega</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">E-mail</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none"
                        placeholder="seu@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Nome</label>
                      <input
                        type="text"
                        name="nome"
                        value={formData.nome}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Sobrenome</label>
                      <input
                        type="text"
                        name="sobrenome"
                        value={formData.sobrenome}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">CEP</label>
                      <div className="relative">
                        <input
                          type="text"
                          name="cep"
                          value={formData.cep}
                          onChange={handleCEPChange}
                          maxLength={8}
                          className={cn(
                            "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none",
                            cepError && "border-red-500"
                          )}
                          placeholder="00000000"
                        />
                        {isCEPLoading && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
                          </div>
                        )}
                      </div>
                      {cepError && <p className="mt-1 text-[10px] font-bold text-red-500 uppercase">{cepError}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Logradouro</label>
                      <input
                        type="text"
                        name="logradouro"
                        value={formData.logradouro}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none"
                        placeholder="Rua, Avenida..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Número</label>
                      <input
                        type="text"
                        name="numero"
                        value={formData.numero}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Complemento</label>
                      <input
                        type="text"
                        name="complemento"
                        value={formData.complemento}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none"
                        placeholder="Apto, Bloco..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Bairro</label>
                      <input
                        type="text"
                        name="bairro"
                        value={formData.bairro}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Cidade</label>
                      <input
                        type="text"
                        name="cidade"
                        value={formData.cidade}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Estado</label>
                      <input
                        type="text"
                        name="estado"
                        value={formData.estado}
                        onChange={handleInputChange}
                        maxLength={2}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none uppercase"
                        placeholder="UF"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 1 && (
                <motion.div
                  key="shipping"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold uppercase tracking-tighter">Opções de Frete</h2>
                  <div className="space-y-4">
                    <label className={cn(
                      "flex items-center justify-between p-6 rounded-2xl border-2 cursor-pointer transition-all",
                      formData.frete === "pac" ? "border-black bg-white" : "border-gray-100 bg-gray-50 hover:border-gray-200"
                    )}>
                      <div className="flex items-center">
                        <input type="radio" name="frete" value="pac" checked={formData.frete === "pac"} onChange={() => setFormData({...formData, frete: "pac"})} className="hidden" />
                        <div className="h-5 w-5 rounded-full border-2 border-black flex items-center justify-center mr-4">
                          {formData.frete === "pac" && <div className="h-2 w-2 rounded-full bg-black" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold">Correios PAC</p>
                          <p className="text-xs text-gray-500">7 a 10 dias úteis</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold">R$ 25,50</span>
                    </label>
                    <label className={cn(
                      "flex items-center justify-between p-6 rounded-2xl border-2 cursor-pointer transition-all",
                      formData.frete === "sedex" ? "border-black bg-white" : "border-gray-100 bg-gray-50 hover:border-gray-200"
                    )}>
                      <div className="flex items-center">
                        <input type="radio" name="frete" value="sedex" checked={formData.frete === "sedex"} onChange={() => setFormData({...formData, frete: "sedex"})} className="hidden" />
                        <div className="h-5 w-5 rounded-full border-2 border-black flex items-center justify-center mr-4">
                          {formData.frete === "sedex" && <div className="h-2 w-2 rounded-full bg-black" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold">Correios SEDEX</p>
                          <p className="text-xs text-gray-500">2 a 3 dias úteis</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold">R$ 45,90</span>
                    </label>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold uppercase tracking-tighter">Pagamento</h2>
                  <div className="p-8 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center space-y-4 text-center">
                    <CreditCard className="h-12 w-12 text-gray-300" />
                    <div>
                      <p className="text-sm font-bold">Checkout Seguro Mercado Pago</p>
                      <p className="text-xs text-gray-500 mt-1">Você será redirecionado para o ambiente seguro do Mercado Pago para concluir o pagamento.</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-12 flex space-x-4">
              <button
                onClick={handleBack}
                className="flex-1 rounded-full border border-gray-200 py-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleNext}
                className="flex-1 rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors"
              >
                {currentStep === steps.length - 1 ? "Finalizar Pedido" : "Continuar"}
              </button>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 bg-gray-50 rounded-3xl p-8 space-y-6">
            <h2 className="text-lg font-bold uppercase tracking-tighter">Resumo do Pedido</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {items.map((item) => (
                <div key={item.variacao_id} className="flex space-x-4">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white">
                    <img src={item.imagem} alt={item.nome} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col justify-center">
                    <h3 className="text-xs font-bold">{item.nome}</h3>
                    <p className="text-[10px] text-gray-500">Tam: {item.tamanho} | Qtd: {item.quantidade}</p>
                    <p className="text-xs font-bold mt-1">{formatCurrency(item.preco * item.quantidade)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 pt-6 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <p>Subtotal</p>
                <p>{formatCurrency(total())}</p>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <p>Frete</p>
                <p>{formData.frete === "pac" ? "R$ 25,50" : "R$ 45,90"}</p>
              </div>
              <div className="flex justify-between text-lg font-bold text-black pt-4">
                <p>Total</p>
                <p>{formatCurrency(total() + (formData.frete === "pac" ? 25.50 : 45.90))}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
