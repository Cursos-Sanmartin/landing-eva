import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import EvaCharacter from "./EvaCharacter";
import {
  canListen,
  canSpeak,
  listenForWakeWord,
  playChime,
  recentSpoken,
  speak,
  speechState,
  TAP_TO_TALK,
  spokenAround,
  stopSpeaking,
} from "./speech";
import {
  DEFAULTS,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_STEP,
  applySettings,
  loadSettings,
  readableBlocks,
  saveSettings,
} from "./accessibility";
import {
  THEME_NAMES,
  WAKE_PHRASE,
  freshTest,
  interpret,
  isAttention,
  isResume,
  isCallWord,
  isWakePhrase,
  lateEchoTest,
  normalize,
  wantsAI,
  withoutCall,
  withoutEcho,
} from "./commands";
import { onOpenRequest, onWakeToggledByUser, setWakeEnabled, setWakeLive, useWakeEnabled } from "./assistantStore";
import { askAI, siteFacts } from "./ai";
import {
  cardName,
  closeOpenViewer,
  currentThemeSlug,
  describeCard,
  describeTile,
  findCardByName,
  hostOf,
  openCard,
  openTab,
  openViewer,
  pickByPosition,
  programBlocks,
  projectCards,
  scrollToBand,
  sectionBlocks,
  themeTiles,
  turnViewerPage,
  waitFor,
} from "./pageGuide";
import { PROJECTS, THEMES } from "../../data/projects";
import "./Assistant.css";

// Asistente de accesibilidad de EVA (prueba).
// No se ve hasta que lo llaman: diciendo «Eva, ¿estás ahí?» (si la persona activó
// «Eva por voz» en el header), con Alt + A, o desde «Accesibilidad» en el pie de página.
// Aparece abajo a la derecha y habla con globitos, como un chat.
// Entiende voz, texto y botones, lee la página en voz alta, recorre los proyectos contándolos,
// abre y cierra trabajos, y cambia el tamaño del texto, el contraste y más.
//
// Con la voz, el micrófono queda prendido todo el tiempo que Eva está abierta (no se apaga y
// se prende entre pedido y pedido). Si la persona habla mientras Eva habla, Eva se calla en el
// acto, escucha la frase completa y hace lo que le pidieron.

const MODES = [
  { id: "voz", label: "Con la voz", hint: "Me hablás y te respondo en voz alta" },
  { id: "texto", label: "Escribiendo", hint: "Me escribís y te respondo por escrito" },
  { id: "botones", label: "Con botones", hint: "Tocás opciones listas" },
];

// Botones de pedidos rápidos: cada uno hace su acción directo (sin preguntarle a la IA)
const CHIPS = {
  program: ["Contame del programa", { type: "program" }],
  themes: ["Mostrame las temáticas", { type: "tour", theme: null, home: true }],
  team: ["Contame del equipo", { type: "sectionTour", section: "equipo" }],
  tour: ["Navegá la página", { type: "tour", theme: null }],
  first: ["Abrí el primer proyecto", { type: "open", index: 1 }],
  read: ["Leé la página", { type: "read", selection: false }],
  home: ["Llevame al inicio", { type: "go", to: "/", label: "al inicio" }],
  next: ["Siguiente proyecto", { type: "page", dir: 1 }],
  prev: ["Proyecto anterior", { type: "page", dir: -1 }],
  closeWork: ["Cerrá el trabajo", { type: "closeWork", plain: false }],
  bigger: ["Agrandá el texto", { type: "size", dir: 1 }],
  smaller: ["Achicá el texto", { type: "size", dir: -1 }],
  help: ["¿Qué podés hacer?", { type: "help" }],
};

// De a tres, según dónde está la persona; «Otras opciones» pasa al grupo siguiente
function chipGroups(place, s) {
  const chip = (id) => ({ id, label: CHIPS[id][0], intent: CHIPS[id][1] });
  const toggle = (key, on, off) => ({ id: key, label: s[key] ? off : on, intent: { type: "toggle", key, value: null } });
  const contrast = toggle("contrast", "Alto contraste", "Sacá el alto contraste");
  const font = toggle("font", "Letra más legible", "Volvé a la letra de antes");
  const links = toggle("links", "Resaltá los enlaces", "Sacá el resaltado de enlaces");
  const extra = s.scale > 1 ? chip("smaller") : chip("help");
  if (place === "home") {
    return [
      [chip("program"), chip("themes"), chip("team")],
      [chip("read"), chip("bigger"), contrast],
      [font, links, extra],
    ];
  }
  const theme = [
    [chip("tour"), chip("first"), chip("read")],
    [chip("themes"), chip("program"), chip("home")],
    [chip("bigger"), contrast, font],
    [links, extra, chip("team")],
  ];
  return place === "work" ? [[chip("next"), chip("prev"), chip("closeWork")], ...theme] : theme;
}

const ABOUT =
  "EVA (Entornos Virtuales de Aprendizaje) es un programa donde estudiantes de San Martín idean y desarrollan " +
  "proyectos mientras aprenden herramientas digitales, con Aprendizaje Basado en Proyectos. " +
  "En este sitio podés ver lo que crearon en 10 temáticas.";
const HELP =
  "Puedo recorrer la página y contarte qué proyectos hay, abrir un trabajo y cerrarlo, leerte la página en voz alta, " +
  "agrandar el texto, activar alto contraste, poner una letra más fácil de leer, resaltar los enlaces, " +
  "pausar las animaciones y llevarte a cualquier temática. " +
  "Por ejemplo: «navegá la página», «abrí el primero» o «llevame a robótica». Para cerrarme, decí «chau».";
const DONE = "Listo. ¿En qué más te puedo ayudar?";
const HELLO = "¡Hola! ¿En qué puedo ayudarte?";
const BYE = "¡Chau! Llamame cuando quieras.";
const THANKS_BYE = "¡De nada! Cuando me necesites, llamame.";
const BLOCKED = "Como no estoy autorizada a abrir enlaces externos, tocá Enter y se abre en otra pestaña.";
const SORRY_VOICE = "Perdón, ¿podrías repetirme? No entendí tu pedido.";
const SORRY_TEXT = "Perdón, no entendí tu pedido. ¿Me lo escribís de otra forma?";

const WAKE_ERRORS = {
  unsupported: "Tu navegador no permite llamar a Eva con la voz. Probá con Chrome o Edge, o abrila con Alt + A.",
  "not-allowed":
    "El navegador no dio permiso al micrófono. Podés habilitarlo desde el candado de la barra de direcciones.",
  "service-not-allowed":
    "El navegador no dio permiso al micrófono. Podés habilitarlo desde el candado de la barra de direcciones.",
  "audio-capture": "No encontré un micrófono conectado.",
};

// Tiempos de la charla (en milisegundos)
const GAP_TOUR = 1200; // pausa entre proyecto y proyecto, para que la persona pueda hablar
const GAP_PAGE = 700; // pausa entre párrafos al leer la página
const ECHO_TAIL = 250; // lo que llega apenas se calla todavía es su voz
const ECHO_GRACE = 1200; // hasta acá pueden llegar sus últimas palabras (Chrome tarda en escribirlas)
const HOLD_QUIET = 1500; // sin palabras nuevas por este tiempo: la persona terminó de hablar
const HOLD_SETTLE = 600; // frase cerrada pero incompleta: un ratito por si sigue
const HOLD_MAX = 8000; // como mucho escucha una frase este tiempo
const PAUSE_WAIT = 8000; // recorrido en pausa: si no le piden nada, sigue

// En el celular (TAP_TO_TALK) se habla tocando el micrófono o a Eva: cada toque es una escucha.
// Mientras Eva habla el micrófono está apagado; si la tocás, se calla y te escucha.

function greeting(mode) {
  if (!mode) {
    return (
      "¡Hola! Soy Eva, la asistente de este sitio. Puedo leerte la página, agrandar el texto " +
      "y llevarte a donde quieras. ¿Cómo preferís comunicarte?"
    );
  }
  return HELLO;
}

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getMotion = () => window.matchMedia(MOTION_QUERY).matches;

// Con la pestaña en segundo plano no escuchamos
function subscribeVisibility(callback) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}
const getVisible = () => document.visibilityState !== "hidden";

// Lo que Eva cuenta al mostrar un trabajo: qué es, de qué escuela y de qué se trata
function presentProject(name) {
  const p = PROJECTS.find((item) => item.name === name);
  if (!p) return `Te muestro «${name}». ¿Querés ver otro?`;
  const school = p.school ? `, de ${p.school}` : "";
  const about = p.description ? ` ${p.description.trim().replace(/([^.!?])$/, "$1.")}` : "";
  return `Te muestro «${p.name}»${school}.${about} ¿Querés ver otro?`;
}

// Al llegar a una temática: cuántos trabajos tiene y qué puede hacer ahí
function placeSummary(to) {
  const slug = to.match(/^\/tematicas\/([^/#?]+)/)?.[1];
  const theme = slug && THEMES[slug];
  if (!theme) return DONE;
  const n = PROJECTS.filter((p) => p.theme === slug).length;
  if (n === 1) return `Listo, estás en ${theme.name}: tiene un proyecto. ¿Querés que te lo muestre?`;
  return `Listo, estás en ${theme.name}: tiene ${n} proyectos. ¿Querés que te los cuente o que te muestre alguno?`;
}

// Si hay un trabajo abierto en la ventana del sitio (los botones ofrecen «siguiente», «anterior», «cerrar»)
function subscribeViewer(callback) {
  const watch = new MutationObserver(callback);
  watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
  return () => watch.disconnect();
}
const getViewer = () => Boolean(openViewer());

// Pantallas chicas (celular): la charla muestra solo lo último
const COMPACT_QUERY = "(max-width: 40rem), (max-height: 30rem)";
function subscribeCompact(callback) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getCompact = () => window.matchMedia(COMPACT_QUERY).matches;

// Lo último de la charla: tu último pedido y lo que te contestó Eva.
// Mientras hablás, solo lo último de Eva; mientras recorre, solo lo que está diciendo.
function lastTurn(list, { draft, caption }) {
  if (caption) return [];
  const last = list[list.length - 1];
  if (!last) return list;
  if (last.from === "user") return draft ? [] : [last];
  if (draft) return [last];
  const before = list[list.length - 2];
  return before?.from === "user" ? [before, last] : [last];
}

const clampScale = (v) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, v));

// ¿Con esto ya se puede hacer algo, o conviene esperar a que termine la frase?
function isActionable(text) {
  const type = interpret(text).type;
  return (type !== "unknown" && type !== "empty") || isResume(normalize(text));
}

function Assistant() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [settings, setSettings] = useState(loadSettings);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("chat");
  const [messages, setMessages] = useState(() => [{ id: 1, from: "eva", text: greeting(settings.mode) }]);
  const [input, setInput] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [reading, setReading] = useState(false);
  const [caption, setCaption] = useState("");
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [web, setWeb] = useState(null); // página web de un trabajo, mostrada adentro del sitio
  const [chipTurn, setChipTurn] = useState({ place: "", n: 0 }); // qué grupo de botones se ve
  const [usedVoice, setUsedVoice] = useState(false);
  const systemReduced = useSyncExternalStore(subscribeMotion, getMotion, () => false);
  const visible = useSyncExternalStore(subscribeVisibility, getVisible, () => true);
  const compact = useSyncExternalStore(subscribeCompact, getCompact, () => false);
  const viewerOpen = useSyncExternalStore(subscribeViewer, getViewer, () => false);
  const wakeEnabled = useWakeEnabled();
  const reduced = systemReduced || settings.pause;

  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const logRef = useRef(null);
  const settingsRef = useRef(settings);
  const reducedRef = useRef(reduced);
  const msgId = useRef(1);
  const speakId = useRef(0);
  const announceWake = useRef(false);
  const voiceSession = useRef(false);
  const lastByVoice = useRef(false);
  const returnFocus = useRef(null);
  const thinkTimer = useRef(0);
  const toastTimer = useRef(0);
  const waitTimer = useRef(0);
  const readQueue = useRef({ list: [], i: 0, node: null, after: null });
  const lastCard = useRef(null);
  const hold = useRef(null);
  const segs = useRef(new Map());
  const misses = useRef(0);
  const greeted = useRef(false);
  const webRef = useRef(null);
  const webLinkRef = useRef(null);
  const aiToken = useRef(0);
  const facts = useRef(null);
  const messagesRef = useRef(messages);

  // Aplicar y recordar los ajustes
  useEffect(() => {
    settingsRef.current = settings;
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  // Al abrir, el foco va a la primera opción o a la caja de texto
  useEffect(() => {
    if (!open) return;
    const target = panelRef.current?.querySelector("[data-autofocus]") || inputRef.current;
    target?.focus({ preventScroll: true });
  }, [open, view]);

  // La charla, para pasársela a la IA (así entiende «sí», «ese», «el que me dijiste»)
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // El último globito siempre a la vista
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, caption, draft, open, view]);

  // ---------- Avisos cortos ----------

  function showToast(text) {
    window.clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = window.setTimeout(() => setToast(""), 6000);
  }

  // ---------- Mensajes y voz ----------

  function addMessage(from, text) {
    msgId.current += 1;
    const id = msgId.current;
    setMessages((list) => [...list.slice(-40), { id, from, text }]);
  }

  function speakOut(text, after) {
    speakId.current += 1;
    const id = speakId.current;
    setSpeaking(true);
    speak(text, {
      onEnd: () => {
        if (speakId.current !== id) return;
        setSpeaking(false);
        after?.();
      },
    });
  }

  // Eva se calla (sin terminar la lectura)
  function hush() {
    speakId.current += 1;
    stopSpeaking();
    setSpeaking(false);
  }

  // Eva responde: siempre en un globito y, si está activado, también en voz alta.
  // Si le hablaron, contesta hablando. Después se queda escuchando hasta que se despidan.
  function say(text, after) {
    addMessage("eva", text);
    if ((settingsRef.current.voice || voiceSession.current) && canSpeak) speakOut(text, after);
    else after?.();
  }

  // Página web de un trabajo, adentro del sitio: así Eva la puede cerrar y sigue escuchando
  function showWeb(value) {
    webRef.current = value;
    setWeb(value);
  }

  function clearReadingMark() {
    readQueue.current.node?.classList.remove("eva-reading");
    readQueue.current.node?.removeAttribute("data-eva-reading");
    readQueue.current.node = null;
  }

  // Antes de recorrer o leer, cierra el trabajo o la página que esté abierta
  function closeOthers() {
    showWeb(null);
    closeOpenViewer();
  }

  function stopAll() {
    hush();
    dropHold();
    // Celular: «Detener» deja todo en silencio, también el micrófono
    if (TAP_TO_TALK) setMicOn(false);
    aiToken.current += 1;
    setThinking(false);
    window.clearTimeout(waitTimer.current);
    clearReadingMark();
    readQueue.current = { list: [], i: 0, node: null, after: null };
    setReading(false);
    setCaption("");
  }

  // ---------- Esperar el próximo pedido ----------

  // Recorrido en pausa: espera el pedido y, si no llega, sigue
  function waitInPause() {
    if (!readQueue.current.paused) return;
    setReading("paused");
    window.clearTimeout(waitTimer.current);
    waitTimer.current = window.setTimeout(() => {
      if (hold.current || !readQueue.current.paused) return;
      say("Sigo.", () => resumeReading(0));
    }, PAUSE_WAIT);
  }

  // ---------- Leer la página ----------

  function readNext() {
    const queue = readQueue.current;
    if (queue.i >= queue.list.length) {
      clearReadingMark();
      const after = queue.after;
      queue.after = null;
      queue.inGap = false;
      setReading(false);
      setSpeaking(false);
      setCaption("");
      after?.();
      return;
    }
    const block = queue.list[queue.i];
    const first = queue.i === 0;
    queue.i += 1;
    speakId.current += 1;
    const id = speakId.current;

    const go = () => {
      if (speakId.current !== id) return;
      queue.inGap = false;
      clearReadingMark();
      if (block.log) {
        addMessage("eva", block.text);
        setCaption("");
      } else {
        setCaption(block.text);
      }
      if (block.node) {
        block.node.classList.add("eva-reading");
        block.node.setAttribute("data-eva-reading", "");
        if (block.band) scrollToBand(block.node, !reducedRef.current);
        else block.node.scrollIntoView({ block: "center", behavior: reducedRef.current ? "auto" : "smooth" });
        queue.node = block.node;
        // «abrí este» abre el trabajo que está contando
        const card = block.node.closest?.(".project-card");
        if (card) {
          queue.prevCard = queue.currentCard || null;
          queue.currentCard = card;
          queue.cardAt = performance.now();
          lastCard.current = card;
        }
      }
      setSpeaking(true);
      speak(block.text, {
        onEnd: () => {
          if (speakId.current === id) readNext();
        },
      });
    };
    // Entre proyecto y proyecto hace una pausa: mientras Eva habla, muchas compus
    // bajan el micrófono para no oírla, así que en la pausa se oye mejor a la persona
    // Al leer la página: pausa larga entre un trabajo (o sección) y el siguiente, corta dentro del mismo
    const big = !queue.smallGap || block.breakBefore;
    const wait = big ? queue.gap : queue.smallGap;
    if (wait && !first && !queue.skipGap) {
      queue.inGap = true;
      setSpeaking(false);
      window.setTimeout(go, wait);
    } else {
      go();
    }
    queue.skipGap = false;
  }

  // Deja la lectura en pausa. queue.cur es «este»: lo que estaba contando o lo que acaba de contar
  function pauseAtCurrent(heardAt, byVoice) {
    const queue = readQueue.current;
    if (!queue.list.length || queue.paused) return;
    queue.pausedInGap = Boolean(queue.inGap);
    queue.cur = Math.max(0, queue.i - (queue.inGap ? 2 : 1));
    // Si recién había empezado otro proyecto, seguramente reaccionó al anterior
    if (!queue.inGap && queue.kind === "tour" && queue.prevCard?.isConnected && heardAt - (queue.cardAt || 0) < 1200) {
      clearReadingMark();
      queue.prevCard.classList.add("eva-reading");
      queue.prevCard.setAttribute("data-eva-reading", "");
      queue.node = queue.prevCard;
      queue.currentCard = queue.prevCard;
      lastCard.current = queue.prevCard;
      queue.cur = Math.max(1, queue.cur - 1);
      queue.pausedInGap = true;
    }
    queue.paused = true;
    queue.inGap = false;
    hush();
    if (byVoice) voiceSession.current = true;
    setReading("paused");
    setCaption("");
  }

  // Retoma: «seguí» (0), el siguiente (1) o el anterior (−1)
  function resumeReading(dir) {
    const queue = readQueue.current;
    if (!queue.paused) return;
    window.clearTimeout(waitTimer.current);
    queue.paused = false;
    const first = queue.kind === "page" ? 0 : 1;
    if (dir > 0) queue.i = queue.cur + 1;
    else if (dir < 0) queue.i = Math.max(first, queue.cur - 1);
    else queue.i = queue.pausedInGap ? queue.cur + 1 : queue.cur;
    queue.skipGap = true; // al retomar arranca enseguida
    setReading(queue.kind === "page" ? "page" : "tour");
    readNext();
  }

  // Lo que le pidieron con la lectura en pausa
  function handlePausedCommand(raw) {
    const t = normalize(raw);
    addMessage("user", raw.trim());
    // «Pará un momento», «esperá»: solo quiere que espere
    const intent = isAttention(t) ? { type: "hello" } : interpret(raw);
    const known = intent.type !== "unknown" && intent.type !== "empty" && intent.type !== "hello";
    if (!known && isResume(t)) {
      misses.current = 0;
      resumeReading(0);
      return;
    }
    if (!known && (intent.type === "hello" || isAttention(t))) {
      say("¿Sí? Decime.", waitInPause);
      return;
    }
    if (!known || wantsAI(raw, intent)) {
      // Antes de pedir que repita, le pregunta a la IA
      window.clearTimeout(waitTimer.current);
      setThinking(true);
      aiToken.current += 1;
      const token = aiToken.current;
      askAI(raw, aiContext()).then((ai) => {
        if (aiToken.current !== token) return;
        setThinking(false);
        if (!readQueue.current.paused) return;
        if (ai) routePaused(ai);
        else if (known) routePaused(intent);
        else sorryInPause();
      });
      return;
    }
    routePaused(intent);
  }

  function sorryInPause() {
    misses.current += 1;
    if (misses.current >= 3) {
      misses.current = 0;
      say("Perdón, no te entendí. Sigo.", () => resumeReading(0));
      return;
    }
    say(lastByVoice.current ? SORRY_VOICE : SORRY_TEXT, waitInPause);
  }

  // Hace el pedido que llegó con la lectura en pausa
  function routePaused(intent) {
    const queue = readQueue.current;
    misses.current = 0;
    if (intent.type === "resume") {
      resumeReading(0);
      return;
    }
    if (intent.type === "hello") {
      say("¿Sí? Decime.", waitInPause);
      return;
    }
    // Una pregunta en medio del recorrido: contesta y queda esperando («seguí» para continuar)
    if (intent.type === "answer") {
      say(intent.text, waitInPause);
      return;
    }
    if (intent.type === "page") {
      resumeReading(intent.dir);
      return;
    }
    if (intent.type === "open" && intent.which === "this") {
      const card = queue.currentCard?.isConnected ? queue.currentCard : null;
      stopAll();
      openWork(card ? { card, quiet: true } : intent);
      return;
    }
    stopAll();
    if (intent.type === "stop") say(DONE);
    else runIntent(intent);
  }

  function selectedText() {
    return window.getSelection?.().toString().trim() || "";
  }

  // Con la voz se puede interrumpir la lectura, salvo que la persona haya elegido escribir
  function canTalk() {
    return (
      canListen && (settingsRef.current.mode !== "texto" || wakeEnabled || usedVoice || voiceSession.current)
    );
  }

  function startReading(useSelection) {
    stopAll();
    closeOthers();
    const picked = useSelection ? selectedText() : "";
    const list = picked ? [{ node: null, text: picked }] : readableBlocks();
    if (!list.length) {
      say("No encontré texto para leer en esta página.");
      return;
    }
    if (canTalk() && !TAP_TO_TALK) setMicOn(true);
    // Cada trabajo o sección es un grupo: entre grupos hace la pausa larga
    let prevGroup;
    list.forEach((block, i) => {
      const group = block.node?.closest?.("article, section") || null;
      block.breakBefore = i > 0 && group !== prevGroup;
      prevGroup = group;
    });
    readQueue.current = {
      list,
      i: 0,
      node: null,
      after: null,
      kind: "page",
      gap: GAP_TOUR,
      smallGap: 500,
    };
    setReading("page");
    readNext();
  }

  // ---------- Recorrido: baja por la página y cuenta los proyectos ----------

  async function startTour(slug) {
    stopAll();
    closeOthers();
    if (slug && slug !== currentThemeSlug()) {
      navigate(`/tematicas/${slug}`);
      await waitFor(() => currentThemeSlug() === slug && projectCards().length > 0, 2000);
    }

    let list;
    let outro;
    const cards = projectCards();
    const here = currentThemeSlug();
    if (cards.length) {
      const name = THEMES[here]?.name || "esta temática";
      const count = cards.length === 1 ? "un proyecto" : `${cards.length} proyectos`;
      list = [
        { text: `En ${name} hay ${count}. Te los cuento.`, log: true },
        ...cards.map((card) => ({ node: card, text: describeCard(card) })),
      ];
      outro = "Eso es todo. Si querés ver alguno, decime «abrí» y el nombre, «abrí el primero» o «abrí este».";
    } else if (here) {
      say("En esta temática todavía no hay proyectos publicados.");
      return;
    } else {
      // En el inicio: las temáticas y cuántos proyectos tiene cada una
      if (!themeTiles().length) {
        navigate("/#tematicas");
        await waitFor(() => themeTiles().length > 0, 2000);
      }
      const tiles = themeTiles();
      if (!tiles.length) {
        say("En esta página no encontré proyectos para mostrarte.");
        return;
      }
      list = [
        { text: `Hay ${tiles.length} temáticas. Te cuento cuántos proyectos tiene cada una.`, log: true },
        ...tiles.map((tile) => ({ node: tile.node, text: describeTile(tile) })),
      ];
      outro = "¿A cuál querés entrar? Decime, por ejemplo, «llevame a robótica» o «entrá a la primera».";
    }
    list.push({ text: outro, log: true });
    if (canTalk() && !TAP_TO_TALK) setMicOn(true);
    readQueue.current = {
      list,
      i: 0,
      node: null,
      after: null,
      kind: "tour",
      gap: GAP_TOUR,
      currentCard: null,
      prevCard: null,
      cardAt: 0,
    };
    setReading("tour");
    readNext();
  }

  // ---------- Abrir, cerrar y pasar páginas de un trabajo ----------

  async function openWork(intent) {
    let card;
    if (intent.card) {
      card = intent.card;
    } else if (intent.project) {
      card = findCardByName(intent.project.name);
      if (!card) {
        navigate(`/tematicas/${intent.project.theme}`);
        card = await waitFor(() => findCardByName(intent.project.name), 2500);
      }
      if (!card) {
        say(`No encontré «${intent.project.name}» en la página.`);
        return;
      }
    } else if (intent.index) {
      const cards = projectCards();
      if (!cards.length) {
        // En el inicio, «entrá a la tercera» lleva a esa temática
        const tile = pickByPosition(themeTiles(), intent.index);
        if (tile) {
          navigate(tile.to);
          say(`Te llevo a ${tile.name}.`);
        } else {
          say("Acá no hay trabajos. Entrá a una temática, por ejemplo: «llevame a robótica».");
        }
        return;
      }
      card = pickByPosition(cards, intent.index);
      if (!card) {
        say(`En esta página hay ${cards.length === 1 ? "un trabajo" : `${cards.length} trabajos`}.`);
        return;
      }
    } else {
      card = lastCard.current?.isConnected ? lastCard.current : null;
      if (!card) {
        say("¿Cuál querés que abra? Decime el nombre del trabajo, o «el primero».");
        return;
      }
    }

    // Primero cierra lo que esté abierto, así queda uno solo
    showWeb(null);
    closeOpenViewer();
    lastCard.current = card;
    card.scrollIntoView({ block: "center", behavior: reducedRef.current ? "auto" : "smooth" });
    const name = cardName(card);
    const opened = openCard(card);
    // Lo presenta (o dice lo que armó la IA); si lo acaba de contar en el recorrido, solo «Listo»
    const told = intent.quiet ? DONE : intent.reply || presentProject(name);
    if (opened.result === "frame") {
      showWeb({ name, url: opened.frame, href: opened.href });
      say(told);
    } else if (opened.result === "viewer" || opened.result === "web") say(told);
    else if (opened.result === "blocked") say(BLOCKED);
    else say(`No pude abrir «${name}».`);
  }

  // «Abrila en otra pestaña»: la página web que está mostrando
  function openWebInTab() {
    const current = webRef.current;
    if (!current) {
      say("No hay ninguna página web abierta.");
      return;
    }
    if (openTab(current.href, webLinkRef.current) === "web") {
      showWeb(null);
      say(DONE);
    } else {
      say(BLOCKED);
    }
  }

  function closeWork(plain) {
    if (webRef.current) {
      showWeb(null);
      say(DONE);
      return;
    }
    if (closeOpenViewer()) {
      say(DONE);
      return;
    }
    if (plain) {
      say(BYE, () => closePanel());
      return;
    }
    say("No hay ningún trabajo abierto.");
  }

  // «Siguiente» / «anterior». Con un documento abierto pasa de página; si pide «el siguiente proyecto»,
  // si hay una página web abierta o si el documento ya terminó, abre el trabajo que sigue.
  function handlePage(intent) {
    if (!intent.item && openViewer()) {
      const { result } = turnViewerPage(intent.dir);
      if (result === "ok") {
        say(DONE);
        return;
      }
      if (intent.sheet) {
        if (result === "single") say("Este trabajo tiene una sola página.");
        else say(intent.dir > 0 ? "Ya estás en la última página." : "Ya estás en la primera página.");
        return;
      }
    }
    nextProject(intent.dir);
  }

  function nextProject(dir) {
    const cards = projectCards();
    if (!cards.length) {
      say("En esta página no hay trabajos. Pedime, por ejemplo, «llevame a robótica».");
      return;
    }
    // El trabajo de referencia: el que está abierto, o el último que abrió o contó Eva
    const current = openViewer()?.closest(".project-card") || (lastCard.current?.isConnected ? lastCard.current : null);
    const at = current ? cards.indexOf(current) : -1;
    const i = at < 0 ? (dir > 0 ? 0 : cards.length - 1) : at + dir;
    if (i >= cards.length) {
      say("Ese era el último trabajo de esta página. ¿En qué más te puedo ayudar?");
      return;
    }
    if (i < 0) {
      say("Ese era el primer trabajo de esta página. ¿En qué más te puedo ayudar?");
      return;
    }
    showWeb(null);
    closeOpenViewer();
    openWork({ card: cards[i] });
  }

  // ---------- Secciones del inicio ----------

  // Muestra una sección mientras contesta algo sobre ella
  function showSection(section) {
    const node = document.getElementById(section);
    if (node) node.scrollIntoView({ block: "start", behavior: reducedRef.current ? "auto" : "smooth" });
    else navigate(`/#${section}`);
  }

  // «Contame del equipo»: va a la sección y la cuenta tarjeta por tarjeta
  async function startSectionTour(section) {
    if (section === "programa") {
      startProgramTour();
      return;
    }
    stopAll();
    closeOthers();
    if (!document.getElementById(section)) {
      navigate(`/#${section}`);
      await waitFor(() => document.getElementById(section), 2500);
    }
    const blocks = sectionBlocks(section);
    if (!blocks.length) {
      say("No encontré esa sección en la página.");
      return;
    }
    if (canTalk() && !TAP_TO_TALK) setMicOn(true);
    const intro = section === "equipo" ? "Te presento al equipo." : "Te cuento esta sección.";
    readQueue.current = {
      list: [{ text: intro, log: true }, ...blocks, { text: "¿En qué más te puedo ayudar?", log: true }],
      i: 0,
      node: null,
      after: null,
      kind: "program",
      gap: GAP_PAGE,
    };
    setReading("tour");
    readNext();
  }

  // Las temáticas del inicio, aunque esté en otra página
  async function startHomeTour() {
    if (currentThemeSlug() || !themeTiles().length) {
      navigate("/#tematicas");
      await waitFor(() => !currentThemeSlug() && themeTiles().length > 0, 2500);
    }
    startTour(null);
  }

  // ---------- «Contame de qué trata el programa» ----------
  // Va a la sección del programa y la cuenta paso a paso: cada unidad se activa al llegar,
  // así la tarjeta «Tu trabajo final» se va armando mientras Eva habla.

  async function startProgramTour() {
    stopAll();
    closeOthers();
    if (!document.querySelector("#programa .step")) {
      navigate("/#programa");
      await waitFor(() => document.querySelector("#programa .step"), 2500);
    }
    const blocks = programBlocks();
    if (!blocks.length) {
      say(ABOUT);
      return;
    }
    if (canTalk() && !TAP_TO_TALK) setMicOn(true);
    const list = [
      { text: "Te cuento de qué se trata el programa.", log: true },
      ...blocks,
      { text: `Así se arma tu proyecto en EVA, paso a paso. ${DONE.replace("Listo. ", "")}`, log: true },
    ];
    readQueue.current = { list, i: 0, node: null, after: null, kind: "program", gap: GAP_TOUR };
    setReading("tour");
    readNext();
  }

  // ---------- Lo que oye el micrófono ----------
  //
  // Chrome va mandando lo que entiende de cada frase. Al principio de una frase puede estar la voz de
  // Eva (el micrófono la oye por los parlantes): esas palabras se filtran. Apenas aparece una palabra
  // de la persona, Eva se calla, junta la frase completa y recién ahí hace el pedido.

  function onHeard(raw, isFinal, heardAt, key) {
    const t = normalize(raw);
    const words = t ? t.split(" ") : [];
    let seg = segs.current.get(key);
    if (!seg) {
      seg = { checked: 0, from: -1, used: 0, count: 0 };
      segs.current.set(key, seg);
      if (segs.current.size > 60) segs.current.delete(segs.current.keys().next().value);
    }
    // Palabras nuevas de esta frase: ¿la primera de la persona?
    if (seg.from < 0 && words.length > seg.checked) {
      const { talking, quietAt } = speechState();
      const since = heardAt - quietAt;
      let isUser = () => true;
      if (talking || since < ECHO_TAIL) {
        isUser = freshTest(normalize(spokenAround(heardAt)));
      } else if (!hold.current && since < ECHO_GRACE) {
        const echo = lateEchoTest(normalize(spokenAround(quietAt, 1000, 0)));
        isUser = (w) => !echo(w);
      }
      for (let i = seg.checked; i < words.length; i++) {
        // «Eva», «¿estás ahí?»: lo que queda de llamarla no es un pedido
        if (isUser(words[i]) && !isCallWord(words[i])) {
          seg.from = i;
          break;
        }
      }
      seg.checked = seg.from >= 0 ? seg.from : words.length;
    }
    seg.count = words.length;
    const said = seg.from < 0 ? "" : withoutCall(words.slice(Math.max(seg.from, seg.used)).join(" "));

    let h = hold.current;
    if (!h) {
      if (!said) return;
      h = beginHold(heardAt);
    }
    if (said || h.parts.has(key)) h.parts.set(key, said);
    if (isFinal) h.finals.add(key);
    else h.finals.delete(key);

    const text = holdText(h);
    setDraft(text);
    window.clearTimeout(h.quiet);
    const closed = [...h.parts.keys()].every((k) => h.finals.has(k));
    if (closed && text && isActionable(text)) {
      finishHold();
      return;
    }
    h.quiet = window.setTimeout(() => finishHold(), closed ? HOLD_SETTLE : HOLD_QUIET);
  }

  // La persona empezó a hablar: Eva se calla en el acto y escucha
  function beginHold(heardAt) {
    window.clearTimeout(waitTimer.current);
    const h = { parts: new Map(), finals: new Set(), quiet: 0, max: 0 };
    hold.current = h;
    voiceSession.current = true;
    lastByVoice.current = true;
    const queue = readQueue.current;
    if (queue.list.length && !queue.paused) pauseAtCurrent(heardAt, true);
    else hush();
    if (readQueue.current.paused) setReading("holding");
    h.max = window.setTimeout(() => finishHold(), HOLD_MAX);
    return h;
  }

  function dropHold() {
    const h = hold.current;
    if (!h) return;
    hold.current = null;
    window.clearTimeout(h.quiet);
    window.clearTimeout(h.max);
    for (const key of h.parts.keys()) {
      const seg = segs.current.get(key);
      if (seg) seg.used = seg.count;
    }
    setDraft("");
  }

  // Si la frase no se entiende, prueba sin las palabras de Eva que se colaron
  function clearText(text) {
    if (!text || isActionable(text)) return text;
    const eva = [normalize(spokenAround(speechState().quietAt, 4000, 1500))];
    const clean = withoutEcho(text, eva);
    if (clean && isActionable(clean)) return clean;
    const bare = withoutEcho(text, eva, false);
    if (bare && isAttention(bare)) return bare;
    // Para la IA, mejor sin las palabras de Eva que se colaron
    return clean || text;
  }

  // ¿Lo que «escuchó» es casi todo lo que Eva acaba de decir? Entonces es su propia voz que volvió
  function looksLikeEcho(text) {
    const words = normalize(text)
      .split(" ")
      .filter((w) => w.length >= 3);
    if (words.length < 3) return false;
    const eva = new Set(normalize(recentSpoken(3)).split(" "));
    return words.filter((w) => eva.has(w)).length / words.length >= 0.8;
  }

  // Terminó de hablar: hace el pedido
  // Lo que dijo la persona hasta ahora, sin lo que se coló de la voz de Eva
  function holdText(h) {
    return clearText([...h.parts.values()].filter(Boolean).join(" ").trim());
  }

  function finishHold() {
    const h = hold.current;
    if (!h) return;
    const text = holdText(h);
    // Celular: esa escucha ya se usó; para seguir hablando, se vuelve a tocar
    if (TAP_TO_TALK) setMicOn(false);
    dropHold();
    if (looksLikeEcho(text)) {
      if (readQueue.current.paused) resumeReading(0);
      return;
    }
    if (readQueue.current.paused) {
      setReading("paused");
      if (text) handlePausedCommand(text);
      else resumeReading(0);
      return;
    }
    if (text) handleText(text);
  }

  // ---------- Entender y hacer ----------

  function handleText(raw) {
    const text = raw.trim();
    if (!text) return;
    addMessage("user", text);
    const intent = interpret(text);
    if (intent.type === "stop") {
      runIntent(intent);
      return;
    }
    setThinking(true);
    window.clearTimeout(thinkTimer.current);
    aiToken.current += 1;
    const token = aiToken.current;
    // Preguntas, «contame…» y lo que no entiende sola: le pregunta a la IA.
    // Si la IA no está, hace lo que entendió (o pide que repitan).
    if (wantsAI(text, intent)) {
      askAI(text, aiContext()).then((ai) => {
        if (aiToken.current !== token) return;
        setThinking(false);
        runIntent(ai || intent);
      });
      return;
    }
    thinkTimer.current = window.setTimeout(
      () => {
        setThinking(false);
        runIntent(intent);
      },
      reducedRef.current ? 120 : 450,
    );
  }

  // Lo que la IA necesita saber para entender el pedido
  function aiContext() {
    facts.current = facts.current || siteFacts(ABOUT);
    const here = currentThemeSlug();
    let page = window.location.pathname;
    if (here) page = `temática ${THEMES[here]?.name || here}`;
    else if (page === "/") page = "inicio";
    return {
      ...facts.current,
      units: Array.from(document.querySelectorAll("#programa .step h3"), (h) => h.textContent.trim()),
      page,
      // Los de esta página, en orden (los datos de cada uno ya van en la lista de todo el sitio)
      projectsHere: projectCards().map(cardName),
      history: messagesRef.current.slice(-8).map((m) => ({ from: m.from, text: m.text })),
      lastOpened: lastCard.current?.isConnected ? cardName(lastCard.current) : null,
      current: readQueue.current.currentCard?.isConnected ? cardName(readQueue.current.currentCard) : null,
      openWork: Boolean(webRef.current || openViewer()),
      paused: Boolean(readQueue.current.paused),
    };
  }

  function setSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function runIntent(intent) {
    const current = settingsRef.current;
    switch (intent.type) {
      case "stop":
        stopAll();
        say(DONE);
        break;
      case "close":
        say(BYE, () => closePanel());
        break;
      case "newTab":
        openWebInTab();
        break;
      case "closeWork":
        closeWork(intent.plain);
        break;
      case "page":
        handlePage(intent);
        break;
      case "open":
        openWork(intent);
        break;
      case "tour":
        if (!canSpeak) {
          say("Tu navegador no tiene voz para contarte los proyectos.");
          break;
        }
        if (intent.home) startHomeTour();
        else startTour(intent.theme);
        break;
      case "read": {
        if (!canSpeak) {
          say("Tu navegador no tiene voz para leer en voz alta.");
          break;
        }
        // «Llevame a robótica y leémela»: primero va, y cuando la página está lista, lee
        if (intent.to) {
          navigate(intent.to);
          addMessage("eva", "Te llevo y te leo la página. Tocá «Detener» cuando quieras.");
          window.setTimeout(() => startReading(false), 700);
          break;
        }
        const what = intent.selection && selectedText() ? "lo que marcaste" : "la página";
        addMessage("eva", `Te leo ${what}. Tocá «Detener» cuando quieras.`);
        startReading(intent.selection);
        break;
      }
      case "size": {
        const next = intent.dir === 0 ? 1 : clampScale(current.scale + intent.dir * SCALE_STEP);
        if (next === current.scale) {
          say(intent.dir > 0 ? "El texto ya está en el tamaño más grande." : "El texto ya está en su tamaño normal.");
          break;
        }
        setSetting("scale", next);
        say(DONE);
        break;
      }
      case "toggle": {
        const value = intent.value ?? !current[intent.key];
        if (intent.key === "voice") {
          setSetting("voice", value);
          if (value) {
            addMessage("eva", DONE);
            if (canSpeak) speakOut(DONE);
          } else {
            stopAll();
            addMessage("eva", "Listo, te respondo solo por escrito. ¿En qué más te puedo ayudar?");
          }
          break;
        }
        setSetting(intent.key, value);
        say(DONE);
        break;
      }
      case "reset":
        setSettings((s) => ({ ...DEFAULTS, mode: s.mode, voice: s.voice }));
        say(DONE);
        break;
      case "themes":
        say(`Hay ${THEME_NAMES.length} temáticas: ${THEME_NAMES.join(", ")}. ¿A cuál te llevo?`);
        break;
      case "go":
        navigate(intent.to);
        // En una temática cuenta qué hay; si la IA armó la respuesta, dice esa
        say(intent.reply || placeSummary(intent.to));
        break;
      case "about":
      case "program":
        if (!canSpeak) {
          say(ABOUT);
          break;
        }
        startProgramTour();
        break;
      case "help":
        say(HELP);
        break;
      case "hello":
        say(HELLO);
        break;
      case "howareyou":
        say("¡Muy bien, gracias! ¿En qué puedo ayudarte?");
        break;
      // «Muchas gracias por la ayuda»: se despide
      case "thanks":
        say(THANKS_BYE, () => closePanel());
        break;
      case "answer":
        if (intent.section) showSection(intent.section);
        say(intent.text);
        break;
      case "sectionTour":
        startSectionTour(intent.section);
        break;
      case "resume":
        say(DONE);
        break;
      case "empty":
        break;
      default:
        say(lastByVoice.current ? SORRY_VOICE : SORRY_TEXT);
    }
  }

  // Lo que la persona escribe o toca
  function handleTyped(text) {
    if (!text.trim()) return;
    voiceSession.current = false;
    lastByVoice.current = false;
    window.clearTimeout(waitTimer.current);
    if (readQueue.current.list.length) {
      pauseAtCurrent(Number.POSITIVE_INFINITY, false);
      handlePausedCommand(text);
      return;
    }
    handleText(text);
  }

  // Tocó un botón de pedido rápido: lo hace directo
  function handleChip(chip) {
    voiceSession.current = false;
    lastByVoice.current = false;
    window.clearTimeout(waitTimer.current);
    addMessage("user", chip.label);
    runIntent(chip.intent);
  }

  function toggleMic(e) {
    // Celular: si la tocás mientras habla o lee, se calla y te escucha (no apaga la escucha)
    const queue = readQueue.current;
    const interrupt = TAP_TO_TALK && (speaking || (queue.list.length > 0 && !queue.paused));
    if (micOn && !interrupt) {
      setMicOn(false);
      voiceSession.current = false;
      dropHold();
      return;
    }
    setUsedVoice(true);
    setMicOn(true);
    if (!readQueue.current.list.length) hush();
    // Celular: para escucharte frena la lectura (si no decís nada, después sigue sola)
    else if (TAP_TO_TALK) pauseAtCurrent(e?.timeStamp ?? Number.POSITIVE_INFINITY, true);
  }

  function chooseMode(mode) {
    voiceSession.current = false;
    const option = MODES.find((m) => m.id === mode);
    const voice = mode !== "texto";
    setSettings((s) => ({ ...s, mode, voice }));
    addMessage("user", option.label);

    let reply = "Listo. Tocá un botón de abajo. Si no está lo que buscás, tocá «Otras opciones».";
    if (mode === "texto") reply = "Perfecto. Escribime acá abajo qué necesitás.";
    if (mode === "voz") {
      reply = canListen
        ? "Dale. Te escucho: decime qué necesitás cuando quieras. También podés escribir."
        : "Tu navegador no permite dictar por voz, pero te respondo en voz alta. Escribime o usá los botones.";
      if (canListen) setMicOn(true);
    }
    addMessage("eva", reply);
    if (voice && canSpeak) speakOut(reply);
    if (mode === "texto") inputRef.current?.focus();
  }

  function changeMode() {
    setSettings((s) => ({ ...s, mode: null }));
    setView("chat");
    addMessage("eva", "¿Cómo preferís comunicarte?");
  }

  // ---------- Aparecer y desaparecer ----------

  function openPanel() {
    returnFocus.current = document.activeElement;
    setToast("");
    setOpen(true);
    const s = settingsRef.current;
    if (s.mode === "voz" && canListen) setMicOn(true);
    if (greeted.current) return;
    greeted.current = true;
    // Si todavía no eligió cómo comunicarse, no habla sola: primero pregunta
    if (s.mode && s.voice && canSpeak && !reading) speakOut(greeting(s.mode));
  }

  // La llamaron diciendo «Eva, ¿estás ahí?»
  function summon() {
    playChime();
    setToast("");
    voiceSession.current = true;
    lastByVoice.current = true;
    // Primera vez que aparece: arranca directo, sin el saludo de bienvenida
    if (!greeted.current) setMessages([]);
    greeted.current = true;
    if (!settingsRef.current.mode) setSettings((s) => ({ ...s, mode: "voz", voice: true }));
    if (!open) {
      returnFocus.current = document.activeElement;
      setOpen(true);
      setView("chat");
    }
    setMicOn(true);
    hush();
    addMessage("eva", HELLO);
    if (canSpeak) speakOut(HELLO);
  }

  function closePanel() {
    stopAll();
    aiToken.current += 1;
    showWeb(null);
    setOpen(false);
    setMicOn(false);
    voiceSession.current = false;
    // Celular: el interruptor del header muestra si Eva está abierta
    if (TAP_TO_TALK) setWakeEnabled(false);
    window.clearTimeout(thinkTimer.current);
    setThinking(false);
    const back = returnFocus.current;
    returnFocus.current = null;
    if (back && back.isConnected && back !== document.body) back.focus?.({ preventScroll: true });
  }

  function onSubmit(e) {
    e.preventDefault();
    const text = input;
    setInput("");
    handleTyped(text);
  }

  // ---------- Micrófono de fondo ----------

  // "talk": Eva está abierta (o leyendo) y la persona usa la voz: escucha todo, sin cortar.
  // "wake": solo la frase para llamarla (con «Eva por voz» prendido en el header).
  // En el celular no hay escucha de fondo: solo la que se pide tocando, y nunca mientras Eva habla.
  let micMode = null;
  if (canListen && visible) {
    if (micOn && (open || reading) && !(TAP_TO_TALK && speaking)) micMode = "talk";
    else if (wakeEnabled && !TAP_TO_TALK) micMode = "wake";
  }

  const onWake = useEffectEvent(() => summon());
  const onWakeReady = useEffectEvent(() => {
    setWakeLive(true);
    if (announceWake.current) {
      announceWake.current = false;
      showToast(`Listo. Decí «${WAKE_PHRASE}» cuando la necesites.`);
    }
  });
  const onWakeFatal = useEffectEvent((error) => {
    announceWake.current = false;
    setWakeEnabled(false);
    showToast(WAKE_ERRORS[error] || WAKE_ERRORS["not-allowed"]);
  });
  const onTalk = useEffectEvent((raw, isFinal, heardAt, key) => onHeard(raw, isFinal, heardAt, key));
  // Celular: terminó la escucha que se pidió tocando. El micrófono queda apagado hasta el próximo toque;
  // si estaba leyendo y no le pidieron nada, después de un rato sigue.
  const onTurnEnd = useEffectEvent(() => {
    setMicOn(false);
    if (!hold.current && readQueue.current.paused) waitInPause();
  });
  const onTalkFatal = useEffectEvent((error) => {
    setMicOn(false);
    // Sin micrófono no se le puede hablar: vuelve la caja para escribir
    if (settingsRef.current.mode === "voz") setSettings((s) => ({ ...s, mode: "texto" }));
    voiceSession.current = false;
    lastByVoice.current = false;
    dropHold();
    say(
      error === "audio-capture"
        ? "No encontré un micrófono conectado. Podés escribirme acá abajo."
        : "No tengo permiso para usar el micrófono. Habilitalo desde el candado de la barra de direcciones, " +
            "o escribime acá abajo.",
    );
  });

  useEffect(() => {
    if (!micMode) return;
    // Escucha nueva: lo que se oyó en la anterior ya no cuenta
    segs.current.clear();
    dropHold();
    const stop =
      micMode === "wake"
        ? listenForWakeWord({
            match: isWakePhrase,
            onWake: () => onWake(),
            onReady: () => onWakeReady(),
            onFatal: (error) => onWakeFatal(error),
          })
        : listenForWakeWord({
            match: (text, isFinal, heardAt, key) => {
              onTalk(text, isFinal, heardAt, key);
              return false;
            },
            onReady: () => setWakeLive(true),
            onFatal: (error) => onTalkFatal(error),
            once: TAP_TO_TALK,
            onDone: () => onTurnEnd(),
          });
    return () => {
      stop();
      setWakeLive(false);
    };
  }, [micMode]);

  // Interruptor del header y pedidos de abrir desde afuera
  const onUserToggle = useEffectEvent((value) => {
    // Celular: no hay escucha de fondo. El interruptor abre a Eva (saluda y te escucha) o la cierra.
    if (TAP_TO_TALK && canListen) {
      if (open) {
        closePanel();
      } else {
        setWakeEnabled(true);
        // «Eva por voz»: queda en modo voz (solo Eva y la ruedita)
        setSettings((s) => ({ ...s, mode: "voz", voice: true }));
        summon();
      }
      return;
    }
    if (!value) {
      announceWake.current = false;
      showToast("Listo, Eva ya no escucha.");
      return;
    }
    if (!canListen) {
      setWakeEnabled(false);
      showToast(WAKE_ERRORS.unsupported);
      return;
    }
    announceWake.current = true;
  });
  const onOpen = useEffectEvent(() => {
    if (open) panelRef.current?.querySelector("input, button")?.focus();
    else openPanel();
  });

  useEffect(() => onWakeToggledByUser((value) => onUserToggle(value)), []);
  useEffect(() => onOpenRequest(() => onOpen()), []);

  // ---------- Teclado ----------

  const onKey = useEffectEvent((e) => {
    if (e.altKey && (e.code === "KeyA" || e.key?.toLowerCase() === "a")) {
      e.preventDefault();
      if (open) closePanel();
      else openPanel();
      return;
    }
    if (e.key === "Escape") {
      // Primero se cierra la página web que muestra Eva
      if (webRef.current) {
        showWeb(null);
        return;
      }
      // Con un trabajo abierto, Escape cierra el trabajo (lo hace el propio sitio)
      if (openViewer()) return;
      if (open) closePanel();
      else if (reading || speaking) stopAll();
    }
  });

  const onUnmount = useEffectEvent(() => {
    stopSpeaking();
    dropHold();
    window.clearTimeout(thinkTimer.current);
    window.clearTimeout(toastTimer.current);
    window.clearTimeout(waitTimer.current);
    clearReadingMark();
  });

  useEffect(() => {
    const handler = (e) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      onUnmount();
    };
  }, []);

  // ---------- Lo que se ve ----------

  const micLive = micMode === "talk";
  const hearing = Boolean(draft);
  const listeningNow = micLive && (hearing || (!speaking && !thinking));
  const charState = listeningNow ? "listening" : thinking ? "thinking" : speaking ? "speaking" : "idle";
  // Celular en modo «con la voz»: solo Eva y la ruedita (sin caja de texto ni micrófono); se le habla tocándola
  const voiceOnly = TAP_TO_TALK && canListen && settings.mode === "voz";
  let status = "Lista para ayudarte";
  if (TAP_TO_TALK && canListen && !micOn) status = voiceOnly ? "Tocame para hablarme" : "Tocá el micrófono para hablarme";
  if (listeningNow) status = "Te escucho…";
  else if (thinking) status = "Pensando…";
  else if (reading === "tour") status = "Recorriendo la página…";
  else if (reading === "page") status = "Leyendo la página…";
  else if (reading) status = "Esperando tu pedido…";
  else if (speaking) status = "Hablando…";
  // En el celular, mientras habla, cómo frenarla
  if (TAP_TO_TALK && canListen && speaking && !thinking) status = "Tocame para interrumpirme";

  const interrupts = TAP_TO_TALK && (speaking || (Boolean(reading) && reading !== "paused"));
  const micLabel = interrupts ? "Interrumpir a Eva y hablarle" : micOn ? "Apagar el micrófono" : "Hablarle a Eva";

  // En el celular no entra toda la charla: solo lo último (lo que dijiste y lo que te contestó)
  const shown = compact ? lastTurn(messages, { draft, caption }) : messages;

  // Botones: tres opciones según la página (inicio, temática o con un trabajo abierto)
  const place = web || viewerOpen ? "work" : pathname.startsWith("/tematicas/") ? "theme" : "home";
  let turn = chipTurn.n;
  if (chipTurn.place !== place) {
    // Cambió de página: arranca por las opciones de esa página
    setChipTurn({ place, n: 0 });
    turn = 0;
  }
  const chipSets = chipGroups(place, settings);
  const chips = chipSets[turn % chipSets.length];

  const showChips =
    view === "chat" &&
    !reading &&
    !voiceOnly &&
    settings.mode &&
    (settings.mode === "botones" || messages.length <= 2);

  // Con un trabajo abierto en la ventana del sitio, todo lo de afuera queda bloqueado (y tapado):
  // Eva se muda adentro de esa ventana para que se la pueda seguir tocando
  const viewerHost = viewerOpen ? openViewer() : null;

  const ui = (
    <div className={`eva-assistant${viewerHost ? " in-viewer" : ""}`}>
      <div className="eva-toast" role="status" aria-live="polite">
        {toast}
      </div>

      {web && (
        <div className="eva-web" role="dialog" aria-label={`${web.name} (página web)`}>
          <div className="eva-web-bar">
            <div className="eva-web-title">
              <b>{web.name}</b>
              <span>{hostOf(web.href)}</span>
            </div>
            <a className="eva-web-tab" href={web.href} target="_blank" rel="noopener noreferrer" ref={webLinkRef}>
              Abrir en otra pestaña
            </a>
            <button type="button" className="eva-round" onClick={() => showWeb(null)} aria-label="Cerrar la página">
              <CloseIcon />
            </button>
          </div>
          <iframe
            key={web.url}
            src={web.url}
            title={web.name}
            allow="fullscreen; autoplay; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation"
          />
          <p className="eva-web-hint">Si la página no se ve, tocá «Abrir en otra pestaña».</p>
        </div>
      )}

      {open && (
        <div
          className={`eva-dock${reading ? " is-reading" : ""}`}
          id="eva-panel"
          role="dialog"
          aria-labelledby="eva-title"
          ref={panelRef}
        >
          <h2 id="eva-title" className="eva-sr">
            Eva, asistente de accesibilidad
          </h2>

          {view === "settings" ? (
            <div className="eva-card">
              <div className="eva-card-head">
                <h3>Ajustes</h3>
                <button type="button" className="eva-link-btn" onClick={() => setView("chat")} data-autofocus="">
                  Volver a la charla
                </button>
              </div>
              <SettingsView
                settings={settings}
                wakeEnabled={wakeEnabled}
                onToggle={setSetting}
                onScale={(dir) => setSettings((s) => ({ ...s, scale: clampScale(s.scale + dir * SCALE_STEP) }))}
                onReset={() => setSettings((s) => ({ ...DEFAULTS, mode: s.mode, voice: s.voice }))}
                onChangeMode={changeMode}
              />
            </div>
          ) : (
            <div className="eva-thread" ref={logRef}>
              <div className="eva-messages" role="log" aria-live="polite" aria-label="Charla con Eva">
                {shown.map((m) => (
                  <p key={m.id} className={`eva-bubble from-${m.from}`}>
                    <span className="eva-sr">{m.from === "user" ? "Vos: " : "Eva: "}</span>
                    {m.text}
                  </p>
                ))}
              </div>
              {caption && (
                <p className="eva-bubble from-eva is-caption">
                  <span className="eva-sr">Eva está diciendo: </span>
                  {caption}
                </p>
              )}
              {draft && (
                <p className="eva-bubble from-user is-draft" aria-hidden="true">
                  {draft}…
                </p>
              )}
              {!settings.mode && (
                <div className="eva-modes">
                  {MODES.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      className="eva-mode"
                      onClick={() => chooseMode(m.id)}
                      data-autofocus={i === 0 ? "" : undefined}
                    >
                      <b>{m.label}</b>
                      <small>{m.hint}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {showChips && (
            <div className="eva-chips" role="group" aria-label="Pedidos rápidos">
              {chips.map((chip) => (
                <button key={chip.id} type="button" className="eva-chip" onClick={() => handleChip(chip)}>
                  {chip.label}
                </button>
              ))}
              <button
                type="button"
                className="eva-chip eva-chip-more"
                onClick={() => setChipTurn((t) => ({ place, n: t.n + 1 }))}
              >
                Otras opciones
              </button>
            </div>
          )}

          <div className="eva-stage">
            <div className={`eva-pad${listeningNow ? " is-listening" : ""}`}>
              {TAP_TO_TALK && canListen ? (
                // Celular: tocar a Eva es como tocar el micrófono
                <button type="button" className="eva-pad-tap" onClick={toggleMic} aria-label={micLabel}>
                  <EvaCharacter state={charState} talking={speaking} reduced={reduced} dots />
                </button>
              ) : (
                <EvaCharacter state={charState} talking={speaking} reduced={reduced} dots />
              )}
            </div>
            <div className="eva-side">
              <div className="eva-tools">
                <button
                  type="button"
                  className="eva-round"
                  aria-pressed={view === "settings"}
                  onClick={() => setView((v) => (v === "settings" ? "chat" : "settings"))}
                  aria-label="Ajustes de accesibilidad"
                  title="Ajustes"
                >
                  <GearIcon />
                </button>
                <button
                  type="button"
                  className="eva-round"
                  onClick={closePanel}
                  aria-label="Cerrar asistente"
                  title="Cerrar"
                >
                  <CloseIcon />
                </button>
              </div>
              <p className={`eva-status${listeningNow ? " is-live" : ""}`}>{status}</p>
              {(reading || speaking) && (
                <button type="button" className="eva-stop" onClick={stopAll}>
                  <StopIcon />
                  Detener
                </button>
              )}
            </div>
          </div>

          {!voiceOnly && (
            <form className="eva-input" onSubmit={onSubmit}>
              <label htmlFor="eva-text" className="eva-sr">
                Escribile a Eva
              </label>
              <input
                id="eva-text"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribile a Eva…"
                autoComplete="off"
              />
              <button
                type="button"
                className="eva-mic"
                aria-pressed={micOn}
                onClick={toggleMic}
                aria-label={micLabel}
                disabled={!canListen}
                title={canListen ? undefined : "Tu navegador no permite dictar por voz"}
              >
                <MicIcon />
              </button>
              <button type="submit" className="eva-send" aria-label="Enviar">
                <SendIcon />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
  return viewerHost ? createPortal(ui, viewerHost) : ui;
}

function SettingsView({ settings, wakeEnabled, onToggle, onScale, onReset, onChangeMode }) {
  const mode = MODES.find((m) => m.id === settings.mode);
  return (
    <div className="eva-settings">
      <div className="eva-row">
        <span className="eva-row-text" id="eva-size-label">
          Tamaño del texto
        </span>
        <div className="eva-stepper" role="group" aria-labelledby="eva-size-label">
          <button type="button" onClick={() => onScale(-1)} disabled={settings.scale <= SCALE_MIN} aria-label="Achicar texto">
            A−
          </button>
          <output aria-live="polite">{Math.round(settings.scale * 100)}%</output>
          <button type="button" onClick={() => onScale(1)} disabled={settings.scale >= SCALE_MAX} aria-label="Agrandar texto">
            A+
          </button>
        </div>
      </div>
      <Switch id="eva-contrast" label="Alto contraste" checked={settings.contrast} onChange={(v) => onToggle("contrast", v)} />
      <Switch
        id="eva-font"
        label="Letra más legible"
        hint="Más espacio entre letras y líneas"
        checked={settings.font}
        onChange={(v) => onToggle("font", v)}
      />
      <Switch id="eva-links" label="Resaltar enlaces" checked={settings.links} onChange={(v) => onToggle("links", v)} />
      <Switch id="eva-pause" label="Pausar animaciones" checked={settings.pause} onChange={(v) => onToggle("pause", v)} />
      <Switch
        id="eva-voice"
        label="Eva responde en voz alta"
        hint={canSpeak ? undefined : "Tu navegador no tiene voz"}
        checked={settings.voice && canSpeak}
        disabled={!canSpeak}
        onChange={(v) => onToggle("voice", v)}
      />
      <div className="eva-row">
        <span className="eva-row-text">
          Llamarla con la voz
          <small>
            {TAP_TO_TALK
              ? "En el celular: tocá el micrófono o a Eva para hablarle"
              : wakeEnabled
                ? `Activado: decí «${WAKE_PHRASE}»`
                : "Se activa con «Eva por voz» arriba de todo"}
          </small>
        </span>
      </div>
      <div className="eva-row">
        <span className="eva-row-text">
          Cómo nos comunicamos
          <small>{mode ? mode.label : "Sin elegir"}</small>
        </span>
        <button type="button" className="eva-link-btn" onClick={onChangeMode}>
          Cambiar
        </button>
      </div>
      <button type="button" className="eva-reset" onClick={onReset}>
        Volver todo a como estaba
      </button>
    </div>
  );
}

function Switch({ id, label, hint, checked, disabled, onChange }) {
  return (
    <div className="eva-row">
      <span className="eva-row-text">
        <label htmlFor={id}>{label}</label>
        {hint && <small>{hint}</small>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className="eva-switch"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

function MicIcon() {
  return (
    <svg {...iconProps}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg {...iconProps} width={16} height={16} fill="currentColor" stroke="none">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export default Assistant;
