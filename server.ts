import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Mercado Pago Webhook
  app.post("/api/webhooks/mercadopago", (req, res) => {
    console.log("Mercado Pago Webhook:", req.body);
    // TODO: Update order status in Firestore
    res.status(200).send("OK");
  });

  // Shipping Calculation (SuperFrete Mock/Integration)
  app.post("/api/shipping/calculate", async (req, res) => {
    const { cep, items } = req.body;
    // Mock response for now
    res.json({
      options: [
        { id: "pac", name: "Correios PAC", price: 25.50, deadline: "7 dias úteis" },
        { id: "sedex", name: "Correios SEDEX", price: 45.90, deadline: "2 dias úteis" },
      ]
    });
  });

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
