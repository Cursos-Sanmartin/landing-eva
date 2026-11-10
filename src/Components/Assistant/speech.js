// Voz del navegador: hablar (síntesis) y escuchar (dictado).
// Funciona sin servidor. El dictado depende del navegador: Chrome y Edge lo tienen,
// Firefox no. Si algo no está, el asistente sigue andando por texto y botones.

const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
const Recognition =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const canSpeak = Boolean(synth) && typeof window.SpeechSynthesisUtterance !== "undefined";
export const canListen = Boolean(Recognition);

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// Chrome en Android manda cada pedacito de la frase («hola», «hola eva») como si fuera una frase nueva y
// terminada. Ahí, lo que todavía está entendiendo llega con confianza 0: así lo reconocemos.
const ANDROID = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");
const plain = (t) => String(t || "").trim().toLowerCase();

// Celular o tablet: en Android cada vez que se prende el micrófono suena un pitido (la página no lo puede
// sacar), así que no puede quedar escuchando solo. Ahí se habla tocando: el micrófono o a Eva.
export const TAP_TO_TALK =
  typeof window !== "undefined" &&
  (/Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator?.userAgent || "") ||
    Boolean(window.matchMedia?.("(pointer: coarse)").matches));

let voices = [];
function loadVoices() {
  try {
    voices = synth.getVoices() || [];
  } catch {
    voices = [];
  }
}
if (synth) {
  loadVoices();
  synth.addEventListener?.("voiceschanged", loadVoices);
}

// Preferimos español rioplatense; si no está, cualquier español
function pickVoice() {
  const order = ["es-ar", "es-419", "es-us", "es-mx", "es-es"];
  for (const lang of order) {
    const voice = voices.find((v) => (v.lang || "").replace("_", "-").toLowerCase() === lang);
    if (voice) return voice;
  }
  return voices.find((v) => /^es/i.test(v.lang || "")) || null;
}

// ---------- Hablar ----------

// Si Eva está hablando y desde cuándo está callada: sirve para no confundir
// su propia voz (que el micrófono también oye) con lo que dice la persona.
let talking = false;
let quietAt = -1e9;
let seq = 0; // cada frase nueva, o cada corte, deja sin efecto a la anterior
const live = { utterance: null }; // la frase activa: si no la guardamos, el navegador a veces la descarta
let lastCancel = -1e9;

export function speechState() {
  return { talking, quietAt };
}

// Qué dijo Eva y cuándo, para saber qué palabras suyas puede estar oyendo el micrófono
const said = []; // { text, start, end, cut }
let charsPerSecond = 15; // se ajusta con lo que tarda de verdad cada frase

function saidStart(text) {
  const entry = { text, start: now(), end: 0, cut: false };
  said.push(entry);
  if (said.length > 12) said.shift();
  return entry;
}

function saidEnd(entry, cut) {
  if (!entry || entry.end) return;
  entry.end = now();
  entry.cut = cut;
  const ms = entry.end - entry.start;
  if (!cut && ms > 800) charsPerSecond = charsPerSecond * 0.6 + (entry.text.length / ms) * 1000 * 0.4;
}

// Lo último que dijo Eva (las últimas n frases), para reconocer su voz si el micrófono la vuelve a oír
export function recentSpoken(n = 3) {
  return said
    .slice(-n)
    .map((entry) => entry.text)
    .join(" ");
}

// Lo que Eva dijo entre at − back y at + ahead (milisegundos), estimando por el tiempo
// qué parte de cada frase sonó en ese rato. Se agranda a palabras enteras.
export function spokenAround(at, back = 5000, ahead = 2000) {
  const from = at - back;
  const to = at + ahead;
  const parts = [];
  for (const entry of said) {
    const end = entry.end || Infinity;
    if (end < from || entry.start > to) continue;
    const len = entry.text.length;
    const rate = entry.end && !entry.cut ? (len / Math.max(1, entry.end - entry.start)) * 1000 : charsPerSecond;
    // Si la cortaron, no sabemos bien hasta dónde llegó: damos un margen
    const until = Math.min(to, entry.cut ? end + 1500 : end);
    // La velocidad es estimada (cada voz habla a su ritmo): margen de un 40 % para cada lado
    const sure = entry.end && !entry.cut;
    let a = Math.max(0, Math.floor(((from - entry.start) / 1000) * rate * (sure ? 1 : 0.6)));
    let b = Math.min(len, Math.ceil(((until - entry.start) / 1000) * rate * (sure ? 1 : 1.4)));
    if (b <= a) continue;
    while (a > 0 && entry.text[a - 1] !== " ") a -= 1;
    while (b < len && entry.text[b] !== " ") b += 1;
    parts.push(entry.text.slice(a, b));
  }
  return parts.join(" ");
}

function hushed() {
  if (!talking) return;
  talking = false;
  quietAt = now();
}

export function stopSpeaking() {
  seq += 1;
  live.utterance = null;
  hushed();
  // Lo que estaba diciendo quedó cortado acá
  const last = said[said.length - 1];
  if (last && !last.end) saidEnd(last, true);
  if (!synth) return;
  try {
    if (synth.speaking || synth.pending) lastCancel = now();
    synth.cancel();
  } catch {
    // el navegador no dejó cancelar; no pasa nada
  }
}

// Chrome deja de hablar sin avisar cuando una frase es muy larga,
// así que los textos largos se dicen de a una oración (y las muy largas, de a partes).
function splitText(text) {
  const sentences = text.match(/[^.!?…]+[.!?…]*["»”)]*\s*/g) || [text];
  const pieces = [];
  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if (s.length <= 180) {
      pieces.push(s);
      continue;
    }
    let buf = "";
    for (const part of s.split(/(?<=,)\s+/)) {
      if (buf && (buf + " " + part).length > 160) {
        pieces.push(buf);
        buf = part;
      } else {
        buf = buf ? buf + " " + part : part;
      }
    }
    if (buf) pieces.push(buf);
  }
  // Juntamos oraciones cortas para que no suene entrecortado
  const chunks = [];
  for (const piece of pieces) {
    const last = chunks[chunks.length - 1];
    if (last && (last + " " + piece).length <= 140) chunks[chunks.length - 1] = last + " " + piece;
    else chunks.push(piece);
  }
  return chunks.length ? chunks : [text];
}

// Dice un texto. onEnd se llama siempre: al terminar, si falla, si la cortan
// o si el navegador se cuelga (lo vigilamos, porque a veces no avisa que terminó).
export function speak(text, { onEnd } = {}) {
  if (!canSpeak || !text) {
    onEnd?.();
    return;
  }
  // Recién cortada otra frase, Chrome a veces descarta la nueva: esperamos un instante
  const justCut = Boolean(synth.speaking || synth.pending) || now() - lastCancel < 200;
  stopSpeaking();
  const my = seq;
  const chunks = splitText(text);
  talking = true;
  let done = false;
  let timer = 0;

  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    if (seq === my) {
      live.utterance = null;
      hushed();
    }
    onEnd?.();
  };

  const sayChunk = (i, isRetry) => {
    if (seq !== my || i >= chunks.length) {
      finish();
      return;
    }
    const utterance = new window.SpeechSynthesisUtterance(chunks[i]);
    utterance.lang = "es-AR";
    utterance.rate = 1;
    utterance.pitch = 1.05;
    const voice = pickVoice();
    if (voice) utterance.voice = voice;

    let started = false;
    let over = false;
    let idle = 0;
    let since = now();
    let entry = null;
    const limit = 3000 + chunks[i].length * 140;

    const next = (delay = 0) => {
      if (over) return;
      over = true;
      saidEnd(entry, false);
      window.clearTimeout(timer);
      if (delay) timer = window.setTimeout(() => sayChunk(i + 1, false), delay);
      else sayChunk(i + 1, false);
    };
    utterance.onstart = () => {
      started = true;
      // Con voces por internet tarda un poco en arrancar: contamos desde que suena
      if (entry && !entry.end) entry.start = now();
    };
    utterance.onend = () => next();
    utterance.onerror = () => {
      if (seq !== my) {
        saidEnd(entry, true);
        finish();
      } else next();
    };

    const watch = () => {
      if (over) return;
      if (seq !== my) {
        finish();
        return;
      }
      const busy = Boolean(synth.speaking || synth.pending);
      const elapsed = now() - since;
      // Nunca arrancó: el navegador la descartó. Probamos una vez más y si no, seguimos.
      if (!started && !busy && elapsed > 1500) {
        over = true;
        if (isRetry) {
          sayChunk(i + 1, false);
        } else {
          try {
            synth.cancel();
          } catch {
            // nada
          }
          timer = window.setTimeout(() => sayChunk(i, true), 150);
        }
        return;
      }
      // Terminó pero no avisó, o se quedó colgada
      idle = started && !busy ? idle + 1 : 0;
      if (idle >= 3 || elapsed > limit) {
        if (elapsed > limit) {
          try {
            synth.cancel();
          } catch {
            // nada
          }
        }
        next(150);
        return;
      }
      timer = window.setTimeout(watch, 250);
    };

    const go = () => {
      if (seq !== my) {
        finish();
        return;
      }
      live.utterance = utterance;
      since = now();
      entry = saidStart(chunks[i]);
      try {
        synth.resume?.();
        synth.speak(utterance);
      } catch {
        finish();
        return;
      }
      timer = window.setTimeout(watch, 250);
    };
    if (i === 0 && !isRetry && justCut) timer = window.setTimeout(go, 150);
    else go();
  };

  sayChunk(0, false);
}

// ---------- Escuchar ----------

// Cada escucha de Chrome tiene su número, único en toda la visita: así las frases de una escucha
// nueva nunca se confunden con las de una anterior (antes se repetían y Eva dejaba de entender)
let sessions = 0;

// Escucha de fondo, sin cortar (como «Ok Google»). Chrome corta la escucha cada tanto,
// así que la volvemos a prender sola. Devuelve una función para apagarla.
// match(texto, esFinal, momento, clave): se llama con cada cosa que va entendiendo; la clave
// identifica cada frase mientras Chrome la completa. Si devuelve true, se deja de escuchar.
// onReady: el micrófono quedó escuchando. onFatal(error): no se puede escuchar (sin permiso, sin micrófono).
// maxIdle / onIdle: si varias escuchas seguidas terminan sin oír nada, pregunta a onIdle si hay que parar
// (en el celular, así el micrófono no queda prendiéndose y apagándose solo).
// once: escucha una sola vez (una frase o un rato de silencio) y avisa con onDone, sin volver a empezar
export function listenForWakeWord({ match, onWake, onReady, onFatal, once = false, onDone }) {
  if (!Recognition) {
    onFatal?.("unsupported");
    return () => {};
  }
  let stopped = false;
  let rec = null;
  let timer = 0;
  let retries = 0;
  let startedAt = 0;
  let announced = false;

  const startOne = () => {
    if (stopped) return;
    rec = new Recognition();
    sessions += 1;
    const mySession = sessions;
    rec.lang = "es-AR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    // Cada frase tiene su clave. En Android, los pedacitos de una misma frase llegan en lugares
    // distintos de la lista: los juntamos en la misma clave para que sea un solo pedido (y un solo globito)
    const keys = new Map();
    let cur = null; // la última frase: { key, text, final, at }
    rec.onstart = () => {
      startedAt = now();
      if (!announced) {
        announced = true;
        onReady?.();
      }
    };
    rec.onresult = (e) => {
      retries = 0;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        const isFinal = result.isFinal && !(ANDROID && !(result[0].confidence > 0));
        let key = keys.get(i);
        if (!key) {
          // Android: sigue la frase anterior si todavía no había terminado, o si es la misma repetida
          // (a veces la manda dos veces). En la compu cada lugar de la lista es su propia parte de la frase.
          const same =
            ANDROID && cur && e.timeStamp - cur.at < 1500 && (!cur.final || plain(text) === plain(cur.text));
          key = same ? cur.key : `${mySession}:${i}`;
          keys.set(i, key);
        }
        cur = { key, text, final: isFinal, at: e.timeStamp };
        if (match(text, isFinal, e.timeStamp, key)) {
          stopped = true;
          try {
            rec.abort();
          } catch {
            // ya estaba cortado
          }
          onWake?.();
          return;
        }
      }
    };
    rec.onerror = (e) => {
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(e.error)) {
        stopped = true;
        onFatal?.(e.error);
      }
    };
    rec.onend = () => {
      if (stopped) return;
      if (once) {
        stopped = true;
        onDone?.();
        return;
      }
      // Si se corta enseguida (red, silencio), esperamos cada vez un poco más
      retries = now() - startedAt < 1500 ? retries + 1 : 0;
      timer = window.setTimeout(startOne, Math.min(10000, 300 * 2 ** retries));
    };
    try {
      startedAt = now();
      rec.start();
    } catch {
      timer = window.setTimeout(startOne, 1000);
    }
  };

  startOne();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    try {
      rec?.abort();
    } catch {
      // ya estaba cortado
    }
  };
}

// Sonidito de dos notas al aparecer, como los asistentes de los celulares.
// Si el navegador todavía no deja reproducir audio en la página, no suena y listo.
let audioCtx = null;
export function playChime() {
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioCtx = audioCtx || new Context();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const t = audioCtx.currentTime;
    [
      [660, 0],
      [880, 0.12],
    ].forEach(([freq, at]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + at);
      gain.gain.exponentialRampToValueAtTime(0.18, t + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.22);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + at);
      osc.stop(t + at + 0.25);
    });
  } catch {
    // sin audio
  }
}
