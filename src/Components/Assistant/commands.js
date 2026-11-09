// Entiende lo que la persona dice o escribe y lo convierte en una acción.
// No usa inteligencia artificial: busca palabras clave en español.
// Para sumar frases nuevas, agregalas en las listas de abajo.

import { PROJECTS, THEMES } from "../../data/projects";

// Minúsculas, sin acentos y sin signos: «¿Abrí "Pixel-Quest"?» → «abri pixel quest»
export function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
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

function findTheme(t) {
  for (const [slug, words] of Object.entries(THEME_WORDS)) {
    if (THEMES[slug] && hasAny(t, words)) return slug;
  }
  return null;
}

// ---------- Trabajos por nombre ----------

const SKIP_WORDS = new Set(["del", "las", "los", "para", "con", "una", "uno", "por", "que", "the", "and", "mas"]);
const keyWords = (name) =>
  normalize(name)
    .split(" ")
    .filter((w) => w.length >= 3 && !SKIP_WORDS.has(w));
const PROJECT_INDEX = PROJECTS.map((project) => ({
  project,
  full: normalize(project.name),
  words: keyWords(project.name),
}));

// El trabajo cuyo nombre aparece en lo que dijo (completo o al menos la mitad de sus palabras)
function findProject(t) {
  const said = new Set(t.split(" "));
  let best = null;
  let bestScore = 0;
  for (const item of PROJECT_INDEX) {
    if (item.full && has(t, item.full)) return item.project;
    if (!item.words.length) continue;
    const hits = item.words.filter((w) => said.has(w)).length;
    const score = hits / item.words.length;
    if (hits && score >= 0.5 && (score > bestScore || (score === bestScore && item.words.length > best.words.length))) {
      best = item;
      bestScore = score;
    }
  }
  return best ? best.project : null;
}

const ORDINALS = {
  primero: 1, primera: 1, segundo: 2, segunda: 2, tercero: 3, tercera: 3, cuarto: 4, cuarta: 4,
  quinto: 5, quinta: 5, sexto: 6, sexta: 6, septimo: 7, septima: 7, octavo: 8, octava: 8,
  noveno: 9, novena: 9, decimo: 10, decima: 10, ultimo: -1, ultima: -1,
};

// «el tercero», «la última», «el número 4» → posición (−1 = la última)
function findOrdinal(t) {
  for (const [word, n] of Object.entries(ORDINALS)) if (has(t, word)) return n;
  const match = t.match(/(^| )(numero |el |la )(\d{1,2})( |$)/);
  return match ? Number(match[3]) : null;
}

const OPEN_WORDS = [
  "abri", "abrime", "abrilo", "abrila", "abrir", "abre", "abris", "abras", "abrirlo", "abrirla", "abrimelo",
  "abrimela", "mostrame", "mostrar", "mostrarme", "mostras", "quiero ver", "ver", "entra a", "entra en", "entrar a",
];
const THIS_WORDS = ["este", "esta", "ese", "esa", "abrilo", "abrila", "abrirlo", "abrirla", "abrimelo", "abrimela"];

// ---------- Frase para llamar a Eva ----------

// También vale «asistente, ¿estás ahí?»
export const WAKE_PHRASE = "Eva, ¿estás ahí?";
const WAKE_PATTERNS = [
  /(^| )(eva|asistente) (estas|esta) ahi( |$)/,
  /(^| )(eva|asistente) (estas|me escuchas)( |$)/,
  /(^| )(hola|hey|ey|oye|che|ok) (eva|asistente)( |$)/,
];

export function isWakePhrase(raw) {
  const t = normalize(raw);
  return WAKE_PATTERNS.some((pattern) => pattern.test(t));
}

// ---------- Interpretar un pedido ----------

export function interpret(raw) {
  let t = normalize(raw);
  if (!t) return { type: "empty" };
  // Si repite «Eva, ¿estás ahí?» cuando ya está abierta, solo saluda
  if (WAKE_PATTERNS.some((pattern) => pattern.test(t))) return { type: "hello" };
  // Muletillas y cortesía: «che, ¿me podés abrir este, por favor?» → «abrir este»
  const plain = t
    .replace(/^((eva|asistente|che|bueno|ok|okey|dale|a ver|porfa|por favor|perdon|disculpa|oye|escucha|escuchame) )+/, "")
    .replace(/( (por favor|porfa))+$/, "")
    .replace(/^(me )?(podes|podrias|puedes|queres|quisiera|necesito que|quiero que) (me )?/, "");
  if (plain) t = plain;
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
  if (/(^| )(chau|adios|cerrate|anda nomas|nada mas|eso es todo|listo gracias)( |$)/.test(t)) {
    return { type: "close" };
  }
  // «cerrá» cierra el trabajo abierto; si no hay ninguno, cierra a Eva
  if (/(^| )(cerra|cerralo|cerrala|cerrar|cerrarlo|cerrarla|cerras|sali|salir)( |$)/.test(t)) {
    return { type: "closeWork", plain: !/(trabajo|imagen|video|visor|documento|proyecto|lo|la)( |$)/.test(t) };
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

  // Recorrido: baja por la página y cuenta los proyectos
  if (
    /(navega|navegame|recorre|recorrido|paseo|mostrame la pagina|describi)/.test(t) ||
    /(que|cuales son los|contame los|contame que|mostrame los) (proyectos|trabajos)/.test(t) ||
    (/(proyectos|trabajos)/.test(t) &&
      /(^| )(conta|contas|contame|contar|contarme|decime|deci|decirme|nombrame|listame|mostrame|mostrar|mostrarme|ver|hay)( |$)/.test(t)) ||
    /(^| )que hay (aca|aqui|en esta pagina|en la pagina|para ver)( |$)/.test(t)
  ) {
    return { type: "tour", theme: findTheme(t) };
  }

  // Pasar de página dentro de un trabajo abierto
  if (/(siguiente|proxima|proximo|el que sigue|otro|pasa la pagina|pasa de pagina|adelante)/.test(t)) {
    return { type: "page", dir: 1 };
  }
  if (/(anterior|volve una pagina|para atras|atras|el de antes)/.test(t)) return { type: "page", dir: -1 };

  // Abrir un trabajo: por nombre, por número o «este»
  if (hasAny(t, OPEN_WORDS) || hasAny(t, ["este", "esta"])) {
    const project = findProject(t);
    if (project) return { type: "open", project };
    const index = findOrdinal(t);
    if (index) return { type: "open", index };
    if (
      hasAny(t, THIS_WORDS) ||
      /(^| )(el|un) (trabajo|proyecto)( |$)/.test(t) ||
      /(^| )(lo|la) (abris|abras|abrir|abri)( |$)/.test(t) ||
      /(^| )el que (me )?(estas|esta|estabas) (contando|nombrando|diciendo)( |$)/.test(t)
    ) {
      return { type: "open", which: "this" };
    }
  }

  if (/(que tematicas|cuales son las tematicas|que cursos|que temas|lista de tematicas|que tematica hay)/.test(t)) {
    return { type: "themes" };
  }
  const theme = findTheme(t);
  if (theme) return { type: "go", to: `/tematicas/${theme}`, label: `a ${THEMES[theme].name}` };
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

// ---------- ¿Le están hablando encima? ----------

// Palabras que Eva puede decir de otra forma cuando lee números («51» → «cincuenta y uno»)
const NUMBER_WORDS = new Set(
  ("cero uno una dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis " +
    "diecisiete dieciocho diecinueve veinte veintiuno veintidos veintitres veinticuatro veinticinco treinta " +
    "cuarenta cincuenta sesenta setenta ochenta noventa cien ciento mil numero").split(" "),
);

// Una sola de estas alcanza para saber que la persona le está hablando
const ATTENTION_WORDS = new Set(
  ("abri abre abrime abrilo abrila abriste abrelo siguiente anterior basta para pare frena stop eva asistente " +
    "espera segui cerra volve atras che hola momento perdon escucha escuchame oye mostrame").split(" "),
);

// ¿Esta palabra la dijo la persona? (no la acaba de decir Eva, ni es un número leído en voz alta)
function freshWords(spokenTexts) {
  const known = new Set(spokenTexts.join(" ").split(" ").filter(Boolean));
  const stems = new Set([...known].filter((w) => w.length >= 4).map((w) => w.slice(0, 4)));
  return (w) => w.length >= 3 && !known.has(w) && !NUMBER_WORDS.has(w) && !stems.has(w.slice(0, 4));
}

// Mira las últimas palabras que oyó el micrófono y descarta las que Eva acaba de decir.
// Si quedan dos palabras nuevas (o una que llama la atención), la persona le está hablando.
export function isTalkingOver(t, spokenTexts) {
  const isFresh = freshWords(spokenTexts);
  const fresh = t.split(" ").filter(Boolean).slice(-4).filter(isFresh);
  return fresh.length >= 2 || fresh.some((w) => ATTENTION_WORDS.has(w));
}

// Lo que dijo la persona: desde su primera palabra en adelante
export function userPart(t, spokenTexts) {
  const isFresh = freshWords(spokenTexts);
  const words = t.split(" ").filter(Boolean);
  const first = words.findIndex(isFresh);
  return first < 0 ? "" : words.slice(first).join(" ");
}
