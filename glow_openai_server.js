const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3001;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const promptPath = path.join(__dirname, "glow_openai_prompt.txt");
const promptTemplate = fs.existsSync(promptPath)
  ? fs.readFileSync(promptPath, "utf8")
  : "Sos un asistente comercial breve en español.";

const BUSINESS = {
  nombre: process.env.BUSINESS_NAME || "GLOW Demo",
  rubro: process.env.BUSINESS_RUBRO || "Asistente comercial para negocios",
  ciudad: process.env.BUSINESS_CITY || "Saladillo",
  horario: process.env.BUSINESS_HORARIO || "Lunes a Sabado 09:00 a 20:00",
  ubicacion: process.env.BUSINESS_UBICACION || "Centro, Saladillo",
  whatsapp: process.env.BUSINESS_WHATSAPP || "5492345421181",
  ofertas: process.env.BUSINESS_OFERTAS || "Promo 1: 20% OFF | Promo 2: 2x1 | Promo 3: Combo especial",
  sorteo: process.env.BUSINESS_SORTEO || "Sorteo activo: participas escaneando el QR y dejando tu nombre."
};

function buildSystemPrompt() {
  return promptTemplate
    .replaceAll("[NOMBRE_NEGOCIO]", BUSINESS.nombre)
    .replaceAll("[RUBRO]", BUSINESS.rubro)
    .replaceAll("[CIUDAD]", BUSINESS.ciudad)
    .replaceAll("[HORARIO]", BUSINESS.horario)
    .replaceAll("[UBICACION]", BUSINESS.ubicacion)
    .replaceAll("[WHATSAPP]", BUSINESS.whatsapp)
    .replaceAll("[OFERTAS]", BUSINESS.ofertas)
    .replaceAll("[SORTEO]", BUSINESS.sorteo);
}

const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
if (!hasApiKey) {
  console.warn("Falta OPENAI_API_KEY en .env. Servidor en modo fallback local.");
}

const client = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function fallbackReply(message) {
  const t = String(message || "").toLowerCase();
  if (/(oferta|promo|promoci)/.test(t)) {
    return `Hoy tenemos ofertas activas: ${BUSINESS.ofertas}. Tambien podes participar del sorteo: ${BUSINESS.sorteo}`;
  }
  if (/(sorteo|premio|particip)/.test(t)) {
    return `${BUSINESS.sorteo} Si queres, tambien te paso las ofertas vigentes.`;
  }
  if (/(hora|horario|abre|cierran)/.test(t)) {
    return `Nuestro horario es ${BUSINESS.horario}.`;
  }
  if (/(ubic|donde|direccion)/.test(t)) {
    return `Estamos en ${BUSINESS.ubicacion}, ${BUSINESS.ciudad}.`;
  }
  if (/(whats|contact|telefono)/.test(t)) {
    return `Claro, escribinos por WhatsApp: https://wa.me/${BUSINESS.whatsapp}`;
  }
  return `Te ayudo con gusto. Puedo contarte ofertas, sorteo, horario y ubicacion. WhatsApp: https://wa.me/${BUSINESS.whatsapp}`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, business: BUSINESS.nombre });
});

// Endpoint simple para probar desde navegador (GET)
app.get("/api/chat-test", async (req, res) => {
  const message = String(req.query?.q || "hola").trim();
  try {
    if (!client) {
      return res.json({ reply: fallbackReply(message), mode: "fallback" });
    }
    const response = await client.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: message }
      ]
    });
    const reply = response.output_text || fallbackReply(message);
    res.json({ reply });
  } catch (_error) {
    res.json({ reply: fallbackReply(message), mode: "fallback" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "message requerido" });
    }

    if (!client) {
      return res.json({ reply: fallbackReply(message), mode: "fallback" });
    }

    const response = await client.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: message }
      ]
    });

    const reply = response.output_text || fallbackReply(message);
    res.json({ reply });
  } catch (error) {
    console.error("Error /api/chat:", error?.message || error);
    res.status(500).json({
      error: "No se pudo generar respuesta",
      reply: "No pude responder ahora. Si queres, te atiendo por WhatsApp."
    });
  }
});

app.listen(PORT, () => {
  console.log(`GLOW OpenAI API en http://localhost:${PORT}`);
});
