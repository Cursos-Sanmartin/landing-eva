// Entiende lo que la persona dice o escribe y lo convierte en una acción.
// No usa inteligencia artificial: busca palabras clave en español.
// Para sumar frases nuevas, agregalas en las listas de abajo.

import { THEMES } from "../../data/projects";

export function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:"'«»()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ¿Aparece esta palabra o frase completa?
const has = (text, phrase) => new RegExp(`(^| )${phrase}( |$)`).test(text);
const hasAny = (text, phrases) => phrases.some((p) => has(text, p));

// Palabras que llevan a cada temática. El orden importa: lo más específico primero.
const THEME_WORDS = {
  "diseno-ux-ui": ["ux", "ui", "ux ui", "experiencia de usuario", "interfaz", "interfaces"],
  "diseno-grafico": ["diseno grafico", "grafico", "diseno"],
  "ciencia-de-datos": ["big data", "ciencia de datos", "datos", "data"],
  "programacion-web": ["programacion", "programacion web", "desarrollo web", "pagina web", "paginas web", "web"],
  videojuegos: ["videojuegos", "videojuego", "juegos", "juego", "gaming"],
  robotica: ["robotica", "robots", "robot", "internet de las cosas", "iot", "arduino"],
  ia: ["inteligencia artificial", "ia", "chatgpt"],
  marketing: ["marketing", "marketing digital", "publicidad"],
  streaming: ["streaming", "multimedios", "multimedia", "audiovisual"],
  "metodologias-agiles": ["metodologias agiles", "metodologias", "metodologia", "agiles", "agil", "scrum"],
};

const SECTIONS = [
  { to: "/#programa", label: "al programa", words: ["programa", "pasos", "unidades"] },
  { to: "/#tematicas", label: "a las temáticas", words: ["tematicas", "tematica", "cursos", "proyectos"] },
  { to: "/#equipo", label: "al equipo", words: ["equipo", "tutores", "tutoras", "docentes"] },
  { to: "/", label: "al inicio", words: ["inicio", "arriba", "principio", "portada"] },
];

export const THEME_NAMES = Object.values(THEMES).map((t) => t.name);

export function interpret(raw) {
  const t = normalize(raw);
  if (!t) return { type: "empty" };
  const turnOff = hasAny(t, ["saca", "sacale", "sacalo", "quita", "quitale", "desactiva", "apaga", "sin"]);
  const turnOn = hasAny(t, ["activa", "pone", "poneme", "prende", "usa", "quiero"]);
  // true / false si lo pidió explícito; null = cambiar al otro estado
  const onOff = turnOff ? false : turnOn ? true : null;

  if (
    /^(para|pare|parar|detene|detenete|deten|basta|silencio|callate|stop|frena|corta)( |$)/.test(t) ||
    /(deja|para) de (leer|hablar)/.test(t) ||
    has(t, "detener")
  ) {
    return { type: "stop" };
  }
  if (/(no hables|sin voz|mudo|sin sonido|solo texto|solo por escrito)/.test(t)) {
    return { type: "toggle", key: "voice", value: false };
  }
  if (/(con voz|activa la voz|prende la voz|habla en voz alta|quiero escucharte)/.test(t)) {
    return { type: "toggle", key: "voice", value: true };
  }
  if (hasAny(t, ["lee", "leeme", "leelo", "leer", "leerme", "lectura"]) || t.includes("en voz alta")) {
    return { type: "read", selection: /(seleccion|marcado|marque|esto)/.test(t) };
  }
  if (/(tamano normal|texto normal|letra normal)/.test(t)) return { type: "size", dir: 0 };
  if (/(agranda|mas grande|aumenta|letra grande|texto grande|zoom|no veo|no leo|amplia)/.test(t)) {
    return { type: "size", dir: 1 };
  }
  if (/(achica|mas chic|reduci|disminui|mas peque)/.test(t)) return { type: "size", dir: -1 };
  if (t.includes("contraste")) return { type: "toggle", key: "contrast", value: onOff };
  if (/(fuente|tipografia|dislexia|legible|letra mas clara)/.test(t)) {
    return { type: "toggle", key: "font", value: onOff };
  }
  if (/(enlace|link|vinculo)/.test(t)) return { type: "toggle", key: "links", value: onOff };
  if (/(animacion|movimiento|quiet)/.test(t) || hasAny(t, ["pausa", "pausar"])) {
    return { type: "toggle", key: "pause", value: !/(activa|volve|prende|reanuda)/.test(t) || turnOff };
  }
  if (/(restablec|reset|como estaba|volver todo|volve todo|deshace)/.test(t)) return { type: "reset" };
  if (/(que tematicas|cuales son las tematicas|que cursos|que temas|lista de tematicas|que tematica hay)/.test(t)) {
    return { type: "themes" };
  }
  for (const [slug, words] of Object.entries(THEME_WORDS)) {
    if (THEMES[slug] && hasAny(t, words)) return { type: "go", to: `/tematicas/${slug}`, label: `a ${THEMES[slug].name}` };
  }
  const section = SECTIONS.find((s) => hasAny(t, s.words));
  if (section) return { type: "go", to: section.to, label: section.label };
  if (/(que es eva|de que se trata|que es esto|que es esta pagina|contame|que hacen|hablame de eva)/.test(t)) {
    return { type: "about" };
  }
  if (/(ayuda|que podes|que sabes|que haces|como funciona|opciones|que puedo)/.test(t)) return { type: "help" };
  if (hasAny(t, ["hola", "buenas", "buen dia", "buenas tardes", "buenas noches", "que tal"])) return { type: "hello" };
  if (t.includes("gracias")) return { type: "thanks" };
  return { type: "unknown" };
}
