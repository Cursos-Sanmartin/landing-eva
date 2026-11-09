import { useSyncExternalStore } from "react";

// Estado compartido entre el asistente, el interruptor del header y el enlace del pie.
// wake: si la persona activó llamar a Eva con la voz (se recuerda en su navegador).
// live: si en este momento el micrófono está escuchando la frase.

const KEY = "eva-asistente-voz";

function readWake() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let wake = readWake();
let live = false;
const listeners = new Set();
const toggleListeners = new Set();
const openListeners = new Set();

function emit() {
  listeners.forEach((callback) => callback());
}

function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setWakeEnabled(value) {
  wake = value;
  if (!value) live = false;
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // sin almacenamiento: dura hasta cerrar la página
  }
  emit();
}

export function setWakeLive(value) {
  if (live === value) return;
  live = value;
  emit();
}

// La persona tocó el interruptor del header
export function toggleWakeByUser(value) {
  setWakeEnabled(value);
  toggleListeners.forEach((callback) => callback(value));
}

export function onWakeToggledByUser(callback) {
  toggleListeners.add(callback);
  return () => toggleListeners.delete(callback);
}

// Abrir el asistente desde afuera (enlace del pie o enlace oculto para teclado)
export function requestOpen() {
  openListeners.forEach((callback) => callback());
}

export function onOpenRequest(callback) {
  openListeners.add(callback);
  return () => openListeners.delete(callback);
}

export function useWakeEnabled() {
  return useSyncExternalStore(subscribe, () => wake, () => false);
}

export function useWakeLive() {
  return useSyncExternalStore(subscribe, () => live, () => false);
}
