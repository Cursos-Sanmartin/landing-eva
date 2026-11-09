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
