import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import EvaCharacter from "./EvaCharacter";
import { canListen, canSpeak, listen, listenForWakeWord, playChime, speak, stopSpeaking } from "./speech";
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
import { THEME_NAMES, WAKE_PHRASE, interpret, isTalkingOver, isWakePhrase, normalize, userPart } from "./commands";
import { onOpenRequest, onWakeToggledByUser, setWakeEnabled, setWakeLive, useWakeEnabled } from "./assistantStore";
import {
  cardName,
  closeOpenViewer,
  currentThemeSlug,
  describeCard,
  describeTile,
  findCardByName,
  openCard,
  openViewer,
  pickByPosition,
  projectCards,
  themeTiles,
  turnViewerPage,
  viewerPageLabel,
  waitFor,
} from "./pageGuide";
import { THEMES } from "../../data/projects";
import "./Assistant.css";

// Asistente de accesibilidad de EVA (prueba).
// No se ve hasta que lo llaman: diciendo «Eva, ¿estás ahí?» (si la persona activó
// «Eva por voz» en el header), con Alt + A, o desde «Accesibilidad» en el pie de página.
// Entiende voz, texto y botones, lee la página en voz alta, recorre los proyectos contándolos,
// abre y cierra trabajos, y cambia el tamaño del texto, el contraste y más.

const MODES = [
  { id: "voz", label: "Con la voz", hint: "Me hablás y te respondo en voz alta" },
  { id: "texto", label: "Escribiendo", hint: "Me escribís y te respondo por escrito" },
  { id: "botones", label: "Con botones", hint: "Tocás opciones listas" },
];

const QUICK = ["Navegá la página", "Leé la página", "Agrandá el texto", "Alto contraste", "¿Qué podés hacer?"];

const ABOUT =
  "EVA (Entornos Virtuales de Aprendizaje) es un programa donde estudiantes de San Martín idean y desarrollan " +
  "proyectos mientras aprenden herramientas digitales, con Aprendizaje Basado en Proyectos. " +
  "En este sitio podés ver lo que crearon en 10 temáticas.";
const HELP =
  "Puedo recorrer la página y contarte qué proyectos hay, abrir un trabajo y cerrarlo, leerte la página en voz alta, " +
  "agrandar el texto, activar alto contraste, poner una letra más fácil de leer, resaltar los enlaces, " +
  "pausar las animaciones y llevarte a cualquier temática. " +
  "Por ejemplo: «navegá la página», «abrí el primero» o «llevame a robótica». Para cerrarme, decí «chau».";
const UNKNOWN =
  "No te entendí. Probá con «leé la página», «agrandá el texto» o «llevame a videojuegos». " +
  "También podés usar los botones.";

const TOGGLE_REPLIES = {
  contrast: ["Activé el alto contraste.", "Saqué el alto contraste."],
  font: ["Puse una letra más fácil de leer.", "Volví a la letra original."],
  links: ["Resalté los enlaces.", "Saqué el resaltado de los enlaces."],
  pause: ["Pausé las animaciones.", "Volví a activar las animaciones."],
};

const WAKE_ERRORS = {
  unsupported: "Tu navegador no permite llamar a Eva con la voz. Probá con Chrome o Edge, o abrila con Alt + A.",
  "not-allowed":
    "El navegador no dio permiso al micrófono. Podés habilitarlo desde el candado de la barra de direcciones.",
  "service-not-allowed":
    "El navegador no dio permiso al micrófono. Podés habilitarlo desde el candado de la barra de direcciones.",
  "audio-capture": "No encontré un micrófono conectado.",
};

function greeting(mode) {
  if (!mode) {
    return (
      "¡Hola! Soy Eva, la asistente de este sitio. Puedo leerte la página, agrandar el texto " +
      "y llevarte a donde quieras. ¿Cómo preferís comunicarte?"
    );
  }
  return "¡Hola de nuevo! ¿En qué te ayudo?";
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

const clampScale = (v) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, v));

function Assistant() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(loadSettings);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("chat");
  const [messages, setMessages] = useState(() => [{ id: 1, from: "eva", text: greeting(settings.mode) }]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [reading, setReading] = useState(false);
  const [toast, setToast] = useState("");
  const [usedVoice, setUsedVoice] = useState(false);
  const [heard, setHeard] = useState("");
  const [inGap, setInGap] = useState(false);
  const systemReduced = useSyncExternalStore(subscribeMotion, getMotion, () => false);
  const visible = useSyncExternalStore(subscribeVisibility, getVisible, () => true);
  const wakeEnabled = useWakeEnabled();
  const reduced = systemReduced || settings.pause;

  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const logRef = useRef(null);
  const settingsRef = useRef(settings);
  const reducedRef = useRef(reduced);
  const msgId = useRef(1);
  const speakId = useRef(0);
  const stopListen = useRef(null);
  const listenToken = useRef(0);
  const listenDelay = useRef(0);
  const wakeStop = useRef(null);
  const announceWake = useRef(false);
  const voiceSession = useRef(false);
  const returnFocus = useRef(null);
  const thinkTimer = useRef(0);
  const toastTimer = useRef(0);
  const readQueue = useRef({ list: [], i: 0, node: null, after: null });
  const lastCard = useRef(null);
  const recentSpeech = useRef([]);
  const holdTimer = useRef(0);
  const greeted = useRef(false);

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
    target?.focus();
  }, [open]);

  // El último mensaje siempre a la vista
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, open, view]);

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
    setMessages((list) => [...list, { id, from, text }]);
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

  // Si la llamaron con la voz, después de responder vuelve a escuchar (como Hey Google)
  function followUp() {
    if (voiceSession.current) startListening({ followUp: true });
  }

  // Eva responde: siempre por escrito y, si está activado, también en voz alta.
  // Si la llamaron hablando, contesta hablando.
  function say(text, after) {
    addMessage("eva", text);
    const next = after ?? followUp;
    if ((settingsRef.current.voice || voiceSession.current) && canSpeak) speakOut(text, next);
    else next();
  }

  function clearReadingMark() {
    readQueue.current.node?.classList.remove("eva-reading");
    readQueue.current.node = null;
  }

  function stopAll() {
    speakId.current += 1;
    stopSpeaking();
    clearReadingMark();
    readQueue.current = { list: [], i: 0, node: null, after: null };
    setSpeaking(false);
    setReading(false);
    setInGap(false);
  }

  // ---------- Leer la página ----------

  function readNext() {
    const queue = readQueue.current;
    if (queue.i >= queue.list.length) {
      clearReadingMark();
      const after = queue.after;
      queue.after = null;
      queue.inGap = false;
      setInGap(false);
      setReading(false);
      setSpeaking(false);
      after?.();
      return;
    }
    const block = queue.list[queue.i];
    const first = queue.i === 0;
    queue.i += 1;
    speakId.current += 1;
    const id = speakId.current;
    setSpeaking(true);

    const go = () => {
      if (speakId.current !== id) return;
      queue.inGap = false;
      setInGap(false);
      clearReadingMark();
      if (block.log) addMessage("eva", block.text);
      if (block.node) {
        block.node.classList.add("eva-reading");
        block.node.scrollIntoView({ block: "center", behavior: reducedRef.current ? "auto" : "smooth" });
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
      rememberSpeech(block.text);
      speak(block.text, {
        onEnd: () => {
          if (speakId.current === id) readNext();
        },
      });
    };
    // Entre proyecto y proyecto hace una pausa para escuchar: mientras Eva habla,
    // la compu suele silenciar el micrófono para no oírla, así que se turnan
    if (queue.gap && !first && !queue.skipGap) {
      queue.inGap = true;
      setInGap(true);
      window.setTimeout(go, queue.gap);
    } else {
      go();
    }
    queue.skipGap = false;
  }

  // Lo último que dijo Eva, para no confundir su propia voz con un pedido
  function rememberSpeech(text) {
    recentSpeech.current = [...recentSpeech.current.slice(-1), normalize(text)];
  }

  // ---------- Le hablan encima: frena, pide que repitan y escucha sin interferencias ----------

  // Deja la lectura en pausa. queue.cur es «este»: lo que estaba contando o lo que acaba de contar
  function pauseAtCurrent(heardAt) {
    const queue = readQueue.current;
    queue.pausedInGap = Boolean(queue.inGap);
    queue.cur = Math.max(0, queue.i - (queue.inGap ? 2 : 1));
    // Si recién había empezado otro proyecto, seguramente reaccionó al anterior
    if (!queue.inGap && queue.kind === "tour" && queue.prevCard?.isConnected && heardAt - (queue.cardAt || 0) < 1200) {
      clearReadingMark();
      queue.prevCard.classList.add("eva-reading");
      queue.node = queue.prevCard;
      queue.currentCard = queue.prevCard;
      lastCard.current = queue.prevCard;
      queue.cur = Math.max(1, queue.cur - 1);
      queue.pausedInGap = true;
    }
    queue.paused = true;
    queue.inGap = false;
    setInGap(false);
    speakId.current += 1;
    stopSpeaking();
    voiceSession.current = true;
    setHeard("");
  }

  function askRepeat() {
    setReading("paused");
    const ask = "¿Sí? Repetime, por favor.";
    addMessage("eva", ask);
    speakOut(ask, () => startListening({ pausedTour: true }));
  }

  // Le hablaron encima mientras Eva hablaba: frena y pide que repitan
  function interruptReading(heardAt) {
    pauseAtCurrent(heardAt);
    askRepeat();
  }

  // Le hablaron en la pausa: se queda callada esperando a que terminen la frase
  function holdReading(heardAt, key) {
    pauseAtCurrent(heardAt);
    const queue = readQueue.current;
    queue.holdKey = key;
    setReading("holding");
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      if (readQueue.current.holdKey !== key) return;
      readQueue.current.holdKey = null;
      wakeStop.current?.();
      wakeStop.current = null;
      askRepeat();
    }, 4000);
  }

  function finishHold(said) {
    window.clearTimeout(holdTimer.current);
    readQueue.current.holdKey = null;
    setReading("paused");
    if (said) handlePausedCommand(said);
    else resumeReading(0);
  }

  // Retoma: «seguí» (0), el siguiente (1) o el anterior (−1)
  function resumeReading(dir) {
    const queue = readQueue.current;
    if (!queue.paused) return;
    queue.paused = false;
    const first = queue.kind === "tour" ? 1 : 0;
    if (dir > 0) queue.i = queue.cur + 1;
    else if (dir < 0) queue.i = Math.max(first, queue.cur - 1);
    else queue.i = queue.pausedInGap ? queue.cur + 1 : queue.cur;
    queue.skipGap = true; // al retomar arranca enseguida
    setReading(queue.kind || "tour");
    readNext();
  }

  // Lo que dijo después de «Repetime, por favor»
  function handlePausedCommand(raw) {
    const queue = readQueue.current;
    addMessage("user", raw.trim());
    if (/(^| )(segui|seguir|continua|continuar|dale|nada|perdon|disculpa|no nada)( |$)/.test(normalize(raw))) {
      resumeReading(0);
      return;
    }
    const intent = interpret(raw);
    // «Che», «escuchame», «esperá»: solo le pidió atención
    const attention = /^((che|eva|asistente|escucha|escuchame|oye|ey|eh|espera|esperame|un momento|momento|hola) ?)+$/;
    if (intent.type === "hello" || attention.test(normalize(raw))) {
      say("¿Sí? Decime.", () => startListening({ pausedTour: true }));
      return;
    }
    if (intent.type === "page") {
      resumeReading(intent.dir);
      return;
    }
    if (intent.type === "open" && intent.which === "this") {
      const card = queue.currentCard?.isConnected ? queue.currentCard : null;
      stopAll();
      openWork(card ? { card } : intent);
      return;
    }
    if (intent.type === "unknown" || intent.type === "empty") {
      say("No te entendí. Decime «seguí», «abrí este», «siguiente» o «basta».", () =>
        startListening({ pausedTour: true }),
      );
      return;
    }
    stopAll();
    if (intent.type === "stop") say("Listo, freno.");
    else runIntent(intent);
  }

  function selectedText() {
    return window.getSelection?.().toString().trim() || "";
  }

  function startReading(useSelection) {
    stopAll();
    const picked = useSelection ? selectedText() : "";
    const list = picked ? [{ node: null, text: picked }] : readableBlocks();
    if (!list.length) {
      say("No encontré texto para leer en esta página.");
      return;
    }
    readQueue.current = { list, i: 0, node: null, after: null, kind: "page", gap: 800 };
    setReading("page");
    readNext();
  }

  // ---------- Recorrido: baja por la página y cuenta los proyectos ----------

  async function startTour(slug) {
    stopAll();
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
    const canTalk =
      canListen && (settingsRef.current.mode !== "texto" || wakeEnabled || usedVoice || voiceSession.current);
    setHeard("");
    const after = () => {
      if (canTalk || voiceSession.current) startListening({ followUp: true });
    };
    readQueue.current = {
      list,
      i: 0,
      node: null,
      after,
      kind: "tour",
      gap: 1600,
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

    lastCard.current = card;
    card.scrollIntoView({ block: "center", behavior: reducedRef.current ? "auto" : "smooth" });
    const name = cardName(card);
    const result = openCard(card);
    if (result === "viewer") say(`Te abro «${name}». Para cerrarlo, decí «cerrá» o tocá la X.`);
    else if (result === "web") say(`«${name}» es una página web: te la abrí en otra pestaña.`);
    else if (result === "blocked") {
      say(
        `«${name}» es una página web y el navegador no me dejó abrir otra pestaña. ` +
          "Te marqué el botón «Visitar la web»: tocalo o apretá Enter.",
      );
    } else say(`No pude abrir «${name}».`);
  }

  function closeWork(plain) {
    if (closeOpenViewer()) {
      say("Listo, lo cerré.");
      return;
    }
    if (plain) {
      say("¡Chau! Llamame cuando quieras.", () => closePanel());
      return;
    }
    say("No hay ningún trabajo abierto.");
  }

  function turnWorkPage(dir) {
    const { result, dialog } = turnViewerPage(dir);
    if (result === "none") say("No hay ningún trabajo abierto.");
    else if (result === "single") say("Este trabajo tiene una sola página.");
    else if (result === "edge") say(dir > 0 ? "Ya estás en la última página." : "Ya estás en la primera página.");
    else window.setTimeout(() => say(viewerPageLabel(dialog) || "Listo."), 80);
  }

  // ---------- Escuchar un pedido ----------

  function stopListening() {
    listenToken.current += 1;
    window.clearTimeout(listenDelay.current);
    const stop = stopListen.current;
    stopListen.current = null;
    stop?.();
    setListening(false);
  }

  function startListening({ followUp: isFollowUp = false, pausedTour = false } = {}) {
    if (!canListen) {
      say("Tu navegador no permite dictar por voz. Probá con Chrome o Edge, o escribime acá abajo.");
      return;
    }
    if (pausedTour) {
      speakId.current += 1;
      stopSpeaking();
    } else {
      stopAll();
    }
    stopListening();
    // El micrófono no puede escuchar la frase y el pedido a la vez
    const wasWaking = Boolean(wakeStop.current);
    wakeStop.current?.();
    wakeStop.current = null;

    listenToken.current += 1;
    const token = listenToken.current;
    setInput("");
    setListening(true);
    setUsedVoice(true);

    const begin = () => {
      if (listenToken.current !== token) return;
      stopListen.current = listen({
        onPartial: (text) => setInput(text),
        onEnd: (text, error) => {
          if (listenToken.current !== token) return;
          stopListen.current = null;
          setListening(false);
          if (text) {
            setInput("");
            if (pausedTour && readQueue.current.paused) handlePausedCommand(text);
            else handleText(text);
            return;
          }
          if (error === "aborted") return;
          if (error === "not-allowed" || error === "service-not-allowed") {
            voiceSession.current = false;
            say(
              "No tengo permiso para usar el micrófono. Habilitalo desde el candado de la barra de direcciones, " +
                "o escribime acá abajo.",
            );
            return;
          }
          // Frenó porque le hablaron y después no dijo nada (o fue un ruido): sigue
          if (pausedTour && readQueue.current.paused) {
            say("Sigo.", () => resumeReading(0));
            return;
          }
          if (isFollowUp) {
            // Con un trabajo abierto sigue escuchando, para poder cerrarlo o pasar de página
            if (openViewer() && (!error || error === "no-speech")) {
              startListening({ followUp: true });
              return;
            }
            // Llamada por voz y no dijo nada más: se va, como Hey Google
            if (voiceSession.current) closePanel();
            return;
          }
          say("No te escuché. Tocá el micrófono y hablame cuando quieras.");
        },
      });
    };
    if (wasWaking) listenDelay.current = window.setTimeout(begin, 250);
    else begin();
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
    thinkTimer.current = window.setTimeout(
      () => {
        setThinking(false);
        runIntent(intent);
      },
      reducedRef.current ? 120 : 550,
    );
  }

  function setSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function runIntent(intent) {
    const current = settingsRef.current;
    switch (intent.type) {
      case "stop":
        stopAll();
        addMessage("eva", "Listo, freno.");
        break;
      case "close":
        say("¡Chau! Llamame cuando quieras.", () => closePanel());
        break;
      case "closeWork":
        closeWork(intent.plain);
        break;
      case "page":
        turnWorkPage(intent.dir);
        break;
      case "open":
        openWork(intent);
        break;
      case "tour":
        if (!canSpeak) {
          say("Tu navegador no tiene voz para contarte los proyectos.");
          break;
        }
        startTour(intent.theme);
        break;
      case "read": {
        if (!canSpeak) {
          say("Tu navegador no tiene voz para leer en voz alta.");
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
        say(`Listo, el texto quedó al ${Math.round(next * 100)}%.`);
        break;
      }
      case "toggle": {
        const value = intent.value ?? !current[intent.key];
        if (intent.key === "voice") {
          setSetting("voice", value);
          if (value) {
            const text = "Listo, ahora te respondo también en voz alta.";
            addMessage("eva", text);
            if (canSpeak) speakOut(text, followUp);
          } else {
            stopAll();
            addMessage("eva", "Listo, te respondo solo por escrito.");
            followUp();
          }
          break;
        }
        setSetting(intent.key, value);
        say(TOGGLE_REPLIES[intent.key][value ? 0 : 1]);
        break;
      }
      case "reset":
        setSettings((s) => ({ ...DEFAULTS, mode: s.mode, voice: s.voice }));
        say("Volví todo a como estaba.");
        break;
      case "themes":
        say(`Hay ${THEME_NAMES.length} temáticas: ${THEME_NAMES.join(", ")}. ¿A cuál te llevo?`);
        break;
      case "go":
        navigate(intent.to);
        say(`Te llevo ${intent.label}.`);
        break;
      case "about":
        say(ABOUT);
        break;
      case "help":
        say(HELP);
        break;
      case "hello":
        say("¡Hola! ¿En qué te ayudo?");
        break;
      case "thanks":
        say("¡De nada! Acá estoy si me necesitás.");
        break;
      case "empty":
        break;
      default:
        say(UNKNOWN);
    }
  }

  // Lo que la persona toca o escribe corta el ida y vuelta por voz
  function handleTyped(text) {
    voiceSession.current = false;
    handleText(text);
  }

  function chooseMode(mode) {
    voiceSession.current = false;
    const option = MODES.find((m) => m.id === mode);
    const voice = mode !== "texto";
    setSettings((s) => ({ ...s, mode, voice }));
    addMessage("user", option.label);

    let reply = "Listo. Tocá cualquiera de los botones de abajo.";
    if (mode === "texto") reply = "Perfecto. Escribime acá abajo qué necesitás.";
    if (mode === "voz") {
      reply = canListen
        ? "Dale. Cuando se prenda el micrófono, decime qué necesitás. También podés escribir."
        : "Tu navegador no permite dictar por voz, pero te respondo en voz alta. Escribime o usá los botones.";
    }
    addMessage("eva", reply);

    const thenListen = mode === "voz" && canListen ? () => startListening() : undefined;
    if (voice && canSpeak) speakOut(reply, thenListen);
    else thenListen?.();
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
    if (greeted.current) return;
    greeted.current = true;
    const s = settingsRef.current;
    const thenListen = s.mode === "voz" && canListen ? () => startListening() : undefined;
    // Si todavía no eligió cómo comunicarse, no habla sola: primero pregunta
    if (s.mode && s.voice && canSpeak && !reading) speakOut(greeting(s.mode), thenListen);
    else thenListen?.();
  }

  // La llamaron diciendo «Eva, ¿estás ahí?»
  function summon() {
    playChime();
    setToast("");
    voiceSession.current = true;
    // Primera vez que aparece: arranca directo, sin el saludo de bienvenida
    if (!greeted.current) setMessages([]);
    greeted.current = true;
    if (!settingsRef.current.mode) setSettings((s) => ({ ...s, mode: "voz", voice: true }));
    if (!open) {
      returnFocus.current = document.activeElement;
      setOpen(true);
      setView("chat");
    }
    addMessage("eva", "¡Acá estoy! Decime qué necesitás.");
    startListening({ followUp: true });
  }

  function closePanel() {
    setOpen(false);
    stopListening();
    voiceSession.current = false;
    window.clearTimeout(thinkTimer.current);
    setThinking(false);
    const back = returnFocus.current;
    returnFocus.current = null;
    if (back && back.isConnected && back !== document.body) back.focus?.();
  }

  function onSubmit(e) {
    e.preventDefault();
    const text = input;
    setInput("");
    handleTyped(text);
  }

  // ---------- Escuchar la frase de fondo ----------

  // Qué escucha el micrófono de fondo:
  // "wake": solo la frase para llamarla (con «Eva por voz» prendido).
  // "barge": mientras lee o recorre, pedidos como «abrí este», «siguiente» o «basta».
  let micMode = null;
  if (canListen && visible && !listening && !thinking) {
    // Mientras lee o recorre escucha, salvo que la persona haya elegido comunicarse escribiendo
    if (reading === "tour" || reading === "page" || reading === "holding") {
      micMode = settings.mode !== "texto" || wakeEnabled || usedVoice ? "barge" : null;
    }
    else if (wakeEnabled && !speaking) micMode = "wake";
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

  // Pedidos durante el recorrido o la lectura. Devuelve true si hay que cortar la escucha.
  // Mientras lee o recorre. Devuelve true para cortar la escucha de fondo.
  const onBarge = useEffectEvent((raw, isFinal, heardAt, key) => {
    const t = normalize(raw);
    if (t) setHeard(t.split(" ").slice(-10).join(" "));
    const queue = readQueue.current;
    if (!queue.holdKey) {
      if (!isWakePhrase(raw) && !isTalkingOver(t, recentSpeech.current)) return false;
      // Le habló encima mientras ella hablaba: frena y pide que repita
      if (!queue.inGap) {
        interruptReading(heardAt);
        return true;
      }
      // Le habló en la pausa: espera a que termine la frase y lo hace
      holdReading(heardAt, key);
    }
    if (!isFinal) return false;
    const said = userPart(t, recentSpeech.current);
    if (!said && key !== queue.holdKey) return false;
    finishHold(said);
    // Si retomó la lectura, la escucha de fondo sigue; si no, se corta
    const resumed = readQueue.current.list.length > 0 && !readQueue.current.paused;
    return !resumed;
  });

  useEffect(() => {
    if (!micMode) return;
    const stop =
      micMode === "wake"
        ? listenForWakeWord({
            match: isWakePhrase,
            onWake: () => onWake(),
            onReady: () => onWakeReady(),
            onFatal: (error) => onWakeFatal(error),
          })
        : listenForWakeWord({
            match: (text, isFinal, heardAt, key) => onBarge(text, isFinal, heardAt, key),
            onReady: () => setWakeLive(true),
            onFatal: (error) => showToast(WAKE_ERRORS[error] || WAKE_ERRORS["not-allowed"]),
          });
    wakeStop.current = stop;
    return () => {
      stop();
      if (wakeStop.current === stop) wakeStop.current = null;
      setWakeLive(false);
    };
  }, [micMode]);

  // Interruptor del header y pedidos de abrir desde afuera
  const onUserToggle = useEffectEvent((value) => {
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
      // Con un trabajo abierto, Escape cierra el trabajo (lo hace el propio sitio)
      if (openViewer()) return;
      if (open) closePanel();
      else if (reading || speaking) stopAll();
    }
  });

  const onUnmount = useEffectEvent(() => {
    stopSpeaking();
    stopListen.current?.();
    window.clearTimeout(thinkTimer.current);
    window.clearTimeout(toastTimer.current);
    window.clearTimeout(listenDelay.current);
    window.clearTimeout(holdTimer.current);
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

  const charState = listening ? "listening" : thinking ? "thinking" : speaking ? "speaking" : "idle";
  let status = "Lista para ayudarte";
  if (listening) status = "Te escucho…";
  else if (thinking) status = "Pensando…";
  else if (reading === "holding" || (reading === "tour" && inGap)) status = "Te escucho…";
  else if (reading === "tour") status = "Recorriendo la página…";
  else if (reading === "paused") status = "Esperando tu pedido…";
  else if (reading) status = "Leyendo la página…";
  else if (speaking) status = "Hablando…";

  return (
    <div className="eva-assistant">
      <div className="eva-toast" role="status" aria-live="polite">
        {toast}
      </div>

      {reading && !open && (
        <button type="button" className="eva-stop-float" onClick={stopAll}>
          <StopIcon />
          Detener lectura
        </button>
      )}

      {open && (
        <div
          className={`eva-panel${reading ? " is-compact" : ""}`}
          id="eva-panel"
          role="dialog"
          aria-labelledby="eva-title"
          ref={panelRef}
        >
          {(listening || reading === "holding" || (reading === "tour" && inGap)) && (
            <div className="eva-listen-bar" aria-hidden="true" />
          )}
          <div className="eva-head">
            <EvaCharacter state={charState} talking={speaking} reduced={reduced} dots className="eva-head-char" />
            <div>
              <h2 id="eva-title" className="eva-title">
                Eva
              </h2>
              <p className="eva-status">{status}</p>
              {reading && (
                <button type="button" className="eva-chip eva-chip-stop eva-compact-stop" onClick={stopAll}>
                  Detener
                </button>
              )}
              {micMode === "barge" && reading !== "holding" && (
                <p className="eva-hint">Hablame cuando digo «Te escucho…», entre proyecto y proyecto.</p>
              )}
              {reading === "paused" && (
                <p className="eva-hint">Decime «seguí», «abrí este», «siguiente», «anterior» o «basta».</p>
              )}
              {micMode === "barge" && heard && <p className="eva-heard">Escuché: «{heard}»</p>}
            </div>
            <button type="button" className="eva-icon-btn" onClick={closePanel} aria-label="Cerrar asistente">
              <CloseIcon />
            </button>
          </div>

          <div className="eva-tabs" role="group" aria-label="Secciones del asistente">
            <button type="button" aria-pressed={view === "chat"} onClick={() => setView("chat")}>
              Charla
            </button>
            <button type="button" aria-pressed={view === "settings"} onClick={() => setView("settings")}>
              Ajustes
            </button>
          </div>

          {reading ? null : view === "chat" ? (
            <>
              <div className="eva-log" ref={logRef}>
                <div className="eva-messages" role="log" aria-live="polite">
                  {messages.map((m) => (
                    <p key={m.id} className={`eva-msg from-${m.from}`}>
                      <span className="eva-sr">{m.from === "user" ? "Vos: " : "Eva: "}</span>
                      {m.text}
                    </p>
                  ))}
                </div>
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

              <div className="eva-chips">
                {(reading || speaking) && (
                  <button type="button" className="eva-chip eva-chip-stop" onClick={stopAll}>
                    Detener
                  </button>
                )}
                {QUICK.map((q) => (
                  <button key={q} type="button" className="eva-chip" onClick={() => handleTyped(q)}>
                    {q}
                  </button>
                ))}
              </div>

              <form className="eva-input" onSubmit={onSubmit}>
                <label htmlFor="eva-text" className="eva-sr">
                  Escribile a Eva
                </label>
                <input
                  id="eva-text"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={listening ? "Te escucho…" : "Escribile a Eva…"}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="eva-mic"
                  aria-pressed={listening}
                  onClick={() => (listening ? stopListening() : startListening())}
                  aria-label={listening ? "Dejar de escuchar" : "Hablarle a Eva"}
                  disabled={!canListen}
                  title={canListen ? undefined : "Tu navegador no permite dictar por voz"}
                >
                  <MicIcon />
                </button>
                <button type="submit" className="eva-send" aria-label="Enviar">
                  <SendIcon />
                </button>
              </form>
            </>
          ) : (
            <SettingsView
              settings={settings}
              wakeEnabled={wakeEnabled}
              onToggle={setSetting}
              onScale={(dir) => setSettings((s) => ({ ...s, scale: clampScale(s.scale + dir * SCALE_STEP) }))}
              onReset={() => setSettings((s) => ({ ...DEFAULTS, mode: s.mode, voice: s.voice }))}
              onChangeMode={changeMode}
            />
          )}
        </div>
      )}
    </div>
  );
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
            {wakeEnabled ? `Activado: decí «${WAKE_PHRASE}»` : "Se activa con «Eva por voz» arriba de todo"}
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

function StopIcon() {
  return (
    <svg {...iconProps} fill="currentColor" stroke="none">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export default Assistant;
