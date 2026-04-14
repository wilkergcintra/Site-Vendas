import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Truck, MapPin, CheckCircle2, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCartStore } from "@/src/store/cartStore";
import { formatCurrency, cn } from "@/src/lib/utils";
import { useAuth } from "@/src/lib/FirebaseProvider";
import { db } from "@/src/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";

declare global {
  interface Window { MercadoPago: any; }
}

const steps = [
  { id: "address", name: "Endereço", icon: MapPin },
  { id: "shipping", name: "Frete", icon: Truck },
  { id: "payment", name: "Pagamento", icon: CreditCard },
];

// Busca credenciais salvas pelo admin no Firestore
async function buscarCredenciaisMP(): Promise<{ public_key: string; access_token: string }> {
  const snap = await getDoc(doc(db, "config_pagamentos", "principal"));
  if (!snap.exists()) {
    throw new Error("Configurações de pagamento não encontradas. Configure no painel Admin → Pagamentos.");
  }
  const data = snap.data();
  if (!data.mp_public_key || !data.mp_access_token) {
    throw new Error("Public Key ou Access Token do Mercado Pago não configurados. Acesse Admin → Pagamentos.");
  }
  return { public_key: data.mp_public_key, access_token: data.mp_access_token };
}

// Cria preferência diretamente na API do Mercado Pago (chamada do browser)
async function criarPreferencia(payload: {
  itens: any[];
  frete: { valor: number; modalidade: string };
  cliente: { nome: string; email: string };
  endereco: any;
  pedido_id: string;
  app_url: string;
  access_token: string;
}) {
  const accessToken = payload.access_token;

  if (!accessToken) {
    throw new Error("Access Token do Mercado Pago não configurado.");
  }

  const items = payload.itens.map((item: any) => ({
    id: item.produto_id,
    title: item.nome,
    quantity: item.quantidade,
    unit_price: Number(item.preco),
    currency_id: "BRL",
  }));

  // Frete como item
  if (payload.frete.valor > 0) {
    items.push({
      id: "frete",
      title: payload.frete.modalidade === "pac" ? "Frete - Correios PAC" : "Frete - Correios SEDEX",
      quantity: 1,
      unit_price: Number(payload.frete.valor),
      currency_id: "BRL",
    });
  }

  const body = {
    items,
    payer: {
      name: payload.cliente.nome.split(" ")[0] || "",
      surname: payload.cliente.nome.split(" ").slice(1).join(" ") || "",
      email: payload.cliente.email,
    },
    back_urls: {
      success: `${payload.app_url}/checkout/sucesso`,
      failure: `${payload.app_url}/checkout/falha`,
      pending: `${payload.app_url}/checkout/pendente`,
    },
    auto_return: "approved",
    external_reference: payload.pedido_id,
    payment_methods: { installments: 12 },
    statement_descriptor: "MINHA LOJA",
  };

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.message || `Erro MP: ${response.status}`);
  }

  return response.json();
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, total, clearCart } = useCartStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);
  const brickBuilderRef = useRef<any>(null);

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
    frete_valor: 25.50,
  });

  const [isCEPLoading, setIsCEPLoading] = useState(false);
  const [cepError, setCEPError] = useState("");
  const [shippingOptions, setShippingOptions] = useState([
    { id: "pac", nome: "Correios PAC", valor: 25.50, prazo: "7 a 10 dias úteis" },
    { id: "sedex", nome: "Correios SEDEX", valor: 45.90, prazo: "2 a 3 dias úteis" },
  ]);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);

  // Preenche dados do usuário logado
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        email: user.email || "",
        nome: user.displayName?.split(" ")[0] || "",
        sobrenome: user.displayName?.split(" ").slice(1).join(" ") || "",
      }));
    }
  }, [user]);

  // Carrega SDK do Mercado Pago via CDN
  useEffect(() => {
    if (document.getElementById("mp-sdk")) return;
    const script = document.createElement("script");
    script.id = "mp-sdk";
    script.src = "https://sdk.mercadopago.com/js/v2";
    document.head.appendChild(script);
  }, []);

  // Ao entrar na etapa de pagamento, cria pedido + preferência
  useEffect(() => {
    if (currentStep === 2) iniciarPagamento();
    return () => {
      brickBuilderRef.current?.unmount?.();
      brickBuilderRef.current = null;
    };
  }, [currentStep]);

  // Quando tem preference_id, inicializa o Brick
  useEffect(() => {
    if (preferenceId && currentStep === 2) inicializarBrick(preferenceId);
  }, [preferenceId]);

  const handleCEPChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, "");
    setFormData((f) => ({ ...f, cep }));
    setCEPError("");

    if (cep.length === 8) {
      setIsCEPLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data.erro) {
          setCEPError("CEP não encontrado.");
        } else {
          setFormData((f) => ({
            ...f, cep,
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            estado: data.uf,
          }));
        }
      } catch { setCEPError("Erro ao buscar CEP."); }
      finally { setIsCEPLoading(false); }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
  };

  const calcularFrete = async () => {
    if (!formData.cep || formData.cep.length < 8) return;
    setIsLoadingShipping(true);
    try {
      const res = await fetch("/api/frete/calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep_destino: formData.cep, peso: 500, comprimento: 30, largura: 20, altura: 10 }),
      });
      const data = await res.json();
      if (data.opcoes?.length > 0) {
        setShippingOptions(data.opcoes);
        setFormData((f) => ({ ...f, frete: data.opcoes[0].id, frete_valor: data.opcoes[0].valor }));
      }
    } catch { /* usa valores padrão */ }
    finally { setIsLoadingShipping(false); }
  };

  const iniciarPagamento = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // 0. Busca credenciais do Firestore (salvas pelo admin)
      const credenciais = await buscarCredenciaisMP();

      const userId = user?.uid || `guest_${Date.now()}`;
      const orderTotal = total() + formData.frete_valor;

      // 1. Salva pedido no Firestore com status "aguardando"
      const pedidoRef = await addDoc(collection(db, "pedidos"), {
        usuario_id: userId,
        status: "aguardando",
        total: orderTotal,
        frete_valor: formData.frete_valor,
        frete_modalidade: formData.frete,
        endereco: {
          logradouro: formData.logradouro,
          numero: formData.numero,
          complemento: formData.complemento,
          bairro: formData.bairro,
          cidade: formData.cidade,
          estado: formData.estado,
          cep: formData.cep,
        },
        cliente: {
          nome: `${formData.nome} ${formData.sobrenome}`.trim(),
          email: formData.email,
        },
        itens: items.map((item) => ({
          produto_id: item.produto_id,
          variacao_id: item.variacao_id,
          nome: item.nome,
          quantidade: item.quantidade,
          preco: item.preco,
          tamanho: item.tamanho,
          cor: item.cor,
          imagem: item.imagem,
        })),
        criado_em: serverTimestamp(),
      });

      setPedidoId(pedidoRef.id);

      // 2. Cria preferência diretamente na API do Mercado Pago (do browser)
      const appUrl = window.location.origin;
      const pref = await criarPreferencia({
        pedido_id: pedidoRef.id,
        itens: items.map((i) => ({ ...i })),
        frete: { valor: formData.frete_valor, modalidade: formData.frete },
        cliente: { nome: `${formData.nome} ${formData.sobrenome}`.trim(), email: formData.email },
        endereco: { logradouro: formData.logradouro, numero: formData.numero, cep: formData.cep },
        app_url: appUrl,
        access_token: credenciais.access_token,
      });

      // Guarda public_key para o Brick usar
      setMpPublicKey(credenciais.public_key);
      setPreferenceId(pref.id);
    } catch (err: any) {
      setError(err?.message || "Erro ao iniciar pagamento. Verifique suas credenciais.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inicializarBrick = async (prefId: string) => {
    if (!mpPublicKey) {
      setError("Chave pública do Mercado Pago não encontrada.");
      return;
    }
    const publicKey = mpPublicKey;

    // Aguarda SDK carregar
    let tentativas = 0;
    while (!window.MercadoPago && tentativas < 20) {
      await new Promise((r) => setTimeout(r, 300));
      tentativas++;
    }
    if (!window.MercadoPago) { setError("Falha ao carregar SDK do Mercado Pago."); return; }

    try {
      const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
      const bricksBuilder = mp.bricks();
      brickBuilderRef.current?.unmount?.();

      brickBuilderRef.current = await bricksBuilder.create("payment", "mp-payment-brick", {
        initialization: {
          amount: total() + formData.frete_valor,
          preferenceId: prefId,
          payer: { firstName: formData.nome, lastName: formData.sobrenome, email: formData.email },
        },
        customization: {
          paymentMethods: {
            creditCard: "all", debitCard: "all",
            ticket: "all", bankTransfer: "all", mercadoPago: "all",
          },
          visual: {
            style: {
              theme: "default",
              customVariables: {
                baseColor: "#000000",
                borderRadiusLarge: "16px",
                borderRadiusMedium: "12px",
                borderRadiusSmall: "8px",
              },
            },
          },
        },
        callbacks: {
          onReady: () => console.log("MP Brick pronto"),
          onSubmit: async () => {
            clearCart();
            setIsFinished(true);
          },
          onError: (err: any) => {
            console.error("MP Brick erro:", err);
            setError("Erro no formulário de pagamento. Tente novamente.");
          },
        },
      });
    } catch (err: any) {
      console.error("Erro ao inicializar Brick:", err);
      setError("Erro ao carregar o formulário de pagamento.");
    }
  };

  const handleNext = async () => {
    setError(null);
    if (currentStep === 0) {
      if (!formData.logradouro || !formData.numero || !formData.cidade) {
        setError("Preencha o endereço completo antes de continuar.");
        return;
      }
      await calcularFrete();
      setCurrentStep(1);
    } else if (currentStep === 1) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep > 0) setCurrentStep(currentStep - 1);
    else navigate(-1);
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

  if (isFinished) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold uppercase tracking-tighter">Pedido Confirmado!</h1>
          <p className="text-gray-500">Obrigado pela sua compra! O pagamento está sendo processado e você receberá uma confirmação em breve.</p>
          {pedidoId && (
            <p className="text-xs font-mono text-gray-400 bg-gray-50 px-4 py-2 rounded-xl">
              Pedido #{pedidoId.slice(-8).toUpperCase()}
            </p>
          )}
          <div className="pt-8 space-y-4 w-full">
            <button onClick={() => navigate("/")} className="w-full rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors">
              Voltar para a Home
            </button>
            <button onClick={() => navigate("/rastreamento")} className="w-full rounded-full border border-gray-200 py-4 text-sm font-bold text-black uppercase tracking-widest hover:bg-gray-50 transition-colors">
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
        <div className="lg:col-span-8 space-y-12">

          {/* Progress Bar */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex flex-col items-center flex-1 relative">
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all z-10",
                    index <= currentStep ? "bg-black border-black text-white" : "bg-white border-gray-200 text-gray-300")}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={cn("mt-2 text-[10px] font-bold uppercase tracking-widest",
                    index <= currentStep ? "text-black" : "text-gray-300")}>
                    {step.name}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={cn("absolute top-5 left-1/2 w-full h-[2px] -z-0",
                      index < currentStep ? "bg-black" : "bg-gray-100")} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Erro global */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start space-x-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-gray-50 rounded-3xl p-8">
            <AnimatePresence mode="wait">

              {/* ETAPA 0 — Endereço */}
              {currentStep === 0 && (
                <motion.div key="address" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <h2 className="text-xl font-bold uppercase tracking-tighter">Dados de Entrega</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">E-mail</label>
                      <input type="email" name="email" value={formData.email} onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none" placeholder="seu@email.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Nome</label>
                      <input type="text" name="nome" value={formData.nome} onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Sobrenome</label>
                      <input type="text" name="sobrenome" value={formData.sobrenome} onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">CEP</label>
                      <div className="relative">
                        <input type="text" name="cep" value={formData.cep} onChange={handleCEPChange} maxLength={8}
                          className={cn("w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none", cepError && "border-red-500")}
                          placeholder="00000000" />
                        {isCEPLoading && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>}
                      </div>
                      {cepError && <p className="mt-1 text-[10px] font-bold text-red-500 uppercase">{cepError}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Logradouro</label>
                      <input type="text" name="logradouro" value={formData.logradouro} onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none" placeholder="Rua, Avenida..." />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Número</label>
                      <input type="text" name="numero" value={formData.numero} onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Complemento</label>
                      <input type="text" name="complemento" value={formData.complemento} onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none" placeholder="Apto, Bloco..." />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Bairro</label>
                      <input type="text" name="bairro" value={formData.bairro} onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Cidade</label>
                      <input type="text" name="cidade" value={formData.cidade} onChange={handleInputChange}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Estado</label>
                      <input type="text" name="estado" value={formData.estado} onChange={handleInputChange} maxLength={2}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-black focus:outline-none uppercase" placeholder="UF" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ETAPA 1 — Frete */}
              {currentStep === 1 && (
                <motion.div key="shipping" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <h2 className="text-xl font-bold uppercase tracking-tighter">Opções de Frete</h2>
                  {isLoadingShipping ? (
                    <div className="flex items-center justify-center py-12 space-x-3">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      <span className="text-sm text-gray-400">Calculando frete...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {shippingOptions.map((opcao) => (
                        <label key={opcao.id} className={cn(
                          "flex items-center justify-between p-6 rounded-2xl border-2 cursor-pointer transition-all",
                          formData.frete === opcao.id ? "border-black bg-white" : "border-gray-100 bg-gray-50 hover:border-gray-200")}>
                          <div className="flex items-center">
                            <input type="radio" name="frete" value={opcao.id} checked={formData.frete === opcao.id}
                              onChange={() => setFormData((f) => ({ ...f, frete: opcao.id, frete_valor: opcao.valor }))} className="hidden" />
                            <div className="h-5 w-5 rounded-full border-2 border-black flex items-center justify-center mr-4">
                              {formData.frete === opcao.id && <div className="h-2 w-2 rounded-full bg-black" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold">{opcao.nome}</p>
                              <p className="text-xs text-gray-500">{opcao.prazo}</p>
                            </div>
                          </div>
                          <span className="text-sm font-bold">{formatCurrency(opcao.valor)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ETAPA 2 — Pagamento */}
              {currentStep === 2 && (
                <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <h2 className="text-xl font-bold uppercase tracking-tighter">Pagamento</h2>

                  {isSubmitting && (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                      <p className="text-sm text-gray-400 uppercase tracking-widest">Preparando pagamento seguro...</p>
                    </div>
                  )}

                  {!isSubmitting && !error && (
                    <div id="mp-payment-brick" />
                  )}

                  {!isSubmitting && error && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <AlertCircle className="h-10 w-10 text-red-400" />
                      <p className="text-sm text-red-500 text-center">{error}</p>
                      <button onClick={iniciarPagamento}
                        className="rounded-full bg-black px-8 py-3 text-xs font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors">
                        Tentar novamente
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navegação — etapas 0 e 1 */}
            {currentStep < 2 && (
              <div className="mt-12 flex space-x-4">
                <button onClick={handleBack}
                  className="flex-1 rounded-full border border-gray-200 py-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors">
                  Voltar
                </button>
                <button onClick={handleNext} disabled={isSubmitting}
                  className="flex-1 rounded-full bg-black py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:bg-gray-400 flex items-center justify-center">
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continuar"}
                </button>
              </div>
            )}

            {/* Voltar na etapa de pagamento */}
            {currentStep === 2 && !isSubmitting && (
              <div className="mt-8">
                <button onClick={handleBack}
                  className="flex items-center text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para frete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Resumo do Pedido */}
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
                <p>Subtotal</p><p>{formatCurrency(total())}</p>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <p>Frete</p><p>{formatCurrency(formData.frete_valor)}</p>
              </div>
              <div className="flex justify-between text-lg font-bold text-black pt-4">
                <p>Total</p><p>{formatCurrency(total() + formData.frete_valor)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
