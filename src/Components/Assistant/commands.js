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

// Entiende un pedido: primero por frases conocidas y, si no coincide ninguna,
// por palabras sueltas (aunque Chrome las haya escrito un poco distinto)
export function interpret(raw) {
  const intent = interpretPhrase(raw);
  if (intent.type !== "unknown") return intent;
  // Las preguntas («¿quiénes hicieron…?», «¿cuántos…?») las contesta la IA, no se adivinan por palabras
  const t = normalize(raw);
  if (/^(y )?(que|quien|quienes|cuanto|cuantos|cuantas|cual|cuales|donde|como|cuando|por que|para que)( |$)/.test(t)) {
    return intent;
  }
  return interpretWords(t) || intent;
}

function interpretPhrase(raw) {
  let t = normalize(raw);
  if (!t) return { type: "empty" };
  // Si repite «Eva, ¿estás ahí?» cuando ya está abierta, solo saluda
  if (WAKE_PATTERNS.some((pattern) => pattern.test(t))) return { type: "hello" };
  // «¿Qué podés hacer?» (aunque se pierda el «qué» si lo dijo encima de Eva)
  if (/^(que )?(podes|podrias|puedes|sabes) hacer( vos)?$/.test(t)) return { type: "help" };
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
  // «Abrila en otra pestaña»: la página web que está mostrando
  if (/(otra pestana|nueva pestana|pestana nueva|otra ventana|nueva ventana|ventana nueva|aparte)/.test(t)) {
    return { type: "newTab" };
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
    /(navega|navegue|navegar|recorre|recorri|recorrido|recorramos|paseo|una vuelta|describi)/.test(t) ||
    /(mostrame|muestrame|mostras|mostrarme|ensename|ensenarme) (la pagina|lo que hay|que hay)/.test(t) ||
    /(que|cuales son los|cuales son las|contame los|contame que|mostrame los|muestrame los) (proyectos|trabajos)/.test(t) ||
    (/(proyecto|trabajo)/.test(t) &&
      /(^| )(conta|contas|contame|contar|contarme|decime|deci|decirme|nombrame|listame|mostrame|muestrame|mostras|muestras|mostra|muestra|mostrar|mostrarme|ensename|ensenas|ensenarme|ver|veo|hay)( |$)/.test(t)) ||
    /(^| )que hay (aca|aqui|en esta pagina|en la pagina|para ver)( |$)/.test(t)
  ) {
    return { type: "tour", theme: findTheme(t) };
  }

  // «Contame de qué trata el programa», «¿qué es EVA?»: recorrido por la sección del programa
  if (
    (/(^| )(de que (se )?trata|que es|en que consiste|como funciona|como es|conta|contame|contas|contanos|explica|explicame|explicanos|hablame|decime)( |$)/.test(
      t,
    ) &&
      /(^| )(programa|eva|curso|cursos|la propuesta|las unidades|los pasos)( |$)/.test(t)) ||
    /^(de que (se )?trata( esto)?|que es esto|que es esta pagina)$/.test(t)
  ) {
    return { type: "program" };
  }

  // Pasar de página dentro de un trabajo abierto
  // item: pidió otro trabajo («el siguiente proyecto»); sheet: otra página del documento («pasá la página»)
  const item = /(proyecto|trabajo)/.test(t);
  const sheet = /(pagina|hoja)/.test(t) && !item;
  if (/(siguiente|proxima|proximo|el que sigue|otro|pasa la pagina|pasa de pagina|adelante)/.test(t)) {
    return { type: "page", dir: 1, item, sheet };
  }
  if (/(anterior|volve una pagina|para atras|atras|el de antes)/.test(t)) return { type: "page", dir: -1, item, sheet };

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
  // «Muchas gracias por la ayuda» es para despedirse, no un pedido de ayuda
  if (t.includes("gracias")) return { type: "thanks" };
  if (/(ayuda|que podes|que sabes|que haces|como funciona|opciones|que puedo)/.test(t)) return { type: "help" };
  if (/(como estas|como andas|como te va|como va|todo bien|que tal estas)/.test(t)) return { type: "howareyou" };
  if (hasAny(t, ["hola", "buenas", "buen dia", "buenas tardes", "buenas noches", "que tal"])) return { type: "hello" };
  return { type: "unknown" };
}

// ---------- ¿Lo dijo la persona o es la voz de Eva? ----------
// El micrófono también oye a Eva por los parlantes. Para saber qué dijo la persona,
// se descartan las palabras que Eva acaba de decir (aunque Chrome las entienda un poco distinto).

// Palabras que Eva dice de otra forma: números («51» → «cincuenta y uno») y letras de siglas («EES» → «e e ese»)
const SPELLED_WORDS = new Set(
  ("cero uno una dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis " +
    "diecisiete dieciocho diecinueve veinte veintiuno veintidos veintitres veinticuatro veinticinco treinta " +
    "cuarenta cincuenta sesenta setenta ochenta noventa cien ciento mil numero numeros nro " +
    "be ce de efe ge hache jota ka ele eme ene ene pe cu erre ese te ve uve doble equis ye zeta").split(" "),
);

// Palabras cortas muy comunes: solas no alcanzan para saber que habló la persona
const COMMON_WORDS = new Set("que los las del con por les sus mas muy hay son fue era una uno".split(" "));

// Palabras que la persona usa para llamar la atención o pedir algo
const ATTENTION_WORDS = new Set(
  ("abri abre abrime abrilo abrila abris abrir abrirlo siguiente anterior basta para pare frena stop eva " +
    "asistente espera segui cerra volve atras che hola momento perdon escucha escuchame oye mostrame " +
    "podes podrias contame conta decime").split(" "),
);

// Distancia de edición, cortando apenas pasa el máximo
function near(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      row.push(v);
      if (v < best) best = v;
    }
    if (best > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
}

// Cómo suena una palabra: Chrome puede escribir «quest», «kest» o «cuest» para lo mismo
function sound(w) {
  return w
    .replace(/h/g, "")
    .replace(/qu/g, "k")
    .replace(/c([ei])/g, "s$1")
    .replace(/[cq]/g, "k")
    .replace(/z/g, "s")
    .replace(/x/g, "ks")
    .replace(/v/g, "b")
    .replace(/w/g, "u")
    .replace(/ll/g, "y")
    .replace(/([a-z])\1/g, "$1");
}

// Devuelve una función que dice si una palabra es de la persona (no la acaba de decir Eva)
function freshWords(spokenTexts) {
  const known = new Set(spokenTexts.join(" ").split(" ").filter(Boolean));
  const sounds = [...new Set([...known].filter((w) => w.length >= 3).map(sound))];
  const soundSet = new Set(sounds);
  const stems = new Set(sounds.filter((s) => s.length >= 4).map((s) => s.slice(0, 4)));
  return (w) => {
    if (w.length < 3 || known.has(w) || SPELLED_WORDS.has(w)) return false;
    // Las palabras para pedir algo cuentan aunque se parezcan a algo que dijo Eva
    if (ATTENTION_WORDS.has(w)) return true;
    if (COMMON_WORDS.has(w)) return false;
    const s = sound(w);
    if (soundSet.has(s) || (s.length >= 4 && stems.has(s.slice(0, 4)))) return false;
    const max = s.length >= 5 ? 2 : s.length === 4 ? 1 : 0;
    return !max || !sounds.some((k) => k.length >= 3 && near(s, k, max));
  };
}

// ¿Es la voz de Eva o es de la persona? Las dos funciones reciben lo que Eva dijo en los
// últimos segundos (no todo el texto: si la persona repite algo que Eva dijo hace rato, es suya).

// Mientras Eva habla: es de la persona si no se parece a nada de lo que Eva viene diciendo
export function freshTest(evaText) {
  return freshWords([evaText]);
}

// Apenas se calla: sus últimas palabras todavía pueden llegar (Chrome tarda en escribirlas)
export function lateEchoTest(evaText) {
  const tail = [...new Set(evaText.split(" ").filter(Boolean).map(sound))];
  return (w) => {
    const s = sound(w);
    return w.length === 1 || SPELLED_WORDS.has(w) || tail.some((k) => k === s || (s.length >= 4 && near(s, k, 1)));
  };
}

// La frase de la persona sin las palabras de Eva que se colaron (cuando la cortan, lo último
// que dijo todavía llega un instante después). Las palabras cortas de los pedidos se quedan.
const KEEP_WORDS = new Set("este esta ese esa eso esto el la lo los las un una al del de que me te le".split(" "));
export function withoutEcho(t, spokenTexts, keepShort = true) {
  const isFresh = freshWords(spokenTexts);
  return t
    .split(" ")
    .filter((w) => w && ((keepShort && KEEP_WORDS.has(w)) || isFresh(w)))
    .join(" ");
}

// Lo que queda de la frase para llamarla («…¿estás ahí?») o el nombre al principio no es un pedido
const CALL_WORDS = new Set("eva asistente estas esta ahi alli ahi oye hey ey".split(" "));
export function isCallWord(w) {
  return CALL_WORDS.has(w);
}

export function withoutCall(t) {
  const words = t.split(" ").filter(Boolean);
  let i = 0;
  while (i < words.length && CALL_WORDS.has(words[i])) i += 1;
  return words.slice(i).join(" ");
}

// «Seguí», «dale», «nada»: que siga con lo que estaba haciendo
export function isResume(t) {
  return /(^| )(segui|seguir|sigue|continua|continuar|dale|nada|perdon|disculpa|listo|ok|okey|no importa)( |$)/.test(t);
}

// «Che», «escuchame», «esperá»: solo le pidió atención
export function isAttention(t) {
  return (
    /^((che|eva|asistente|escucha|escuchame|oye|ey|eh|espera|esperame|un momento|momento|hola|a ver) ?)+$/.test(t) ||
    /^((che|eva) )?(para|pare|espera|esperame|pera|aguarda|aguanta)( (un|una) (momento|segundo|cosa|toque))$/.test(t)
  );
}

// ---------- Por palabras sueltas ----------
// Cuando la frase no coincide con ninguna conocida, se busca la orden por sus palabras.
// Se comparan por cómo suenan: «abri», «habrí» o «abrí» valen lo mismo, y «nabega» es «navega».

function like(w, key) {
  if (w === key) return true;
  const s = sound(w);
  const k = sound(key);
  if (s === k) return true;
  if (k.length >= 4 && s.startsWith(k)) return true;
  return k.length >= 5 && s[0] === k[0] && near(s, k, 1);
}

const likeAny = (words, keys) => words.some((w) => keys.some((k) => like(w, k)));

// En orden de importancia: si dice «basta», eso gana
const WORD_ORDERS = [
  ["stop", ["basta", "frena", "frenar", "detene", "detener", "callate", "silencio", "stop"]],
  ["thanks", ["gracias"]],
  ["close", ["chau", "chao", "adios"]],
  ["newTab", ["pestana", "ventana"]],
  ["closeWork", ["cerra", "cerralo", "cerrala", "cerrar", "cerrarlo", "salir"]],
  ["open", ["abri", "abrir", "abrilo", "abrila", "abre", "abrime", "abrirlo", "abris"]],
  ["next", ["siguiente", "proximo", "proxima", "adelante"]],
  ["prev", ["anterior", "atras"]],
  ["program", ["programa", "unidades", "cursos"]],
  ["tour", ["navega", "navegar", "navegame", "recorre", "recorrer", "recorrido", "proyectos", "trabajos"]],
  ["read", ["leer", "leeme", "lectura"]],
  ["bigger", ["agranda", "agrandar", "agrandame", "aumenta", "grande", "zoom"]],
  ["smaller", ["achica", "achicar", "achicame", "reduci", "chico", "chiquito"]],
  ["contrast", ["contraste"]],
  ["font", ["legible", "fuente", "tipografia"]],
  ["links", ["enlaces", "links", "vinculos"]],
  ["pause", ["animaciones", "movimiento"]],
  ["help", ["ayuda", "ayudame"]],
  ["themes", ["tematicas"]],
  ["hello", ["hola", "buenas"]],
];

// El trabajo cuyo nombre se parece a lo que dijo (al menos la mitad de sus palabras)
function findProjectLike(words) {
  let best = null;
  let bestScore = 0;
  for (const item of PROJECT_INDEX) {
    if (!item.words.length) continue;
    const hits = item.words.filter((k) => words.some((w) => w.length >= 3 && like(w, k))).length;
    const score = hits / item.words.length;
    if (hits && score >= 0.5 && score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best ? best.project : null;
}

function findThemeLike(words) {
  for (const [slug, keys] of Object.entries(THEME_WORDS)) {
    const single = keys.filter((k) => !k.includes(" ") && k.length >= 4);
    if (THEMES[slug] && likeAny(words, single)) return slug;
  }
  return null;
}

function interpretWords(t) {
  const words = t.split(" ").filter((w) => w.length >= 2);
  if (!words.length) return null;
  // «A ver este»: Chrome a veces escribe así «abrí este»
  if (/^a ver (este|esta|ese|esa)$/.test(t)) return { type: "open", which: "this" };
  const found = WORD_ORDERS.find(([, keys]) => likeAny(words, keys));
  const order = found ? found[0] : null;
  const theme = findThemeLike(words);
  switch (order) {
    case "stop":
    case "thanks":
    case "close":
    case "newTab":
    case "help":
    case "themes":
    case "hello":
    case "program":
      return { type: order };
    case "closeWork":
      return { type: "closeWork", plain: false };
    case "open": {
      const project = findProjectLike(words);
      if (project) return { type: "open", project };
      const index = findOrdinal(t);
      return index ? { type: "open", index } : { type: "open", which: "this" };
    }
    case "next":
      return { type: "page", dir: 1 };
    case "prev":
      return { type: "page", dir: -1 };
    case "tour":
      return { type: "tour", theme };
    case "read":
      return { type: "read", selection: false };
    case "bigger":
      return { type: "size", dir: 1 };
    case "smaller":
      return { type: "size", dir: -1 };
    case "contrast":
    case "font":
    case "links":
    case "pause":
      return { type: "toggle", key: order, value: null };
    default:
      break;
  }
  // Solo el nombre de un trabajo («Pixel Quest») o de una temática («robótica»)
  const project = findProjectLike(words);
  if (project) return { type: "open", project };
  if (theme) return { type: "go", to: `/tematicas/${theme}`, label: `a ${THEMES[theme].name}` };
  return null;
}

// ---------- ¿Lo resuelve Eva sola o le pregunta a la IA? ----------
// Eva hace sola lo básico y claro (abrir, cerrar, ir a una página, leer, recorrer, siguiente, basta, ajustes).
// Las preguntas, «contame…», «explicame…» y lo que no entiende van a la IA; si la IA no está, usa lo que entendió.

const BASIC = new Set(["open", "closeWork", "page", "tour", "read", "size", "toggle", "reset", "stop", "close", "thanks", "hello", "newTab"]);
const NAV_VERBS = /(^| )(llevame|lleva|lleve|llevanos|anda|andate|ir|vamos|volve|volver|entra|entrar|subi|baja|mostrame la seccion)( |$)/;
const ASKS = /(^| )(contame|conta|contas|contanos|contar|explica|explicame|explicanos|explicas|hablame|decime|deci|que es|que son|como|cuanto|cuantos|cuantas|quien|quienes|por que|para que|de que|donde|cuando|cual|cuales|sabes)( |$)/;

export function wantsAI(raw, intent) {
  const t = normalize(raw);
  if (intent.type === "stop") return false;
  if (ASKS.test(t)) return true;
  // Abrir siempre lo resuelve la IA (entiende mejor cuál es, mirando la charla); si no responde, Eva lo intenta sola
  if (intent.type === "open") return true;
  if (intent.type === "go") return !NAV_VERBS.test(t);
  return !BASIC.has(intent.type);
}
