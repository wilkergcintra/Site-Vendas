import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import admin from "firebase-admin";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, doc as clientDoc, getDoc as getClientDoc, collection as clientCollection, getDocs as getClientDocs } from "firebase/firestore";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (for webhooks/updates)
let adminDb: any;
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = null;

if (fs.existsSync(firebaseConfigPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
  adminDb = getAdminFirestore(firebaseConfig.firestoreDatabaseId || "(default)");
} else {
  if (admin.apps.length === 0) admin.initializeApp();
  adminDb = getAdminFirestore();
}

// Initialize Firebase Client (for fetching public config on server)
const clientApp = firebaseConfig ? initializeClientApp(firebaseConfig) : null;
const clientDb = clientApp ? getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId) : null;

// Helper to get MP Client with latest token
async function getMPClient() {
  let accessToken = process.env.MP_ACCESS_TOKEN;

  // Try to fetch from Firestore using Client SDK (since config_pagamentos is public)
  if (clientDb) {
    try {
      const snap = await getClientDoc(clientDoc(clientDb, "config_pagamentos", "principal"));
      if (snap.exists()) {
        const data = snap.data();
        if (data?.mp_access_token) {
          accessToken = data.mp_access_token;
        }
      }
    } catch (error) {
      console.error("Erro ao buscar access token via Client SDK:", error);
    }
  }

  // Fallback to Admin SDK if Client SDK failed (might work if permissions are fixed)
  if (!accessToken && adminDb) {
    try {
      const configSnap = await adminDb.collection("config_private").doc("mercadopago").get();
      if (configSnap.exists) {
        const data = configSnap.data();
        if (data?.mercado_pago_access_token) {
          accessToken = data.mercado_pago_access_token;
        }
      }
    } catch (error) {
      console.error("Erro ao buscar access token via Admin SDK:", error);
    }
  }

  if (!accessToken) {
    throw new Error("Mercado Pago Access Token não encontrado no Firestore (config_pagamentos/principal) nem no ambiente. Por favor, configure no painel Admin > Pagamentos e clique em Salvar.");
  }

  return new MercadoPagoConfig({
    accessToken: accessToken,
    options: { timeout: 10000 },
  });
}

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

      const mpClient = await getMPClient();
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
                  street_number: String(endereco.numero || "0"),
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
      const mpClient = await getMPClient();
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
        const mpClient = await getMPClient();
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
          authorized: "pago",
          rejected: "cancelado",
          cancelled: "cancelado",
          refunded: "cancelado",
          charged_back: "cancelado",
        };

        const novoStatus = statusMap[status || ""] || "aguardando";

        if (pedidoId && adminDb) {
          await adminDb.collection("pedidos").doc(pedidoId).update({
            status: novoStatus,
            payment_id: String(result.id),
            atualizado_em: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`Pedido ${pedidoId} atualizado para: ${novoStatus}`);
        }
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
