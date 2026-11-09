// Voz del navegador: hablar (síntesis) y escuchar (dictado).
// Funciona sin servidor. El dictado depende del navegador: Chrome y Edge lo tienen,
// Firefox no. Si algo no está, el asistente sigue andando por texto y botones.

const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
const Recognition =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const canSpeak = Boolean(synth) && typeof window.SpeechSynthesisUtterance !== "undefined";
export const canListen = Boolean(Recognition);

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

// Guardamos la frase activa para que el navegador no la descarte a mitad de camino
let current = null;

export function stopSpeaking() {
  current = null;
  if (!synth) return;
  try {
    synth.cancel();
  } catch {
    // el navegador no dejó cancelar; no pasa nada
  }
}

// Dice un texto. onEnd se llama al terminar, si falla o si no hay voz disponible.
export function speak(text, { onEnd } = {}) {
  if (!canSpeak || !text) {
    onEnd?.();
    return;
  }
  stopSpeaking();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = "es-AR";
  utterance.rate = 1;
  utterance.pitch = 1.05;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (current === utterance) current = null;
    onEnd?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  current = utterance;
  synth.speak(utterance);
}

// Escucha una frase. Devuelve una función para cortar.
// onPartial: lo que va entendiendo. onEnd(texto, error): al terminar.
export function listen({ onPartial, onEnd }) {
  if (!Recognition) {
    onEnd?.("", "unsupported");
    return () => {};
  }
  const rec = new Recognition();
  rec.lang = "es-AR";
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = false;

  let finalText = "";
  let error = null;
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    onPartial?.((finalText + interim).trim());
  };
  rec.onerror = (e) => {
    error = e.error;
  };
  rec.onend = () => onEnd?.(finalText.trim(), error);

  try {
    rec.start();
  } catch {
    onEnd?.("", "start");
    return () => {};
  }
  return () => {
    try {
      rec.abort();
    } catch {
      // ya estaba cortado
    }
  };
}

// Escucha de fondo hasta oír la frase para llamar a Eva (como «Ok Google»).
// match(texto, esFinal, momento, clave) decide si lo que oyó es la frase; la clave identifica
// cada frase mientras Chrome la va completando. Chrome corta la escucha cada tanto,
// así que la volvemos a prender sola. Devuelve una función para apagarla.
// onReady: el micrófono quedó escuchando. onFatal(error): no se puede escuchar (sin permiso, sin micrófono).
export function listenForWakeWord({ match, onWake, onReady, onFatal }) {
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
  let session = 0;

  const startOne = () => {
    if (stopped) return;
    rec = new Recognition();
    session += 1;
    const mySession = session;
    rec.lang = "es-AR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      startedAt = Date.now();
      if (!announced) {
        announced = true;
        onReady?.();
      }
    };
    rec.onresult = (e) => {
      retries = 0;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (match(e.results[i][0].transcript, e.results[i].isFinal, e.timeStamp, `${mySession}:${i}`)) {
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
      // Si se corta enseguida (red, silencio), esperamos cada vez un poco más
      retries = Date.now() - startedAt < 1500 ? retries + 1 : 0;
      timer = window.setTimeout(startOne, Math.min(10000, 300 * 2 ** retries));
    };
    try {
      startedAt = Date.now();
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
    const now = audioCtx.currentTime;
    [
      [660, 0],
      [880, 0.12],
    ].forEach(([freq, at]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.22);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.25);
    });
  } catch {
    // sin audio
  }
}
