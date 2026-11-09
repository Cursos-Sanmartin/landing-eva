// Función de Vercel: atiende /api/eva en la web publicada (en tu compu lo hace `npm run dev`).
// La clave GEMINI_API_KEY se carga en Vercel → Settings → Environment Variables; nunca llega al navegador.
import { askGemini } from "../server/evaAI.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Solo POST" });
    return;
  }
  // Solo desde el propio sitio (que otras páginas no usen tu cupo de Gemini desde el navegador)
  const origin = req.headers.origin;
  if (origin) {
    let sameSite;
    try {
      sameSite = new URL(origin).host === req.headers.host;
    } catch {
      sameSite = false;
    }
    if (!sameSite) {
      res.status(403).json({ error: "No permitido" });
      return;
    }
  }
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      body = {};
    }
  }
  // Un pedido normal pesa unos pocos KB: lo más grande se rechaza
  if (JSON.stringify(body || {}).length > 40000) {
    res.status(413).json({ error: "Pedido demasiado grande" });
    return;
  }
  const out = await askGemini(body || {}, { apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL });
  res.status(out.status).json(out.body);
}
