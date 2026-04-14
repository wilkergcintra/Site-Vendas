import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mercado Pago client
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "",
  options: { timeout: 5000 },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ─────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─────────────────────────────────────────────
  // MERCADO PAGO — Criar preferência de pagamento
  // ─────────────────────────────────────────────
  app.post("/api/pagamento/criar-preferencia", async (req, res) => {
    try {
      const { itens, frete, endereco, cliente, pedido_id } = req.body;

      if (!itens || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ error: "Itens do pedido são obrigatórios." });
      }

      const preference = new Preference(mpClient);

      const items = itens.map((item: any) => ({
        id: item.produto_id,
        title: item.nome,
        quantity: item.quantidade,
        unit_price: Number(item.preco),
        currency_id: "BRL",
        picture_url: item.imagem || undefined,
        description: item.tamanho ? `Tamanho: ${item.tamanho} | Cor: ${item.cor}` : undefined,
      }));

      // Adiciona o frete como item separado
      if (frete && frete.valor > 0) {
        items.push({
          id: "frete",
          title: `Frete - ${frete.modalidade === "pac" ? "Correios PAC" : "Correios SEDEX"}`,
          quantity: 1,
          unit_price: Number(frete.valor),
          currency_id: "BRL",
          picture_url: undefined,
          description: undefined,
        });
      }

      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

      const result = await preference.create({
        body: {
          items,
          payer: {
            name: cliente?.nome?.split(" ")[0] || "",
            surname: cliente?.nome?.split(" ").slice(1).join(" ") || "",
            email: cliente?.email || "",
            address: endereco
              ? {
                  street_name: endereco.logradouro,
                  street_number: Number(endereco.numero) || 0,
                  zip_code: endereco.cep,
                }
              : undefined,
          },
          back_urls: {
            success: `${appUrl}/checkout/sucesso`,
            failure: `${appUrl}/checkout/falha`,
            pending: `${appUrl}/checkout/pendente`,
          },
          auto_return: "approved",
          external_reference: pedido_id || `pedido_${Date.now()}`,
          notification_url: `${appUrl}/api/webhooks/mercadopago`,
          payment_methods: {
            excluded_payment_types: [],
            installments: 12,
          },
          statement_descriptor: "MINHA LOJA",
        },
      });

      res.json({
        preference_id: result.id,
        init_point: result.init_point,
        sandbox_init_point: result.sandbox_init_point,
      });
    } catch (error: any) {
      console.error("Erro ao criar preferência MP:", error);
      res.status(500).json({
        error: "Erro ao criar preferência de pagamento.",
        details: error?.message,
      });
    }
  });

  // ─────────────────────────────────────────────
  // MERCADO PAGO — Buscar status de um pagamento
  // ─────────────────────────────────────────────
  app.get("/api/pagamento/:payment_id", async (req, res) => {
    try {
      const { payment_id } = req.params;
      const payment = new Payment(mpClient);
      const result = await payment.get({ id: payment_id });

      res.json({
        id: result.id,
        status: result.status,
        status_detail: result.status_detail,
        external_reference: result.external_reference,
        transaction_amount: result.transaction_amount,
        date_approved: result.date_approved,
      });
    } catch (error: any) {
      console.error("Erro ao buscar pagamento MP:", error);
      res.status(500).json({ error: "Erro ao buscar pagamento.", details: error?.message });
    }
  });

  // ─────────────────────────────────────────────
  // MERCADO PAGO — Webhook (notificações)
  // ─────────────────────────────────────────────
  app.post("/api/webhooks/mercadopago", async (req, res) => {
    try {
      const { type, data } = req.body;

      console.log("Webhook MP recebido:", { type, data });

      if (type === "payment" && data?.id) {
        const payment = new Payment(mpClient);
        const result = await payment.get({ id: data.id });

        const pedidoId = result.external_reference;
        const status = result.status; // approved | pending | rejected | cancelled

        console.log(`Pedido ${pedidoId} — Status MP: ${status}`);

        // Mapeia status do MP para status do seu sistema
        const statusMap: Record<string, string> = {
          approved: "pago",
          pending: "aguardando",
          in_process: "aguardando",
          rejected: "cancelado",
          cancelled: "cancelado",
          refunded: "cancelado",
        };

        const novoStatus = statusMap[status || ""] || "aguardando";

        // TODO: Atualizar o Firestore aqui
        // Exemplo (adicione o import do Firebase Admin SDK para usar no servidor):
        // await admin.firestore().doc(`pedidos/${pedidoId}`).update({
        //   status: novoStatus,
        //   payment_id: String(result.id),
        //   atualizado_em: admin.firestore.FieldValue.serverTimestamp(),
        // });

        console.log(`Pedido ${pedidoId} deve ser atualizado para: ${novoStatus}`);
      }

      res.status(200).send("OK");
    } catch (error: any) {
      console.error("Erro no webhook MP:", error);
      res.status(500).send("Erro interno");
    }
  });

  // ─────────────────────────────────────────────
  // FRETE — Cálculo via SuperFrete (mock com fallback)
  // ─────────────────────────────────────────────
  app.post("/api/frete/calcular", async (req, res) => {
    const { cep_destino, peso, comprimento, largura, altura } = req.body;

    if (!cep_destino) {
      return res.status(400).json({ error: "CEP de destino é obrigatório." });
    }

    const superfretToken = process.env.SUPERFRETE_TOKEN;

    if (superfretToken) {
      try {
        const response = await fetch("https://api.superfrete.com/api/v0/calculator", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${superfretToken}`,
          },
          body: JSON.stringify({
            from: { postal_code: process.env.CEP_ORIGEM || "01310100" },
            to: { postal_code: cep_destino.replace(/\D/g, "") },
            package: {
              height: altura || 10,
              width: largura || 20,
              length: comprimento || 30,
              weight: (peso || 500) / 1000, // gramas → kg
            },
            services: ["1", "2"], // 1=PAC, 2=SEDEX
          }),
        });

        const data = await response.json();

        if (data && Array.isArray(data)) {
          return res.json({
            opcoes: data.map((s: any) => ({
              id: s.id,
              nome: s.name,
              valor: s.price,
              prazo: `${s.delivery_time} dias úteis`,
            })),
          });
        }
      } catch (err) {
        console.warn("SuperFrete indisponível, usando fallback:", err);
      }
    }

    // Fallback com valores mock
    res.json({
      opcoes: [
        { id: "pac", nome: "Correios PAC", valor: 25.50, prazo: "7 a 10 dias úteis" },
        { id: "sedex", nome: "Correios SEDEX", valor: 45.90, prazo: "2 a 3 dias úteis" },
      ],
    });
  });

  // ─────────────────────────────────────────────
  // VITE (dev) ou estático (prod)
  // ─────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
