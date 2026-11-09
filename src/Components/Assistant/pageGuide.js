// Lo que Eva necesita saber de la página que se está viendo:
// las tarjetas de trabajos, las temáticas del inicio y el visor de trabajos.
// Usa los mismos botones que tocaría una persona, así no duplica la lógica del sitio.

import { PROJECTS, THEMES } from "../../data/projects";
import { normalize } from "./commands";

const text = (node) => (node?.textContent || "").replace(/\s+/g, " ").trim();

// Temática de la página actual (/tematicas/robotica → "robotica")
export function currentThemeSlug() {
  const match = window.location.pathname.match(/^\/tematicas\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ---------- Tarjetas de trabajos ----------

export function projectCards() {
  return Array.from(document.querySelectorAll("main article.project-card"));
}

export function cardName(card) {
  return text(card.querySelector("h3"));
}

export function findCardByName(name) {
  const wanted = normalize(name);
  return projectCards().find((card) => normalize(cardName(card)) === wanted) || null;
}

// Posición 1, 2, 3… o −1 para la última
export function pickByPosition(list, position) {
  if (position === -1) return list[list.length - 1] || null;
  return list[position - 1] || null;
}

function firstSentence(value) {
  const sentence = value.split(/(?<=[.!?])\s/)[0] || "";
  return sentence.length > 220 ? sentence.slice(0, 217).trimEnd() + "…" : sentence;
}

// «Pixel Quest», un videojuego… → lo que Eva cuenta de cada tarjeta
export function describeCard(card) {
  const name = cardName(card);
  const school = text(card.querySelector(".project-school"));
  const students = text(card.querySelector(".project-students"));
  const action = text(card.querySelector(".project-link"));
  let kind = "una página web";
  if (/video/i.test(action)) kind = "un video";
  else if (/trabajo/i.test(action)) kind = "un documento";
  else if (/grande/i.test(action)) kind = "un diseño";
  const by = school ? `de ${school}` : students.replace(/^hecho por estudiantes de /i, "de ");
  const about = firstSentence(text(card.querySelector(".project-desc")));
  return `«${name}», ${kind} ${by}. ${about}`.trim();
}

// ---------- Temáticas del inicio ----------

export function themeTiles() {
  return Array.from(document.querySelectorAll('#tematicas a[href^="/tematicas/"]')).map((node) => {
    const slug = decodeURIComponent(node.getAttribute("href").replace("/tematicas/", ""));
    const count = PROJECTS.filter((p) => p.theme === slug).length;
    return { node, slug, to: `/tematicas/${slug}`, name: THEMES[slug]?.name || text(node.querySelector("b")), count };
  });
}

export function describeTile(tile) {
  if (tile.count === 0) return `${tile.name}: todavía sin proyectos.`;
  return `${tile.name}: ${tile.count === 1 ? "un proyecto" : `${tile.count} proyectos`}.`;
}

// ---------- Abrir y cerrar un trabajo ----------

// "viewer": se abrió en el visor del sitio. "web": se abrió en otra pestaña.
// "blocked": el navegador no dejó abrir la pestaña (queda marcado el botón).
export function openCard(card) {
  const zoom = card.querySelector("button.project-link");
  if (zoom) {
    zoom.click();
    return "viewer";
  }
  const link = card.querySelector("a.project-link");
  if (!link) return "none";
  const tab = window.open(link.href, "_blank");
  if (tab) {
    try {
      tab.opener = null;
    } catch {
      // otra pestaña de otro sitio: no hace falta
    }
    return "web";
  }
  link.focus();
  return "blocked";
}

export function openViewer() {
  return document.querySelector("dialog.lightbox[open]");
}

export function closeOpenViewer() {
  const dialog = openViewer();
  if (!dialog) return false;
  // El botón del sitio también frena el video, si lo hay
  const close = dialog.querySelector(".lightbox-close");
  if (close) close.click();
  if (dialog.open) dialog.close();
  return true;
}

// "ok" | "edge" (primera o última) | "single" (una sola página) | "none" (no hay visor abierto)
export function turnViewerPage(dir) {
  const dialog = openViewer();
  if (!dialog) return { result: "none" };
  const buttons = dialog.querySelectorAll(".lightbox-bar button");
  if (buttons.length < 2) return { result: "single" };
  const button = dir > 0 ? buttons[1] : buttons[0];
  if (button.disabled) return { result: "edge" };
  button.click();
  return { result: "ok", dialog };
}

export function viewerPageLabel(dialog) {
  return text(dialog?.querySelector(".lightbox-bar span"));
}

// Espera a que aparezca algo en la página (por ejemplo, después de cambiar de temática)
export function waitFor(check, timeout = 2500) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const value = check();
      if (value || Date.now() - started > timeout) resolve(value || null);
      else window.setTimeout(tick, 100);
    };
    tick();
  });
}
