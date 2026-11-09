// Ajustes de accesibilidad que el asistente aplica a todo el sitio.
// Se guardan en el navegador de cada visitante para la próxima visita.

const KEY = "eva-asistente";

export const DEFAULTS = {
  mode: null, // cómo prefiere comunicarse: "voz" | "texto" | "botones"
  voice: true, // Eva responde también en voz alta
  scale: 1, // tamaño del texto (1 = normal)
  contrast: false,
  font: false,
  links: false,
  pause: false,
};

export const SCALE_MIN = 1;
export const SCALE_MAX = 1.5;
export const SCALE_STEP = 0.125;

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // sin almacenamiento (modo privado): los ajustes duran hasta cerrar la página
  }
}

function ensureReadableFont() {
  if (document.getElementById("eva-a11y-font")) return;
  const link = document.createElement("link");
  link.id = "eva-a11y-font";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap";
  document.head.appendChild(link);
}

// El sitio usa rem en todos lados, así que agrandar la letra base agranda todo el texto
export function applySettings(settings) {
  const root = document.documentElement;
  root.style.fontSize = settings.scale !== 1 ? `${settings.scale * 100}%` : "";
  root.classList.toggle("eva-a11y-contrast", settings.contrast);
  root.classList.toggle("eva-a11y-font", settings.font);
  root.classList.toggle("eva-a11y-links", settings.links);
  root.classList.toggle("eva-a11y-pause", settings.pause);
  if (settings.font) ensureReadableFont();
}

// Texto de un bloque sin lo que está oculto para lectores de pantalla
function blockText(node) {
  const copy = node.cloneNode(true);
  copy.querySelectorAll("[aria-hidden='true'], svg, script, style").forEach((n) => n.remove());
  return copy.textContent.replace(/\s+/g, " ").trim();
}

// Bloques de texto de la página en orden de lectura (títulos, párrafos, ítems)
export function readableBlocks() {
  const root = document.querySelector("main") || document.body;
  const nodes = Array.from(root.querySelectorAll("h1, h2, h3, h4, p, li, blockquote, figcaption")).filter(
    (node) => !node.closest(".eva-assistant, [aria-hidden='true']") && node.getClientRects().length > 0,
  );
  return nodes
    .filter((node) => !nodes.some((other) => other !== node && other.contains(node)))
    .map((node) => ({ node, text: blockText(node) }))
    .filter((block) => block.text.length > 1);
}
